import React, { useState, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider, signInAnonymously } from 'firebase/auth';
import { auth, FIRESTORE_DATABASE_ID } from '../firebaseConfig';
import firebaseConfig from '../../firebase-applet-config.json';
import { useNavigate } from 'react-router-dom';
import { Loader2, Brain, LogIn, AlertCircle, Copy, Check, Database, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/auth';

export function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  useEffect(() => {
    if (user && profile) {
      navigate('/', { replace: true });
    }
  }, [user, profile, navigate]);

  useEffect(() => {
    const handleAuthError = (e: any) => {
      setError(e.detail || 'Authentication error');
      setLoading(false);
    };
    window.addEventListener('auth-error', handleAuthError);
    return () => window.removeEventListener('auth-error', handleAuthError);
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      // The popup has completed successfully. Move immediately to the protected
      // shell; AuthProvider will finish hydrating the Firestore profile while
      // ProtectedRoute displays its loading state. This avoids leaving the user
      // stranded on /login while the auth observer catches up.
      if (result.user) navigate('/', { replace: true });
    } catch (err: any) {
      console.error('Google login error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign in popup was closed before completing. Please try again.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('Pop-up was blocked by browser. Please allow popups in your browser address bar.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError(`Domain not authorized: "${window.location.hostname}". Please add this domain to Firebase Console -> Authentication -> Settings -> Authorized domains.`);
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Google sign-in provider is not enabled. In Firebase Console, go to Build -> Authentication -> Sign-in method, click Google, and enable it.');
      } else {
        setError(err.message || 'Failed to log in with Google.');
      }
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signInAnonymously(auth);
      if (result.user) navigate('/', { replace: true });
    } catch (err: any) {
      console.error('Guest login error:', err);
      if (err.code === 'auth/operation-not-allowed' || err.code === 'auth/admin-restricted-operation') {
        setError('Anonymous sign-in is not enabled. In Firebase Console, go to Build -> Authentication -> Sign-in method, click Anonymous, and enable it.');
      } else {
        setError(err.message || 'Guest sign-in failed');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center mb-4">
            <Brain className="w-10 h-10 text-teal-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Hub-Mind</h1>
          <p className="text-slate-400 text-sm mt-1">Operations Workspace</p>
        </div>
        
        {error && (
          <div className="p-3 mb-6 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-start gap-2 leading-relaxed">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        
        <div className="space-y-3">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-teal-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            Sign In with Google
          </button>

          <button
            onClick={handleQuickDemoLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2.5 px-4 rounded-xl transition-all border border-slate-700/60 text-xs disabled:opacity-60"
          >
            Continue as Guest / Demo
          </button>
        </div>

        <div className="mt-6 pt-5 border-t border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
              Connected Project
            </span>
            <span className="font-mono text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/50">
              {firebaseConfig.projectId}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Database className="w-3.5 h-3.5 text-teal-400" />
              Database
            </span>
            <span className="font-mono text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/50 max-w-[150px] truncate" title={FIRESTORE_DATABASE_ID}>
              {FIRESTORE_DATABASE_ID}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(window.location.hostname);
              setCopiedDomain(true);
              setTimeout(() => setCopiedDomain(false), 2500);
            }}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-slate-800/40 hover:bg-slate-800 border border-slate-700/40 text-[11px] text-slate-400 hover:text-slate-300 transition-colors"
          >
            {copiedDomain ? <Check className="w-3 h-3 text-teal-400" /> : <Copy className="w-3 h-3 text-slate-500" />}
            <span>{copiedDomain ? 'Domain Copied to Clipboard' : 'Copy Preview Domain for Firebase Auth'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

