import React, { useEffect, useState } from 'react';
import { signInWithPopup, GoogleAuthProvider, getAdditionalUserInfo, signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../lib/auth';

export function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, authorizationError } = useAuth();
  const invite = new URLSearchParams(location.search).get('invite');

  useEffect(() => {
    if (user && profile) navigate('/', { replace: true });
  }, [user, profile, navigate]);

  useEffect(() => {
    if (authorizationError) setError(authorizationError);
  }, [authorizationError]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const isNewFirebaseUser = getAdditionalUserInfo(result)?.isNewUser === true;

      if (isNewFirebaseUser && !invite) {
        await signOut(auth);
        setError('This Google account is not registered for Hub-Mind yet. Ask an administrator for an invitation before signing in.');
        setLoading(false);
        return;
      }

      if (result.user) {
        if (!isNewFirebaseUser && !invite) {
          sessionStorage.setItem('hubmind_existing_auth_login', result.user.uid);
        }
        navigate(invite ? '/login?invite=' + encodeURIComponent(invite) : '/', { replace: true });
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to sign in with Google.');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <section className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <img src="/jaystarbliss-logo.svg" alt="Hub-Mind" className="w-16 h-16 object-contain mb-4" />
          <h1 className="text-2xl font-bold text-slate-100">Hub-Mind</h1>
        </div>

        {invite && (
          <div className="mb-5 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
            <p className="text-sm text-emerald-300 font-medium">Invitation detected</p>
            <p className="text-xs text-slate-400 mt-1">Sign in with the Google account that received the invitation.</p>
          </div>
        )}

        {error && (
          <div role="alert" className="p-3 mb-5 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-100 text-slate-900 font-semibold py-3 px-4 rounded-xl disabled:opacity-60 transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
          {loading ? 'Signing in…' : 'Sign in with Google'}
        </button>
      </section>
    </main>
  );
}
