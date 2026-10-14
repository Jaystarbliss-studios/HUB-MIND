using System.Buffers.Binary;
using System.IO.Pipes;
using System.Text;
using System.Text.Json;

const int MaxMessageBytes = 1024 * 1024;
const string PipeName = "hubmind-jess-chrome-v1";
const string AllowedOrigin = "chrome-extension://baifedjcpcnkjjoikbafnkiombiaooai/";
if (args.Length < 1 || !string.Equals(args[0], AllowedOrigin, StringComparison.Ordinal))
{
    Environment.ExitCode = 2;
    return;
}
using var pipe = new NamedPipeClientStream(".", PipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
try
{
    await pipe.ConnectAsync(10000);
}
catch
{
    Environment.ExitCode = 1;
    return;
}

using var nativeIn = Console.OpenStandardInput();
using var nativeOut = Console.OpenStandardOutput();
using var pipeReader = new StreamReader(pipe, new UTF8Encoding(false), false, 4096, leaveOpen: true);
using var pipeWriter = new StreamWriter(pipe, new UTF8Encoding(false), 4096, leaveOpen: true) { AutoFlush = true };
string token;
try
{
    var tokenPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Jaystarbliss", "Hub-Mind", "jess-chrome-bridge-token");
    token = (await File.ReadAllTextAsync(tokenPath)).Trim();
    if (token.Length != 64 || token.Any(ch => !Uri.IsHexDigit(ch))) throw new InvalidDataException("Chrome bridge token is invalid.");
    await pipeWriter.WriteLineAsync(JsonSerializer.Serialize(new { type = "auth", token }));
    var authLine = await pipeReader.ReadLineAsync().WaitAsync(TimeSpan.FromSeconds(5));
    using var auth = JsonDocument.Parse(authLine ?? "{}");
    if (!auth.RootElement.TryGetProperty("type", out var authType) || authType.GetString() != "auth" ||
        !auth.RootElement.TryGetProperty("ok", out var authOk) || authOk.ValueKind != JsonValueKind.True)
    {
        Environment.ExitCode = 3;
        return;
    }
}
catch
{
    Environment.ExitCode = 3;
    return;
}
using var stop = new CancellationTokenSource();

var fromChrome = PumpNativeMessagesToPipeAsync(nativeIn, pipeWriter, stop.Token);
var fromApp = PumpPipeMessagesToChromeAsync(pipeReader, nativeOut, stop.Token);
await Task.WhenAny(fromChrome, fromApp);
stop.Cancel();
try { await Task.WhenAll(fromChrome, fromApp); } catch { }
Environment.ExitCode = 0;

static async Task PumpNativeMessagesToPipeAsync(Stream input, StreamWriter pipeWriter, CancellationToken cancellationToken)
{
    var header = new byte[4];
    while (!cancellationToken.IsCancellationRequested)
    {
        await ReadExactlyAsync(input, header, cancellationToken);
        var length = BinaryPrimitives.ReadUInt32LittleEndian(header);
        if (length < 2 || length > MaxMessageBytes) throw new InvalidDataException("Invalid Chrome native message length.");
        var payload = new byte[(int)length];
        await ReadExactlyAsync(input, payload, cancellationToken);
        var json = Encoding.UTF8.GetString(payload);
        await pipeWriter.WriteLineAsync(json.AsMemory(), cancellationToken);
    }
}

static async Task PumpPipeMessagesToChromeAsync(StreamReader pipeReader, Stream output, CancellationToken cancellationToken)
{
    while (!cancellationToken.IsCancellationRequested)
    {
        var line = await pipeReader.ReadLineAsync(cancellationToken);
        if (line is null) break;
        var payload = Encoding.UTF8.GetBytes(line);
        if (payload.Length < 2 || payload.Length > MaxMessageBytes) throw new InvalidDataException("Invalid app bridge message length.");
        var header = new byte[4];
        BinaryPrimitives.WriteUInt32LittleEndian(header, (uint)payload.Length);
        await output.WriteAsync(header, cancellationToken);
        await output.WriteAsync(payload, cancellationToken);
        await output.FlushAsync(cancellationToken);
    }
}

static async Task ReadExactlyAsync(Stream stream, byte[] buffer, CancellationToken cancellationToken)
{
    var offset = 0;
    while (offset < buffer.Length)
    {
        var read = await stream.ReadAsync(buffer.AsMemory(offset), cancellationToken);
        if (read == 0) throw new EndOfStreamException();
        offset += read;
    }
}
