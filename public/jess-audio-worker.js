/* Jess audio processing worker. Keeps PCM conversion, VAD, and Base64 encoding off the UI thread. */

type ProcessMessage = { type: 'process'; buffer: ArrayBuffer; sampleRate?: number };
let ambientNoiseFloor = 0.008;
let speechHangoverCounter = 0;
function isVoiceAboveNoiseFloor(input: Float32Array): boolean {
  if (!input.length) return false;
  let sumSquares = 0, peak = 0;
  for (let i = 0; i < input.length; i++) { const value = input[i]; const abs = Math.abs(value); if (abs > peak) peak = abs; sumSquares += value * value; }
  const rms = Math.sqrt(sumSquares / input.length);
  if (rms < ambientNoiseFloor) ambientNoiseFloor = ambientNoiseFloor * 0.9 + rms * 0.1;
  else ambientNoiseFloor = ambientNoiseFloor * 0.999 + rms * 0.001;
  ambientNoiseFloor = Math.max(0.002, Math.min(0.05, ambientNoiseFloor));
  const threshold = Math.max(0.01, ambientNoiseFloor * 2.0);
  if (rms >= threshold && peak >= 0.025) { speechHangoverCounter = 5; return true; }
  if (speechHangoverCounter > 0) { speechHangoverCounter--; return true; }
  return false;
}
function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const output = new ArrayBuffer(input.length * 2), view = new DataView(output);
  for (let i = 0; i < input.length; i++) { const sample = Math.max(-1, Math.min(1, input[i])); view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true); }
  return output;
}
function base64Encode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer), chunkSize = 0x8000; let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
  return btoa(binary);
}
self.onmessage = (event: MessageEvent<ProcessMessage>) => {
  const message = event.data;
  if (!message || message.type !== 'process') return;
  try {
    const input = new Float32Array(message.buffer);
    if (!isVoiceAboveNoiseFloor(input)) { self.postMessage({ type: 'silence' }); return; }
    const pcm = floatTo16BitPCM(input);
    self.postMessage({ type: 'audio', data: base64Encode(pcm), mimeType: 'audio/pcm;rate=' + (message.sampleRate || 16000) });
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Audio processing failed.' });
  }
};
