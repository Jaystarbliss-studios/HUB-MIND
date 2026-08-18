import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, Cloud, AlertCircle } from 'lucide-react';

export const SyncStatusIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSynced, setLastSynced] = useState<Date>(new Date());
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [showDetails, setShowDetails] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setPendingCount((prev) => prev + 1);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic sync check
    const interval = setInterval(() => {
      if (navigator.onLine) {
        setLastSynced(new Date());
      }
    }, 60000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const triggerSync = async () => {
    if (!navigator.onLine) return;
    setIsSyncing(true);
    try {
      // If service worker supports sync registration
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        await (registration as any).sync?.register('sync-workspace-queue');
      }
      // Simulate quick flush of client queue
      await new Promise((resolve) => setTimeout(resolve, 800));
      setPendingCount(0);
      setLastSynced(new Date());
    } catch (e) {
      console.warn('Sync trigger result:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  const formattedTime = lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
          !isOnline
            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
            : isSyncing
            ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
        }`}
        title="Network & Background Sync Status"
      >
        {!isOnline ? (
          <>
            <WifiOff className="w-3 h-3 text-amber-400" />
            <span>Offline {pendingCount > 0 && `(${pendingCount})`}</span>
          </>
        ) : isSyncing ? (
          <>
            <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" />
            <span>Syncing...</span>
          </>
        ) : (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Synced</span>
          </>
        )}
      </button>

      {showDetails && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDetails(false)}
          />
          <div className="absolute right-0 mt-2 w-64 p-3 bg-slate-900 border border-slate-800 rounded-xl shadow-xl z-50 text-xs space-y-2.5 animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-semibold text-slate-200">Sync Engine Status</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                  isOnline ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {isOnline ? 'Connected' : 'Offline'}
              </span>
            </div>

            <div className="space-y-1.5 text-slate-400">
              <div className="flex justify-between">
                <span>Network state:</span>
                <span className="text-slate-200">{isOnline ? 'Online (Broadband)' : 'Disconnected'}</span>
              </div>
              <div className="flex justify-between">
                <span>Last full sync:</span>
                <span className="text-slate-200">{formattedTime}</span>
              </div>
              <div className="flex justify-between">
                <span>Pending mutations:</span>
                <span className="text-slate-200">{pendingCount} in queue</span>
              </div>
            </div>

            <button
              onClick={() => {
                triggerSync();
                setShowDetails(false);
              }}
              disabled={!isOnline || isSyncing}
              className="w-full mt-2 flex items-center justify-center gap-1.5 py-1.5 bg-slate-800 hover:bg-slate-750 disabled:opacity-50 text-slate-200 rounded-lg font-medium transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Force Resync Now</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
