import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { collection, query, getDocs, doc, setDoc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { getApps, getApp, initializeApp } from 'firebase/app';
import { db, auth } from '../firebaseConfig';
import firebaseConfigData from '../../firebase-applet-config.json';
import { User, Role, UserStatus, RecurringTaskTemplate } from '../types';
import { Loader2, Plus, User as UserIcon, RefreshCw, Trash2 } from 'lucide-react';
import { useUsers } from '../lib/useUsers';

export function AdminUsers() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'recurring'>('users');
  
  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);

  // Recurring state
  const [templates, setTemplates] = useState<RecurringTaskTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const { users: userLookup } = useUsers();

  // New user form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('assistant');
  const [status, setStatus] = useState<UserStatus>('active');

  // New template form
  const [tempTitle, setTempTitle] = useState('');
  const [tempDesc, setTempDesc] = useState('');
  const [tempFreq, setTempFreq] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [tempDayOfWeek, setTempDayOfWeek] = useState(1);
  const [tempDayOfMonth, setTempDayOfMonth] = useState(1);
  const [tempPriority, setTempPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [tempAssignedTo, setTempAssignedTo] = useState('');

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else {
      fetchTemplates();
    }
  }, [activeTab]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const q = query(collection(db, 'recurringTaskTemplates'));
      const snapshot = await getDocs(q);
      setTemplates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RecurringTaskTemplate)));
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);
    try {
      const newUser: Omit<User, 'id'> = {
        name,
        email,
        role,
        status,
        createdAt: new Date().toISOString()
      };
      
      await addDoc(collection(db, 'users'), newUser);
      
      alert("User created successfully!");
      setShowCreateUser(false);
      fetchUsers();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setCreatingUser(false);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTemplate(true);
    try {
      const newTemp = {
        title: tempTitle,
        description: tempDesc,
        frequency: tempFreq,
        dayOfWeek: tempFreq === 'weekly' ? tempDayOfWeek : undefined,
        dayOfMonth: tempFreq === 'monthly' ? tempDayOfMonth : undefined,
        priority: tempPriority,
        assignedTo: tempAssignedTo || undefined,
        active: true,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'recurringTaskTemplates'), newTemp);
      setShowCreateTemplate(false);
      setTempTitle('');
      setTempDesc('');
      fetchTemplates();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSavingTemplate(false);
    }
  };

  const toggleTemplateActive = async (template: RecurringTaskTemplate) => {
    try {
      await updateDoc(doc(db, 'recurringTaskTemplates', template.id), {
        active: !template.active
      });
      fetchTemplates();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await deleteDoc(doc(db, 'recurringTaskTemplates', id));
      fetchTemplates();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8 flex flex-col h-full min-h-0 pb-20 md:pb-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Admin</h1>
          <p className="text-sm text-slate-400">Manage users and system settings</p>
        </div>
      </div>

      <div className="flex gap-4 border-b border-slate-800 shrink-0 overflow-x-auto">
        <button 
          onClick={() => setActiveTab('users')}
          className={`pb-2 px-1 text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'users' ? 'text-accent border-b-2 border-accent' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Users
        </button>
        <button 
          onClick={() => setActiveTab('recurring')}
          className={`pb-2 px-1 text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'recurring' ? 'text-accent border-b-2 border-accent' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Recurring Tasks
        </button>
      </div>

      {activeTab === 'users' && (
        <div className="flex flex-col h-full min-h-0 space-y-4">
          <div className="flex justify-end shrink-0">
            <button 
              onClick={() => setShowCreateUser(!showCreateUser)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-slate-950 font-bold px-4 py-2 rounded-lg transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              {showCreateUser ? 'Cancel' : 'Add User'}
            </button>
          </div>

          {showCreateUser && (
            <form onSubmit={handleCreateUser} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 shrink-0">
              <h2 className="font-semibold text-lg text-white">Create New User</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Full Name</label>
                  <input required type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-200 focus:border-accent focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                  <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-200 focus:border-accent focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Role</label>
                  <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-200 focus:border-accent focus:outline-none">
                    <option value="assistant">Assistant</option>
                    <option value="admin">Admin</option>
                    <option value="teacher">Teacher</option>
                    <option value="staff">Staff</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as UserStatus)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-200 focus:border-accent focus:outline-none">
                    <option value="active">Active</option>
                    <option value="training">Training</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              
              <button type="submit" disabled={creatingUser} className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-slate-950 font-bold px-4 py-2 rounded-lg transition-colors text-sm mt-6">
                {creatingUser && <Loader2 className="w-4 h-4 animate-spin" />}
                Create User
              </button>
            </form>
          )}

          {loadingUsers ? (
            <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col min-h-0 flex-1">
              <div className="divide-y divide-slate-800 overflow-y-auto">
                {users.map(u => (
                  <div key={u.id} className="p-4 md:p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700 shrink-0">
                        <UserIcon className="w-5 h-5 text-slate-400" />
                      </div>
                      <div className="min-w-0 pr-4">
                        <h3 className="font-semibold text-slate-200 truncate">{u.name}</h3>
                        <p className="text-xs text-slate-500 font-medium truncate">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-col md:flex-row items-end md:items-center gap-2 shrink-0">
                      <select 
                        value={u.role} 
                        onChange={async (e) => {
                          const newRole = e.target.value;
                          try {
                            await updateDoc(doc(db, 'users', u.id), { role: newRole });
                            fetchUsers();
                          } catch (err) {
                            console.error(err);
                            alert("Failed to update role");
                          }
                        }}
                        className="text-xs font-bold px-2 py-1 rounded uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700 focus:outline-none"
                      >
                        <option value="admin">Admin</option>
                        <option value="assistant">Assistant</option>
                        <option value="teacher">Teacher</option>
                        <option value="staff">Staff</option>
                      </select>
                      <select 
                        value={u.status} 
                        onChange={async (e) => {
                          const newStatus = e.target.value;
                          try {
                            await updateDoc(doc(db, 'users', u.id), { status: newStatus });
                            fetchUsers();
                          } catch (err) {
                            console.error(err);
                            alert("Failed to update status");
                          }
                        }}
                        className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wider focus:outline-none ${
                          u.status === 'active' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30' :
                          u.status === 'training' ? 'text-amber-400 bg-amber-500/10 border border-amber-500/30' :
                          'text-slate-400 bg-slate-800 border border-slate-700'
                        }`}
                      >
                        <option value="active">Active</option>
                        <option value="training">Training</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'recurring' && (
        <div className="flex flex-col h-full min-h-0 space-y-4">
          <div className="flex justify-between items-center shrink-0">
            <p className="text-sm text-slate-400">Templates generate tasks automatically on login.</p>
            <button 
              onClick={() => setShowCreateTemplate(!showCreateTemplate)}
              className="flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-slate-950 font-bold px-4 py-2 rounded-lg transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{showCreateTemplate ? 'Cancel' : 'New Template'}</span>
            </button>
          </div>

          {showCreateTemplate && (
            <form onSubmit={handleCreateTemplate} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 shrink-0">
              <h2 className="font-semibold text-lg text-white">Create Template</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-1">Task Title</label>
                  <input required type="text" value={tempTitle} onChange={(e) => setTempTitle(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-200 focus:border-accent focus:outline-none" />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Frequency</label>
                  <select value={tempFreq} onChange={(e) => setTempFreq(e.target.value as any)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-200 focus:border-accent focus:outline-none">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                
                {tempFreq === 'weekly' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Day of Week</label>
                    <select value={tempDayOfWeek} onChange={(e) => setTempDayOfWeek(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-200 focus:border-accent focus:outline-none">
                      <option value="1">Monday</option>
                      <option value="2">Tuesday</option>
                      <option value="3">Wednesday</option>
                      <option value="4">Thursday</option>
                      <option value="5">Friday</option>
                      <option value="6">Saturday</option>
                      <option value="0">Sunday</option>
                    </select>
                  </div>
                )}
                
                {tempFreq === 'monthly' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Day of Month</label>
                    <input type="number" min="1" max="31" value={tempDayOfMonth} onChange={(e) => setTempDayOfMonth(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-200 focus:border-accent focus:outline-none" />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Priority</label>
                  <select value={tempPriority} onChange={(e) => setTempPriority(e.target.value as any)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-200 focus:border-accent focus:outline-none">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Assign To (Optional User ID)</label>
                  <select value={tempAssignedTo} onChange={(e) => setTempAssignedTo(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-200 focus:border-accent focus:outline-none">
                    <option value="">-- System/Unassigned --</option>
                    {Object.entries(userLookup).map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <button type="submit" disabled={savingTemplate} className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-slate-950 font-bold px-4 py-2 rounded-lg transition-colors text-sm mt-6">
                {savingTemplate && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Template
              </button>
            </form>
          )}

          {loadingTemplates ? (
            <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col min-h-0 flex-1">
              {templates.length === 0 ? (
                <div className="p-12 text-center text-slate-500">No recurring templates setup.</div>
              ) : (
                <div className="divide-y divide-slate-800 overflow-y-auto">
                  {templates.map(t => (
                    <div key={t.id} className={`p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${!t.active ? 'opacity-50 bg-slate-950/50' : 'hover:bg-slate-800/30'}`}>
                      <div className="flex items-start gap-4 min-w-0">
                        <div className="p-3 bg-slate-800 rounded-xl text-slate-400 shrink-0">
                          <RefreshCw className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-slate-200 truncate pr-4">{t.title}</h3>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs font-bold uppercase tracking-wider">
                            <span className="text-accent">{t.frequency}</span>
                            {t.frequency === 'weekly' && <span className="text-slate-400 border border-slate-700 px-1 rounded">Day {t.dayOfWeek}</span>}
                            {t.frequency === 'monthly' && <span className="text-slate-400 border border-slate-700 px-1 rounded">Day {t.dayOfMonth}</span>}
                            <span className="text-slate-500 bg-slate-950 px-1 rounded">{t.priority}</span>
                            {t.assignedTo && <span className="text-emerald-400 border border-emerald-900 px-1 rounded truncate max-w-[100px]">{userLookup[t.assignedTo] || 'User'}</span>}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-14 sm:ml-0 shrink-0 mt-2 sm:mt-0">
                        <button 
                          onClick={() => toggleTemplateActive(t)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${t.active ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'}`}
                        >
                          {t.active ? 'Pause' : 'Resume'}
                        </button>
                        <button 
                          onClick={() => deleteTemplate(t.id)}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
