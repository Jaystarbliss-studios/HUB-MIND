import React, { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { X, Download, Smartphone } from 'lucide-react';

export function PWAPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if iOS
    const isIosDevice = /ipad|iphone|ipod/.test(navigator.userAgent.toLowerCase()) && !(window as any).MSStream;
    setIsIOS(isIosDevice);

    // Check if standalone (already installed)
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone || document.referrer.includes('android-app://');
    setIsStandalone(isStandaloneMode);

    if (isIosDevice && !isStandaloneMode) {
      // Show iOS prompt after a small delay
      const timer = setTimeout(() => {
        const hasSeenPrompt = localStorage.getItem('iosPwaPromptSeen');
        if (!hasSeenPrompt) {
          setShowInstallPrompt(true);
        }
      }, 3000);
      return () => clearTimeout(timer);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const closePrompt = () => {
    setShowInstallPrompt(false);
    setOfflineReady(false);
    setNeedRefresh(false);
    if (isIOS) {
      localStorage.setItem('iosPwaPromptSeen', 'true');
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  if (isStandalone) return null;

  return (
    <>
      {/* Update Prompt */}
      { (offlineReady || needRefresh) && (
        <div className="fixed bottom-4 right-4 z-[100] bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-2xl max-w-sm w-[calc(100%-2rem)] flex flex-col gap-3 animate-in slide-in-from-bottom-5">
          <div className="flex justify-between items-start gap-4">
            <div>
              <h3 className="font-semibold text-white">
                {offlineReady ? 'App ready to work offline' : 'New version available'}
              </h3>
              <p className="text-sm text-slate-300 mt-1">
                {offlineReady 
                  ? 'Hub-Mind is now cached for offline use.' 
                  : 'A new update is available. Reload to update.'}
              </p>
            </div>
            <button onClick={closePrompt} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          {needRefresh && (
            <button 
              onClick={() => updateServiceWorker(true)}
              className="w-full bg-accent hover:bg-accent/90 text-slate-950 font-semibold py-2 rounded-lg transition-colors"
            >
              Reload and Update
            </button>
          )}
        </div>
      )}

      {/* Install Prompt for non-iOS or custom install button */}
      {showInstallPrompt && deferredPrompt && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:w-96 z-[100] bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-2xl flex flex-col gap-3 animate-in slide-in-from-bottom-5">
          <div className="flex items-start gap-3">
            <div className="bg-slate-900 p-2 rounded-lg shrink-0">
              <Download className="w-6 h-6 text-accent" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white">Install Hub-Mind</h3>
              <p className="text-sm text-slate-300 mt-1">Install our app for a better experience, offline access, and quick launching.</p>
            </div>
            <button onClick={closePrompt} className="text-slate-400 hover:text-white shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
          <button 
            onClick={handleInstallClick}
            className="w-full bg-accent hover:bg-accent/90 text-slate-950 font-semibold py-2 rounded-lg transition-colors mt-1"
          >
            Install App
          </button>
        </div>
      )}

      {/* iOS Install Prompt */}
      {showInstallPrompt && isIOS && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:w-96 z-[100] bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-2xl flex flex-col gap-3 animate-in slide-in-from-bottom-5">
          <div className="flex items-start justify-between mb-1">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-accent" />
              Install Hub-Mind
            </h3>
            <button onClick={closePrompt} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-slate-300">
            Install this application on your home screen for quick and easy access when you're on the go.
          </p>
          <div className="bg-slate-900 rounded-lg p-3 text-sm text-slate-200 flex flex-col gap-2 border border-slate-700">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded bg-slate-800 text-xs font-bold text-slate-400">1</span>
              <span>Tap the <b className="text-white">Share</b> icon at the bottom</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded bg-slate-800 text-xs font-bold text-slate-400">2</span>
              <span>Scroll and tap <b className="text-white">Add to Home Screen</b></span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
