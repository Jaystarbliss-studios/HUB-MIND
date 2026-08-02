import React, { useState, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { useNavigate } from 'react-router-dom';
import { Loader2, Brain } from 'lucide-react';
import { useAuth } from '../lib/auth';

export function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  useEffect(() => {
    if (user && profile) {
      navigate('/');
    }
  }, [user, profile, navigate]);

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError(err.message || 'Failed to login');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <Brain className="w-16 h-16 text-accent mb-4" />
          <h1 className="text-2xl font-bold text-slate-100">Hub-Mind</h1>
          <p className="text-slate-400 text-sm mt-1">Operations Workspace</p>
        </div>
        
        {error && (
          <div className="p-3 mb-4 bg-red-950/50 border border-red-900/50 rounded-lg text-red-400 text-sm text-center">
            {error}
          </div>
        )}
        
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-slate-950 font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Sign In with Google
        </button>
      </div>
    </div>
  );
}
