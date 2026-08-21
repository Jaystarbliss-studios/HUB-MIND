import React, { useState, useEffect } from 'react';
import { shawnTaskManager, ShawnTask } from '../lib/shawnTaskManager';
import { Sparkles, Loader2, CheckCircle2, AlertCircle, X, ExternalLink, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ShawnTaskStatus: React.FC = () => {
  const [tasks, setTasks] = useState<ShawnTask[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = shawnTaskManager.subscribe((allTasks) => {
      setTasks(allTasks);
    });
    return () => unsubscribe();
  }, []);

  const activeTasks = tasks.filter(t => t.status === 'running' || t.status === 'awaiting_approval');
  const recentCompleted = tasks.filter(t => (t.status === 'completed' || t.status === 'failed') && (Date.now() - (t.completedAt || 0) < 8000));

  const visibleTasks = [...activeTasks, ...recentCompleted];
  if (visibleTasks.length === 0) return null;

  return (
    <div 
      id="shawn-active-tasks-banner"
      className="fixed top-16 right-4 sm:right-6 z-40 max-w-sm w-full flex flex-col gap-2 pointer-events-none print:hidden"
    >
      {visibleTasks.map((task) => {
        const isRunning = task.status === 'running';
        const isCompleted = task.status === 'completed';
        const isApproval = task.status === 'awaiting_approval';
        const isFailed = task.status === 'failed';

        return (
          <div
            key={task.id}
            className={`pointer-events-auto p-3 rounded-xl border backdrop-blur-xl shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-top-3 ${
              isRunning
                ? 'bg-slate-900/95 border-teal-500/50 text-slate-100'
                : isApproval
                ? 'bg-slate-900/95 border-accent/70 text-slate-100'
                : isCompleted
                ? 'bg-slate-900/95 border-emerald-500/60 text-slate-100'
                : 'bg-slate-900/95 border-red-500/60 text-slate-100'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {isRunning && <Loader2 className="w-4 h-4 text-teal-400 animate-spin shrink-0" />}
                {isApproval && <Sparkles className="w-4 h-4 text-accent animate-pulse shrink-0" />}
                {isCompleted && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                {isFailed && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
                
                <div className="min-w-0">
                  <h4 className="text-xs font-bold truncate text-white">{task.title}</h4>
                  <p className="text-[11px] text-slate-400 truncate">{task.currentStepMessage}</p>
                </div>
              </div>

              <button
                onClick={() => shawnTaskManager.removeTask(task.id)}
                className="text-slate-500 hover:text-slate-300 p-0.5"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Progress Bar */}
            {isRunning && (
              <div className="mt-2.5 w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                <div 
                  className="bg-linear-to-r from-teal-500 to-cyan-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(10, task.progress)}%` }}
                />
              </div>
            )}

            {/* Document Navigation Shortcut if document task */}
            {task.documentId && (
              <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                <span className="text-slate-400 font-medium">Shawn Co-Pilot Active</span>
                <button
                  onClick={() => navigate(`/documents/${task.documentId}`)}
                  className="text-accent hover:underline flex items-center gap-1 font-semibold"
                >
                  <span>Open Document</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
