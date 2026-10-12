using System.Speech.Recognition;
using System.Text.Json;
using System.Text.RegularExpressions;

static void Emit(object value)
{
    Console.Out.WriteLine(JsonSerializer.Serialize(value));
    Console.Out.Flush();
}

using var recognizer = new SpeechRecognitionEngine();
recognizer.LoadGrammar(new DictationGrammar());
recognizer.SetInputToDefaultAudioDevice();
var fired = 0;
recognizer.SpeechRecognized += (_, eventArgs) =>
{
    if (Interlocked.CompareExchange(ref fired, 0, 0) != 0) return;
    var transcript = Regex.Replace(eventArgs.Result?.Text ?? string.Empty, @"\s+", " ").Trim();
    if (transcript.Length == 0) return;
    var match = Regex.Match(transcript, @"^(?:(?:hey|hello|hi|okay|ok|yo)[\s,.:;!?-]+)?jess\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    if (!match.Success) return;
    if (Interlocked.Exchange(ref fired, 1) != 0) return;
    var prompt = transcript[match.Length..].TrimStart(' ', ',', '.', ':', ';', '!', '?', '-');
    Emit(new { type = "wake", prompt, transcript, source = "Windows System.Speech offline recognizer" });
    try { recognizer.RecognizeAsyncCancel(); } catch { }
};

try
{
    recognizer.RecognizeAsync(RecognizeMode.Multiple);
    Emit(new { type = "ready", source = "Windows System.Speech offline recognizer" });
    await Task.Delay(Timeout.InfiniteTimeSpan);
}
catch (Exception ex)
{
    Console.Error.WriteLine(ex.Message);
    Environment.ExitCode = 2;
}
