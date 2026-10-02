import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { 
  X, 
  User as UserIcon, 
  AtSign, 
  Phone, 
  Image as ImageIcon, 
  Shield, 
  Check, 
  AlertCircle, 
  Loader2, 
  Sparkles, 
  Lock, 
  Globe, 
  Users,
  Camera,
  RefreshCw,
  Calendar as CalendarIcon,
  Link2,
  Unlink
} from 'lucide-react';
import { isUsernameAvailable, normalizeUsername, extractHandleFromEmail } from '../services/userService';
import { ResourceVisibility } from '../types';
import { 
  connectGoogleCalendarOnce, 
  disconnectGoogleCalendar, 
  getGoogleCalendarConnectionInfo 
} from '../lib/googleCalendar';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { user, profile, updateProfileData } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [defaultVisibility, setDefaultVisibility] = useState<ResourceVisibility>('private');

  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameFeedback, setUsernameFeedback] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Initialize values when modal opens or profile changes
  useEffect(() => {
    if (profile && isOpen) {
      setDisplayName(profile.displayName || profile.name || '');
      setUsername(profile.username || extractHandleFromEmail(profile.email, profile.displayName));
      setPhotoUrl(profile.photoUrl || user?.photoURL || '');
      setPhone(profile.phone || '');
      setPreferredName(profile.preferredName || '');
      setDefaultVisibility(profile.defaultVisibility || 'private');
      setUsernameAvailable(true);
      setUsernameFeedback('');
      setSaveSuccess(false);
      setSaveError(null);
    }
  }, [profile, isOpen, user?.photoURL]);

  // Real-time username availability check (debounced)
  useEffect(() => {
    if (!profile || !username) return;

    const normalized = normalizeUsername(username);
    if (normalized === profile.username) {
      setUsernameAvailable(true);
      setUsernameFeedback('Current username');
      setCheckingUsername(false);
      return;
    }

    if (normalized.length < 3) {
      setUsernameAvailable(false);
      setUsernameFeedback('Must be at least 3 characters');
      setCheckingUsername(false);
      return;
    }

    setCheckingUsername(true);
    const timeout = setTimeout(async () => {
      try {
        const available = await isUsernameAvailable(normalized, profile.id);
        setUsernameAvailable(available);
        setUsernameFeedback(available ? `@${normalized} is available!` : `@${normalized} is already taken`);
      } catch (err) {
        console.warn('Username check error:', err);
      } finally {
        setCheckingUsername(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [username, profile]);

  if (!isOpen || !profile) return null;

  const handleUseGooglePhoto = () => {
    if (user?.photoURL) {
      setPhotoUrl(user.photoURL);
    }
  };

  const handleResetToInitials = () => {
    setPhotoUrl('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const cleanDisplayName = displayName.trim();
    const cleanUsername = normalizeUsername(username);

    if (!cleanDisplayName) {
      setSaveError('Display name is required.');
      return;
    }

    if (cleanUsername.length < 3) {
      setSaveError('Username must be at least 3 characters long.');
      return;
    }

    if (usernameAvailable === false && cleanUsername !== profile.username) {
      setSaveError(`@${cleanUsername} is already taken. Please choose another.`);
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await updateProfileData({
        displayName: cleanDisplayName,
        username: cleanUsername,
        photoUrl: photoUrl.trim() || undefined,
        phone: phone.trim() || undefined,
        preferredName: preferredName.trim() || undefined,
        defaultVisibility,
      });

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 900);
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      setSaveError(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const initials = (displayName || profile.displayName || profile.username || '?').charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Account & Profile Settings
                {profile.role === 'admin' && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Admin
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Customize how your name, Google picture, and @handle appear across Hub-Mind.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          
          {saveError && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{saveError}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3.5 rounded-xl bg-teal-950/60 border border-teal-800 text-teal-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-teal-400" />
              <span>Profile updated successfully!</span>
            </div>
          )}

          {/* Avatar Section */}
          <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <div className="relative group shrink-0">
              {photoUrl ? (
                <img 
                  src={photoUrl} 
                  alt={displayName} 
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-teal-500/40 shadow-md"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-500/20 to-slate-800 border-2 border-slate-700 flex items-center justify-center text-2xl font-bold text-teal-300">
                  {initials}
                </div>
              )}
            </div>

            <div className="flex-1 space-y-2 text-center sm:text-left">
              <div className="text-xs font-semibold text-slate-200">User Account Picture</div>
              <p className="text-[11px] text-slate-400">
                Connected to your Google Account (<span className="text-slate-300 font-mono">{profile.email}</span>).
              </p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                {user?.photoURL && photoUrl !== user.photoURL && (
                  <button
                    type="button"
                    onClick={handleUseGooglePhoto}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 text-teal-300 hover:bg-slate-700 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Use Google Photo
                  </button>
                )}
                {photoUrl && (
                  <button
                    type="button"
                    onClick={handleResetToInitials}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:text-rose-300 hover:bg-rose-500/10 border border-slate-700 transition-colors cursor-pointer"
                  >
                    Use Initials Avatar
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Full Display Name
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g., John Rufai"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-teal-400 transition-colors"
                required
              />
            </div>
          </div>

          {/* Username (@handle) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Username / Handle
              </label>
              <span className="text-[11px] text-slate-500">
                Used for tagging & sharing (e.g. <span className="text-teal-400 font-mono">@{normalizeUsername(username) || 'handle'}</span>)
              </span>
            </div>

            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-teal-400 font-mono font-bold text-sm">
                @
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="john"
                className={`w-full bg-slate-950 border rounded-xl pl-9 pr-10 py-2.5 text-sm text-white font-mono focus:outline-none transition-colors ${
                  usernameAvailable === true 
                    ? 'border-teal-500/60 focus:border-teal-400' 
                    : usernameAvailable === false 
                    ? 'border-rose-500/60 focus:border-rose-400' 
                    : 'border-slate-800 focus:border-teal-400'
                }`}
                required
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                {checkingUsername ? (
                  <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                ) : usernameAvailable === true ? (
                  <Check className="w-4 h-4 text-teal-400" />
                ) : usernameAvailable === false ? (
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                ) : null}
              </div>
            </div>

            {usernameFeedback && (
              <p className={`text-[11px] mt-1.5 font-medium ${
                usernameAvailable ? 'text-teal-400' : 'text-rose-400'
              }`}>
                {usernameFeedback}
              </p>
            )}
          </div>

          {/* Optional Phone / WhatsApp */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Phone / WhatsApp (Optional)
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+234 ... or 080..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-teal-400 transition-colors"
              />
            </div>
          </div>

          {/* Default Resource Visibility */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Default Privacy for New Documents & Tasks
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDefaultVisibility('private')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  defaultVisibility === 'private'
                    ? 'bg-teal-500/10 border-teal-500/40 text-teal-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-xs mb-1">
                  <Lock className="w-3.5 h-3.5" />
                  Private (Only Me)
                </div>
                <div className="text-[10px] text-slate-400">
                  Visible only to you until explicitly shared.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDefaultVisibility('workspace')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  defaultVisibility === 'workspace'
                    ? 'bg-teal-500/10 border-teal-500/40 text-teal-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-xs mb-1">
                  <Globe className="w-3.5 h-3.5" />
                  Workspace
                </div>
                <div className="text-[10px] text-slate-400">
                  Instantly accessible to all Hub-Mind staff.
                </div>
              </button>
            </div>
          </div>

          {/* Google Calendar One-Time Connection */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-teal-400" />
                <span className="text-xs font-bold text-slate-200">Google Calendar One-Time Sync</span>
              </div>
              {getGoogleCalendarConnectionInfo().connected ? (
                <span className="text-[10px] bg-teal-950 border border-teal-800 text-teal-300 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                  <Check className="w-3 h-3" /> Connected
                </span>
              ) : (
                <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                  Not Connected
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Connect once to allow Jess and Hub-Mind to synchronize meetings, tasks, and recurring schedules directly to your Google Calendar.
            </p>
            <div className="pt-1 flex items-center justify-end">
              {getGoogleCalendarConnectionInfo().connected ? (
                <button
                  type="button"
                  onClick={async () => {
                    await disconnectGoogleCalendar();
                    setSaveSuccess(true);
                  }}
                  className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Unlink className="w-3 h-3" /> Disconnect Google Calendar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    const res = await connectGoogleCalendarOnce();
                    if (res.success) setSaveSuccess(true);
                    else setSaveError(res.message);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-teal-500/30 text-teal-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Link2 className="w-3.5 h-3.5 text-teal-400" /> Connect Google Calendar Once
                </button>
              )}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || (usernameAvailable === false && normalizeUsername(username) !== profile.username)}
              className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-teal-400 hover:bg-teal-300 transition-colors flex items-center gap-2 cursor-pointer shadow-md shadow-teal-500/20 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Save Changes
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
