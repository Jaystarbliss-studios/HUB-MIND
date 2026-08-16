import React, { useState, useEffect } from 'react';
import { WorldPulseItem } from '../types';
import {
  Globe2,
  Sparkles,
  RefreshCw,
  Volume2,
  TrendingUp,
  MapPin,
  MessageCircle,
  Quote,
} from 'lucide-react';

interface WorldPulseProps {
  onDiscussWithShawn: (topicPrompt: string) => void;
  onPlayTTS?: (text: string) => void;
}

export const WorldPulse: React.FC<WorldPulseProps> = ({
  onDiscussWithShawn,
  onPlayTTS,
}) => {
  const [pulseList, setPulseList] = useState<WorldPulseItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchPulse = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/world-pulse');
      const data = await res.json();
      if (data.pulse && Array.isArray(data.pulse)) {
        setPulseList(data.pulse);
      }
    } catch (e) {
      console.error('Failed to fetch world pulse:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPulse();
  }, []);

  return (
    <div id="world-pulse-panel" className="flex flex-col h-full rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe2 className="w-4 h-4 text-teal-400" />
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200 font-mono">
              Global Pulse & Intelligence
            </h3>
            <p className="text-[11px] text-slate-400">
              Cross-cultural market dispatches, clinical insights & situational wit from Shawn.
            </p>
          </div>
        </div>

        <button
          id="refresh-pulse-btn"
          onClick={fetchPulse}
          disabled={isLoading}
          className="p-1.5 rounded-lg text-slate-400 hover:text-teal-300 hover:bg-slate-800 transition disabled:opacity-40"
          title="Refresh Global Briefings"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Content List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {pulseList.map((item) => (
          <div
            key={item.id}
            className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-teal-500/40 transition space-y-3 shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[10px] font-mono font-semibold uppercase text-teal-400 bg-teal-500/10 border border-teal-500/30 px-2 py-0.5 rounded-md">
                <MapPin className="w-3 h-3" />
                {item.region}
              </span>
              <div className="flex items-center gap-1.5">
                {onPlayTTS && (
                  <button
                    onClick={() => onPlayTTS(`${item.title}. ${item.summary} Shawn says: ${item.shawnNote}`)}
                    className="p-1 text-slate-400 hover:text-teal-300 transition"
                    title="Read aloud"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() =>
                    onDiscussWithShawn(
                      `Shawn, let's talk about this dispatch from ${item.region}: "${item.title}". You noted: "${item.shawnNote}". What is your strategic take on this?`
                    )
                  }
                  className="flex items-center gap-1 text-[11px] text-teal-400 hover:text-teal-300 transition font-medium"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Discuss</span>
                </button>
              </div>
            </div>

            <h4 className="text-sm font-semibold text-slate-100">{item.title}</h4>
            <p className="text-xs text-slate-300 leading-relaxed">{item.summary}</p>

            {/* Shawn's Direct Personal Commentary */}
            <div className="p-3 rounded-lg bg-teal-500/5 border-l-2 border-teal-400/80 space-y-1">
              <div className="flex items-center gap-1 text-[10px] font-mono text-teal-400">
                <Quote className="w-3 h-3" />
                <span>Shawn's Candid Take</span>
              </div>
              <p className="text-xs italic text-teal-100/90 leading-relaxed">
                "{item.shawnNote}"
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
