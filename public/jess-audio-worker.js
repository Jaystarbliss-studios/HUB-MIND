/* Jess audio processing worker.
 * Responsibilities:
 *  - streaming resample to 16 kHz mono
 *  - adaptive energy VAD with hysteresis + hangover
 *  - short pre-roll so the first phoneme is not clipped
 *  - Float32 -> little-endian PCM16
 *  - Base64 encoding off the main thread
 *
 * The file is intentionally plain JavaScript because it is loaded directly
 * with new Worker('/jess-audio-worker.js').
 */

const TARGET_SAMPLE_RATE = 16000;
const MIN_SAMPLE_RATE = 8000;
const MAX_SAMPLE_RATE = 96000;
const PRE_ROLL_MS = 160;
const START_HOLD_MS = 80;
const STOP_HOLD_MS = 320;
const MIN_NOISE_FLOOR = 0.002;
const MAX_NOISE_FLOOR = 0.08;
const START_MULTIPLIER = 2.2;
const STOP_MULTIPLIER = 1.55;
const ABSOLUTE_START_RMS = 0.008;
const ABSOLUTE_START_PEAK = 0.018;
const MAX_PENDING_WORKER_STATE = 1;

let generation = 0;
let sequence = -1;
let sourceSampleRate = TARGET_SAMPLE_RATE;
let resampleStep = 1;
let resamplePhase = 0;
let previousSourceSample = null;

let ambientNoiseFloor = 0.008;
let calibrationSamples = 0;
let calibrationRmsValues = [];
let speechActive = false;
let speechStartSamples = 0;
let silenceSamples = 0;

let preRoll = new Float32Array(0);

function resetState(nextGeneration, sampleRate) {
  generation = Number.isFinite(nextGeneration) ? nextGeneration : 0;
  sequence = -1;
  sourceSampleRate = sampleRate >= MIN_SAMPLE_RATE && sampleRate <= MAX_SAMPLE_RATE
    ? sampleRate
    : TARGET_SAMPLE_RATE;
  resampleStep = sourceSampleRate / TARGET_SAMPLE_RATE;
  resamplePhase = 0;
  previousSourceSample = null;
  ambientNoiseFloor = 0.008;
  calibrationSamples = 0;
  calibrationRmsValues = [];
  speechActive = false;
  speechStartSamples = 0;
  silenceSamples = 0;
  preRoll = new Float32Array(0);
}

function calculateRmsAndPeak(input) {
  let sumSquares = 0;
  let peak = 0;
  for (let i = 0; i < input.length; i += 1) {
    const value = input[i];
    const abs = Math.abs(value);
    if (abs > peak) peak = abs;
    sumSquares += value * value;
  }
  return {
    rms: input.length ? Math.sqrt(sumSquares / input.length) : 0,
    peak,
  };
}

function appendPreRoll(samples) {
  if (!samples.length) return;
  const maxSamples = Math.round(TARGET_SAMPLE_RATE * PRE_ROLL_MS / 1000);
  const combined = new Float32Array(Math.min(maxSamples, preRoll.length + samples.length));
  const skip = Math.max(0, preRoll.length + samples.length - maxSamples);

  let write = 0;
  if (skip < preRoll.length) {
    const sourceStart = skip;
    const copyLength = preRoll.length - sourceStart;
    combined.set(preRoll.subarray(sourceStart), write);
    write += copyLength;
  }

  const sampleStart = Math.max(0, skip - preRoll.length);
  combined.set(samples.subarray(sampleStart), write);
  preRoll = combined;
}

function streamResample(input) {
  if (!input.length) return new Float32Array(0);

  let buffer;
  if (previousSourceSample === null) {
    buffer = input;
  } else {
    buffer = new Float32Array(input.length + 1);
    buffer[0] = previousSourceSample;
    buffer.set(input, 1);
  }

  const output = [];
  let position = resamplePhase;

  while (position + 1 < buffer.length) {
    const index = Math.floor(position);
    const fraction = position - index;
    const a = buffer[index];
    const b = buffer[index + 1];
    output.push(a + (b - a) * fraction);
    position += resampleStep;
  }

  resamplePhase = position - (buffer.length - 1);
  previousSourceSample = input[input.length - 1];

  return Float32Array.from(output);
}

