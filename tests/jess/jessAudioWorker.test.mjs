import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const workerSource = await readFile(new URL('../../public/jess-audio-worker.js', import.meta.url), 'utf8');
const messages = [];

const sandbox = {
  Float32Array,
  ArrayBuffer,
  DataView,
  Uint8Array,
  Math,
  Number,
  Error,
  btoa: (value) => Buffer.from(value, 'binary').toString('base64'),
  console,
  self: { postMessage: (message) => messages.push(message), onmessage: null },
};

vm.runInNewContext(workerSource, sandbox, { filename: 'jess-audio-worker.js' });
assert.equal(typeof sandbox.self.onmessage, 'function');

function frame(value, length = 1024) {
  const data = new Float32Array(length);
  data.fill(value);
  return data.buffer;
}

function process(buffer, sequence, sampleRate = 48000) {
  sandbox.self.onmessage({
    data: { type: 'process', buffer, sampleRate, generation: 7, sequence },
  });
}

sandbox.self.onmessage({ data: { type: 'reset', generation: 7, sampleRate: 48000 } });

for (let i = 0; i < 12; i += 1) process(frame(0.001), i);
for (let i = 12; i < 20; i += 1) process(frame(0.12), i);

const audioMessages = messages.filter((message) => message.type === 'audio');
assert.ok(audioMessages.length > 0, 'expected continuous audio to be emitted');
assert.ok(audioMessages.every((message) => message.generation === 7));
assert.ok(audioMessages.every((message) => message.mimeType === 'audio/pcm;rate=16000'));
assert.ok(audioMessages.every((message) => typeof message.data === 'string' && message.data.length > 0));
assert.ok(audioMessages.every((message) => message.vadState === undefined), 'worker must not gate audio behind client VAD');

const firstAudio = audioMessages[0];
const decodedLength = Buffer.from(firstAudio.data, 'base64').byteLength;
assert.ok(decodedLength >= 650 && decodedLength <= 720, `unexpected PCM size: ${decodedLength}`);

const beforeSilence = messages.filter((message) => message.type === 'audio').length;
process(frame(0.0005), 20);
assert.ok(messages.filter((message) => message.type === 'audio').length > beforeSilence, 'silence must continue to Gemini for server-side VAD');

sandbox.self.onmessage({ data: { type: 'process', generation: 7, sequence: 999 } });
assert.equal(messages.some((message) => message.type === 'error' && message.sequence === 999), false);
