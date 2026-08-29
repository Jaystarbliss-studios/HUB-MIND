import React from 'react';
import { AudioSettings } from '../types';

interface VoiceSettingsProps {
  settings: AudioSettings;
  onUpdateSettings: (settings: Partial<AudioSettings>) => void;
  onClose: () => void;
}

/**
 * Legacy compatibility shell.
 * Wake-word detection was removed from Shawn. Live sessions are started
 * explicitly by the user and use the controls in LiveVoiceControls.
 */
export const VoiceAndWakeSettings: React.FC<VoiceSettingsProps> = ({ onClose }) => (
  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-200">
    <h3 className="text-sm font-semibold">Shawn Live Settings</h3>
    <p className="mt-2 text-xs text-slate-400">
      Wake-word listening has been removed. Start a Live session manually when you want Shawn to listen.
    </p>
    <button onClick={onClose} className="mt-4 px-3 py-2 rounded-lg bg-slate-800 text-xs text-slate-200 hover:bg-slate-700">
      Close
    </button>
  </div>
);
