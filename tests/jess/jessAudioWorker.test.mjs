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
  self: {
    postMessage: (message) => messages.push(message),
    onmessage: null,
  },
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
    data: {
      type: 'process',
      buffer,
      sampleRate,
      generation: 7,
      sequence,
    },
  });
}

sandbox.self.onmessage({
  data: { type: 'reset', generation: 7, sampleRate: 48000 },
});

// ~256 ms of quiet room noise establishes the baseline without producing audio.
for (let i = 0; i < 12; i += 1) process(frame(0.001), i);

const baselineMessages = messages.length;
assert.ok(baselineMessages >= 1);
assert.ok(messages.every((message) => message.generation === 7));

// Sustained speech should eventually trigger a speech-start payload.
for (let i = 12; i < 20; i += 1) process(frame(0.12), i);

const audioMessages = messages.filter((message) => message.type === 'audio');
assert.ok(audioMessages.length > 0, 'expected speech audio to be emitted');
assert.ok(audioMessages.some((message) => message.vadState === 'start'), 'expected a VAD start transition');
assert.ok(audioMessages.every((message) => message.mimeType === 'audio/pcm;rate=16000'));
assert.ok(audioMessages.every((message) => typeof message.data === 'string' && message.data.length > 0));

// A 48 kHz input chunk must be downsampled before encoding. 1024 source
// frames should become roughly 341 target frames, i.e. 682 PCM bytes.
const startMessage = audioMessages.find((message) => message.vadState === 'start');
assert.ok(startMessage);
const decodedLength = Buffer.from(startMessage.data, 'base64').byteLength;
assert.ok(decodedLength >= 5600 && decodedLength <= 6000, `unexpected PCM size: ${decodedLength}`);

// Enough silence should end the VAD state rather than leaving it permanently active.
for (let i = 20; i < 40; i += 1) process(frame(0.0005), i);
assert.ok(messages.some((message) => message.type === 'audio' && message.vadState === 'end'), 'expected a VAD end transition');

// Malformed input must not crash the worker.
sandbox.self.onmessage({ data: { type: 'process', generation: 7, sequence: 999 } });
assert.equal(messages.some((message) => message.type === 'error' && message.sequence === 999), false);