function updateNoiseFloor(rms, sampleCount) {
  if (!sampleCount) return;

  // During the first ~250 ms, establish a conservative baseline. This avoids
  // making the initial room/microphone noise threshold depend on one frame.
  if (calibrationSamples < TARGET_SAMPLE_RATE * 0.25) {
    calibrationSamples += sampleCount;
    calibrationRmsValues.push(rms);

    // Use a low percentile rather than an average. If the user starts talking
    // immediately, speech must not become the noise floor and suppress itself.
    const sorted = calibrationRmsValues.slice().sort((a, b) => a - b);
    const percentileIndex = Math.floor((sorted.length - 1) * 0.3);
    const baseline = sorted[Math.max(0, percentileIndex)] || MIN_NOISE_FLOOR;
    ambientNoiseFloor = Math.max(
      MIN_NOISE_FLOOR,
      Math.min(0.025, baseline * 1.5),
    );
    return;
  }

  // Only adapt quickly when we are not speaking. During speech, adaptation is
  // deliberately slow so a loud speaker cannot raise the floor underneath them.
  const alpha = speechActive ? 0.002 : 0.05;
  ambientNoiseFloor = ambientNoiseFloor * (1 - alpha) + rms * alpha;
  ambientNoiseFloor = Math.max(MIN_NOISE_FLOOR, Math.min(MAX_NOISE_FLOOR, ambientNoiseFloor));
}

function detectSpeech(input) {
  const metrics = calculateRmsAndPeak(input);
  const rms = metrics.rms;
  const peak = metrics.peak;
  updateNoiseFloor(rms, input.length);

  const startThreshold = Math.max(ABSOLUTE_START_RMS, ambientNoiseFloor * START_MULTIPLIER);
  const stopThreshold = Math.max(ABSOLUTE_START_RMS * 0.65, ambientNoiseFloor * STOP_MULTIPLIER);
  const aboveStart = rms >= startThreshold && peak >= ABSOLUTE_START_PEAK;
  const aboveStop = rms >= stopThreshold;

  if (!speechActive) {
    if (aboveStart) {
      speechStartSamples += input.length;
      if (speechStartSamples >= TARGET_SAMPLE_RATE * START_HOLD_MS / 1000) {
        speechActive = true;
        speechStartSamples = 0;
        silenceSamples = 0;
        return 'start';
      }
    } else {
      speechStartSamples = 0;
    }
    return 'silence';
  }

  if (aboveStop) {
    silenceSamples = 0;
    return 'speech';
  }

  silenceSamples += input.length;
  if (silenceSamples >= TARGET_SAMPLE_RATE * STOP_HOLD_MS / 1000) {
    speechActive = false;
    silenceSamples = 0;
    speechStartSamples = 0;
    return 'end';
  }

  return 'speech';
}

function concatFloat32(a, b) {
  if (!a.length) return new Float32Array(b);
  if (!b.length) return new Float32Array(a);
  const result = new Float32Array(a.length + b.length);
  result.set(a, 0);
  result.set(b, a.length);
  return result;
}

function floatTo16BitPCM(input) {
  const output = new ArrayBuffer(input.length * 2);
  const view = new DataView(output);
  for (let i = 0; i < input.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    const pcm = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(i * 2, pcm, true);
  }
  return output;
}

function base64Encode(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)),
    );
  }
  return btoa(binary);
}

function emitAudio(samples, message, vadState) {
  if (!samples.length) {
    self.postMessage({
      type: 'vad',
      generation: message.generation,
      sequence: message.sequence,
      state: vadState,
    });
    return;
  }

  const pcm = floatTo16BitPCM(samples);
  self.postMessage({
    type: 'audio',
    generation: message.generation,
    sequence: message.sequence,
    data: base64Encode(pcm),
    mimeType: 'audio/pcm;rate=16000',
    vadState,
  });
}

self.onmessage = function(event) {
  const message = event && event.data;
  if (!message || !message.type) return;

  try {
    if (message.type === 'reset') {
      resetState(message.generation, message.sampleRate);
      return;
    }

    if (message.type !== 'process' || !(message.buffer instanceof ArrayBuffer)) return;

    const messageGeneration = Number.isFinite(message.generation) ? message.generation : 0;
    const messageSequence = Number.isFinite(message.sequence) ? message.sequence : 0;
    const sampleRate = Number(message.sampleRate) || TARGET_SAMPLE_RATE;

    if (messageGeneration !== generation || sampleRate !== sourceSampleRate) {
      resetState(messageGeneration, sampleRate);
    }

    const input = new Float32Array(message.buffer);
    if (!input.length) return;

    const resampled = streamResample(input);
    if (!resampled.length) return;

    const vadState = detectSpeech(resampled);

    if (vadState === 'start') {
      // Include the recent pre-roll plus the current speech frame. Clear the
      // ring before emitting so the same samples are never emitted twice.
      const firstSpeech = concatFloat32(preRoll, resampled);
      preRoll = new Float32Array(0);
      emitAudio(firstSpeech, message, 'start');
      return;
    }

    if (vadState === 'start' || vadState === 'speech' || vadState === 'end') {
      emitAudio(resampled, message, vadState);
    } else {
      appendPreRoll(resampled);
      self.postMessage({
        type: 'silence',
        generation: messageGeneration,
        sequence: messageSequence,
        vadState,
      });
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      generation: event?.data?.generation,
      sequence: event?.data?.sequence,
      message: error instanceof Error ? error.message : 'Audio processing failed.',
    });
  }
};
