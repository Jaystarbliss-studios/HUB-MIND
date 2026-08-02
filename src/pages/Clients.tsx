import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Client } from '../types';
import { Loader2, Plus, Search, Building2, User, Users as UsersIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUsers } from '../lib/useUsers';
import { getThumbnailUrl } from '../lib/cloudinary';

export function Clients() {
  const { profile } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { users } = useUsers();

  useEffect(() => {
    const fetchClients = async () => {
      setLoading(true);
      try {
        let q;
        if (profile?.role === 'admin' || profile?.role === 'assistant') {
          q = query(collection(db, 'clients'), orderBy('name'));
        } else {
          q = query(collection(db, 'clients'), where('ownerId', '==', profile?.id));
        }
        const snapshot = await getDocs(q);
        let data = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Client));
        if (profile?.role !== 'admin' && profile?.role !== 'assistant') {
          data = data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        }
        setClients(data);
      } catch (error) {
        console.error("Error fetching clients:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, []);

  const filteredClients = clients.filter(c => 
    (c.name || '').toLowerCase().includes(search.toLowerCase()) || 
    (c.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const getClientIcon = (type: string) => {
    switch (type) {
      case 'school': return <Building2 className="w-5 h-5 text-indigo-400" />;
      case 'parent': return <User className="w-5 h-5 text-emerald-400" />;
      default: return <UsersIcon className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8 flex flex-col h-full min-h-0 pb-20 md:pb-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Clients</h1>
          <p className="text-sm text-slate-400">Manage partners, schools, and parents</p>
        </div>
        
        {(profile?.role === 'admin' || profile?.role === 'assistant') && (
          <button className="w-full sm:w-auto flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-slate-950 font-bold px-4 py-2 rounded-lg transition-colors text-sm">
            <Plus className="w-4 h-4" />
            New Client
          </button>
        )}
      </div>

      <div className="relative shrink-0">
        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input 
          type="text"
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 overflow-y-auto flex-1 min-h-0 pb-4">
          {filteredClients.map(client => (
            <Link key={client.id} to={`/clients/${client.id}`} className="block h-full">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 md:p-6 hover:border-accent/50 transition-colors h-full flex flex-col relative">
                <div className="flex items-start gap-4 mb-4">
                  {client.photoUrl ? (
                    <img src={getThumbnailUrl(client.photoUrl, 64, 64)} alt="" className="w-12 h-12 rounded-xl object-cover border border-slate-700" loading="lazy" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700 shrink-0">
                      {getClientIcon(client.type)}
                    </div>
                  )}
                  <div className="min-w-0 pr-8">
                    <h3 className="font-semibold text-slate-200 truncate">{client.name}</h3>
                    <span className="text-xs font-bold uppercase tracking-wider text-accent">{client.type}</span>
                  </div>
                </div>
                
                {client.ownerId && (
                  <div className="absolute top-4 right-4 bg-slate-800 px-2 py-1 rounded text-[10px] font-bold text-slate-400">
                    {users[client.ownerId] ? (
      <span className="flex items-center gap-1.5">
        {users[client.ownerId].photoUrl ? (
          <img src={users[client.ownerId].photoUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
        ) : (
          <span className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[8px] text-white font-bold">{users[client.ownerId].name.charAt(0)}</span>
        )}
        {users[client.ownerId].name}
      </span>
    ) : 'Owner'}
                  </div>
                )}
                
                <div className="mt-auto pt-4 border-t border-slate-800 space-y-2 text-sm text-slate-400">
                  {client.email && <p className="truncate flex items-center gap-2"><span className="text-slate-500">•</span> {client.email}</p>}
                  {client.phone && <p className="flex items-center gap-2"><span className="text-slate-500">•</span> {client.phone}</p>}
                </div>
              </div>
            </Link>
          ))}
          {filteredClients.length === 0 && (
            <div className="col-span-full p-12 text-center text-slate-500 bg-slate-900 rounded-2xl border border-slate-800">
              No clients found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
