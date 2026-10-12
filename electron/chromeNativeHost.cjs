'use strict';
const net = require('node:net');
const PIPE = '\\\\\\\\.\\\\pipe\\\\hubmind-jess-chrome-v1';
const MAX_MESSAGE = 1024 * 1024;
let pipe = null;
let nativeBuffer = Buffer.alloc(0);
let pipeBuffer = '';
let closed = false;

function writeNative(message) {
  const body = Buffer.from(JSON.stringify(message), 'utf8');
  if (body.length > MAX_MESSAGE) throw new Error('Native message exceeds 1 MiB.');
  const frame = Buffer.allocUnsafe(4 + body.length);
  frame.writeUInt32LE(body.length, 0);
  body.copy(frame, 4);
  process.stdout.write(frame);
}
function stop(code = 0) {
  if (closed) return;
  closed = true;
  try { pipe?.destroy(); } catch {}
  process.exitCode = code;
}
function connectPipe(attempt = 0) {
  if (closed) return;
  pipe = net.createConnection(PIPE);
  pipe.on('connect', () => {
    pipeBuffer = '';
    pipe.on('data', chunk => {
      pipeBuffer += chunk.toString('utf8');
      if (pipeBuffer.length > MAX_MESSAGE * 2) return stop(2);
      let at;
      while ((at = pipeBuffer.indexOf('\n')) >= 0) {
        const line = pipeBuffer.slice(0, at).trim();
        pipeBuffer = pipeBuffer.slice(at + 1);
        if (!line) continue;
        try { writeNative(JSON.parse(line)); }
        catch { stop(2); return; }
      }
    });
    pipe.on('error', () => stop(1));
    pipe.on('close', () => stop(0));
  });
  pipe.on('error', () => {
    if (closed) return;
    if (attempt >= 19) return stop(1);
    setTimeout(() => connectPipe(attempt + 1), 500);
  });
}
process.stdin.on('data', chunk => {
  nativeBuffer = Buffer.concat([nativeBuffer, chunk]);
  while (nativeBuffer.length >= 4) {
    const length = nativeBuffer.readUInt32LE(0);
    if (length < 2 || length > MAX_MESSAGE) return stop(2);
    if (nativeBuffer.length < 4 + length) return;
    const body = nativeBuffer.subarray(4, 4 + length);
    nativeBuffer = nativeBuffer.subarray(4 + length);
    try {
      const message = JSON.parse(body.toString('utf8'));
      if (!pipe || pipe.destroyed) return stop(1);
      pipe.write(JSON.stringify(message) + '\n');
    } catch { return stop(2); }
  }
});
process.stdin.on('end', () => stop(0));
process.stdin.on('error', () => stop(1));
connectPipe();
