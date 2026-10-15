import test from 'node:test';
import assert from 'node:assert/strict';
import {
  claimJessAudio,
  releaseJessAudio,
  getJessAudioOwner,
  subscribeJessAudioOwner,
} from '../../src/services/jessVoiceSessionCoordinator.ts';

test('microphone ownership is exclusive, including re-entrant claims by the same owner', () => {
  releaseJessAudio('live-conversation');
  releaseJessAudio('dictation');

  assert.equal(claimJessAudio('live-conversation'), true);
  assert.equal(getJessAudioOwner(), 'live-conversation');
  assert.equal(claimJessAudio('live-conversation'), false);
  assert.equal(claimJessAudio('dictation'), false);

  // A non-owner cannot release another session's microphone.
  releaseJessAudio('dictation');
  assert.equal(getJessAudioOwner(), 'live-conversation');

  releaseJessAudio('live-conversation');
  assert.equal(getJessAudioOwner(), null);
  assert.equal(claimJessAudio('dictation'), true);
  releaseJessAudio('dictation');
});

test('microphone ownership listeners observe handoff and can unsubscribe', () => {
  releaseJessAudio('live-conversation');
  releaseJessAudio('dictation');
  const observed = [];
  const unsubscribe = subscribeJessAudioOwner(owner => observed.push(owner));
  assert.equal(claimJessAudio('dictation'), true);
  releaseJessAudio('dictation');
  unsubscribe();
  assert.deepEqual(observed, [null, 'dictation', null]);
});
