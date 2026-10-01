import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { User, UserInvitation, ActivityLog } from '../types';
import { subscribeToUsers, updateUserStatus, isUsernameAvailable, normalizeUsername, extractHandleFromEmail } from '../services/userService';
import { createInvitation, revokeInvitation, subscribeToInvitations } from '../services/invitationService';
import { subscribeToActivityLogs } from '../services/activityService';
import { 
  Shield, 
  Users, 
  UserPlus, 
  Mail, 
  AtSign, 
  Phone, 
  Copy, 
  Check, 
  AlertCircle, 
  Ban, 
  UserCheck, 
  Trash2, 
  Activity, 
  Calendar, 
  Settings, 
  Sparkles,
  Loader2,
  Clock,
  ExternalLink
} from 'lucide-react';

export function AdminUsers() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<UserInvitation[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [activeTab, setActiveTab] = useState<'people' | 'invitations' | 'audit' | 'settings'>('people');

  // Invitation form
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteDisplayName, setInviteDisplayName] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const unsubUsers = subscribeToUsers(setUsers);
    const unsubInvites = subscribeToInvitations(setInvitations);
    const unsubLogs = subscribeToActivityLogs(setActivityLogs, 100);
    return () => {
      unsubUsers();
      unsubInvites();
      unsubLogs();
    };
  }, []);

  if (profile?.role !== 'admin') {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <Shield className="w-12 h-12 text-rose-500 mx-auto" />
        <h1 className="text-xl font-bold text-slate-100">Access Restricted</h1>
        <p className="text-slate-400 text-sm">
          The Admin Centre is restricted to workspace administrators.
        </p>
      </div>
    );
  }

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteError('');
    setInviteSuccess('');

    try {
      if (!inviteEmail || !inviteUsername) {
        throw new Error('Email and Username are required.');
      }

      await createInvitation({
        email: inviteEmail,
        username: inviteUsername,
        displayName: inviteDisplayName || inviteUsername,
        phone: invitePhone,
        invitedBy: profile.email,
      });

      setInviteSuccess(`Invitation created for ${inviteEmail} (@${normalizeUsername(inviteUsername)})!`);
      setInviteEmail('');
      setInviteUsername('');
      setInviteDisplayName('');
      setInvitePhone('');
      setShowInviteModal(false);
    } catch (err: any) {
      setInviteError(err.message || 'Failed to create invitation.');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    const nextStatus = user.status === 'active' ? 'suspended' : 'active';
    try {
      await updateUserStatus(user.id, nextStatus);
    } catch (err: any) {
      alert(`Error updating user status: ${err.message}`);
    }
  };

  const handleRevokeInvite = async (invitationId: string) => {
    if (!confirm('Are you sure you want to revoke this invitation?')) return;
    try {
      await revokeInvitation(invitationId);
    } catch (err: any) {
      alert(`Error revoking invitation: ${err.message}`);
    }
  };

  const copyInviteLink = (invite: UserInvitation) => {
    const link = `${window.location.origin}/login?invited=${encodeURIComponent(invite.email)}`;
    navigator.clipboard.writeText(link);
    setCopiedId(invite.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <Shield className="w-7 h-7 text-teal-400" />
            Admin Centre
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage organization members, invitation onboarding, audit logs, and workspace policies.
          </p>
        </div>

        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-teal-500/10 text-xs cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Invite New User
        </button>
      </div>

      {inviteSuccess && (
        <div className="p-3.5 bg-teal-950/40 border border-teal-800 text-teal-300 rounded-xl text-xs flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{inviteSuccess}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-6 text-sm">
        <button
          onClick={() => setActiveTab('people')}
          className={`pb-3 font-medium transition-colors cursor-pointer relative ${
            activeTab === 'people' ? 'text-teal-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Active Members ({users.length})
          {activeTab === 'people' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-400" />}
        </button>
        <button
          onClick={() => setActiveTab('invitations')}
          className={`pb-3 font-medium transition-colors cursor-pointer relative ${
            activeTab === 'invitations' ? 'text-teal-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Invitations ({invitations.filter(i => i.status === 'invited').length})
          {activeTab === 'invitations' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-400" />}
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 font-medium transition-colors cursor-pointer relative ${
            activeTab === 'audit' ? 'text-teal-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Audit Logs
          {activeTab === 'audit' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-400" />}
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`pb-3 font-medium transition-colors cursor-pointer relative ${
            activeTab === 'settings' ? 'text-teal-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Workspace Settings
          {activeTab === 'settings' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-400" />}
        </button>
      </div>

      {/* Tab: People */}
      {activeTab === 'people' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">User</th>
                  <th className="py-3.5 px-4 font-semibold">Handle</th>
                  <th className="py-3.5 px-4 font-semibold">Email</th>
                  <th className="py-3.5 px-4 font-semibold">Role</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 text-teal-400 font-bold flex items-center justify-center text-xs border border-slate-700">
                          {u.displayName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div className="font-medium text-slate-100">{u.displayName}</div>
                          {u.phone && <div className="text-[11px] text-slate-500">{u.phone}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-teal-400 text-xs">
                      @{u.username}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 text-xs font-mono">
                      {u.email}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                        u.role === 'admin' 
                          ? 'bg-teal-500/10 text-teal-300 border border-teal-500/20' 
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize ${
                        u.status === 'active' 
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60' 
                          : 'bg-rose-950/60 text-rose-400 border border-rose-800/60'
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {u.role !== 'admin' && (
                        <button
                          onClick={() => handleToggleUserStatus(u)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            u.status === 'active'
                              ? 'bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 border border-rose-800/60'
                              : 'bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 border border-emerald-800/60'
                          }`}
                        >
                          {u.status === 'active' ? 'Suspend' : 'Reactivate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Invitations */}
      {activeTab === 'invitations' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4 font-semibold">Email</th>
                    <th className="py-3.5 px-4 font-semibold">Assigned @Username</th>
                    <th className="py-3.5 px-4 font-semibold">Display Name</th>
                    <th className="py-3.5 px-4 font-semibold">Status</th>
                    <th className="py-3.5 px-4 font-semibold">Expires</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 text-slate-200 font-mono text-xs font-medium">
                        {inv.email}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-teal-400 text-xs">
                        @{inv.username}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 text-xs">
                        {inv.displayName}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize ${
                          inv.status === 'invited'
                            ? 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                            : inv.status === 'accepted'
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 text-xs">
                        {inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        {inv.status === 'invited' && (
                          <>
                            <button
                              onClick={() => copyInviteLink(inv)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium inline-flex items-center gap-1 transition-all cursor-pointer"
                            >
                              {copiedId === inv.id ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
                              {copiedId === inv.id ? 'Copied' : 'Copy Link'}
                            </button>
                            <button
                              onClick={() => handleRevokeInvite(inv.id)}
                              className="px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 text-xs font-medium inline-flex items-center gap-1 transition-all border border-rose-800/60 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Revoke
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {invitations.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                        No invitations created yet. Click "Invite New User" to issue access.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Audit Log */}
      {activeTab === 'audit' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-400" />
              Workspace Activity & Audit Trail
            </h2>
            <span className="text-xs text-slate-500">Live 100 recent events</span>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {activityLogs.map((log) => (
              <div key={log.id} className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-start justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200">
                      {log.userDisplayName || log.username || 'System'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] uppercase font-mono">
                      {log.entityType}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-teal-950 text-teal-400 text-[10px] font-semibold uppercase">
                      {log.action}
                    </span>
                  </div>
                  <p className="text-slate-300">{log.details}</p>
                </div>
                <div className="text-[11px] text-slate-500 whitespace-nowrap flex items-center gap-1 shrink-0">
                  <Clock className="w-3 h-3" />
                  {new Date(log.createdAt).toLocaleTimeString()}
                </div>
              </div>
            ))}
            {activityLogs.length === 0 && (
              <p className="text-slate-500 text-xs text-center py-6">No activity recorded yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Tab: Workspace Settings */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Settings className="w-5 h-5 text-teal-400" />
              Organization & Security
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                <div className="text-xs text-slate-400">Organization Name</div>
                <div className="text-sm font-semibold text-slate-100">Jaystarbliss Studios</div>
              </div>

              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                <div className="text-xs text-slate-400">Admin Owner</div>
                <div className="text-sm font-semibold text-teal-400 font-mono">johnrufai242@gmail.com</div>
              </div>

              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                <div className="text-xs text-slate-400">Access Mode</div>
                <div className="text-sm font-semibold text-slate-100">Strict Invitation Gating (No Auto-Admission)</div>
              </div>

              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                <div className="text-xs text-slate-400">Role Model</div>
                <div className="text-sm font-semibold text-slate-100">Admin & Staff (Resource-Centric Sharing)</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Invite User */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-teal-400" />
                Invite New Workspace Member
              </h2>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {inviteError && (
              <div className="p-3 bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{inviteError}</span>
              </div>
            )}

            <form onSubmit={handleCreateInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Google Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => {
                      const newEmail = e.target.value;
                      setInviteEmail(newEmail);
                      if (!inviteUsername || inviteUsername === extractHandleFromEmail(inviteEmail)) {
                        setInviteUsername(extractHandleFromEmail(newEmail));
                      }
                    }}
                    placeholder="e.g. colleague@gmail.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500/60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Unique Username (@handle) *
                </label>
                <div className="relative">
                  <AtSign className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={inviteUsername}
                    onChange={(e) => setInviteUsername(e.target.value)}
                    placeholder="e.g. mary or alex_w"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-teal-500/60"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Colleagues will mention and share resources with @{inviteUsername ? normalizeUsername(inviteUsername) : 'username'}.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={inviteDisplayName}
                  onChange={(e) => setInviteDisplayName(e.target.value)}
                  placeholder="e.g. Mary Watson"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500/60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Phone (Optional)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={invitePhone}
                    onChange={(e) => setInvitePhone(e.target.value)}
                    placeholder="+234..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500/60"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2.5 text-xs text-slate-400 hover:text-slate-200 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold px-5 py-2.5 rounded-xl text-xs transition-all shadow-md shadow-teal-500/10 disabled:opacity-60 cursor-pointer"
                >
                  {inviteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Create & Issue Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
