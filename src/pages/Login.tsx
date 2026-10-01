import React, { useState, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { useNavigate } from 'react-router-dom';
import { Loader2, Brain, LogIn, AlertCircle, ShieldCheck, Mail, Lock } from 'lucide-react';
import { useAuth } from '../lib/auth';

export function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, profile, authError, clearAuthError } = useAuth();

  useEffect(() => {
    if (authError) {
      setError(authError);
      setLoading(false);
    }
  }, [authError]);

  useEffect(() => {
    if (user && profile && profile.status === 'active') {
      navigate('/', { replace: true });
    }
  }, [user, profile, navigate]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    clearAuthError();

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      // The AuthProvider will verify the user document or active invitation.
    } catch (err: any) {
      console.error('Google login error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign in popup was closed. Please try again.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('Pop-up was blocked by browser. Please allow popups.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError(`Domain not authorized: "${window.location.hostname}".`);
      } else {
        setError(err.message || 'Failed to log in with Google.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center mb-4 shadow-lg shadow-teal-500/5">
            <Brain className="w-10 h-10 text-teal-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Hub-Mind</h1>
          <p className="text-slate-400 text-sm mt-1">Jaystarbliss Studios Operations</p>
        </div>

        {error && (
          <div className="p-3.5 mb-6 bg-rose-950/50 border border-rose-800/70 rounded-xl text-rose-300 text-xs flex items-start gap-2.5 leading-relaxed shadow-sm">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block">Access Restricted</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-teal-500/10 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            Sign In with Google
          </button>
        </div>

        <div className="mt-8 pt-5 border-t border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
              Invitation Gated
            </span>
            <span className="text-slate-400">v2.0 Workspace</span>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed text-center">
            Access to Hub-Mind is strictly controlled. New staff must receive an invitation from the workspace administrator prior to logging in.
          </p>
        </div>
      </div>
    </div>
  );
}
