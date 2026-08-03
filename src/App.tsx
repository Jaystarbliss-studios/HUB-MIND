/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Inbox } from './pages/Inbox';
import { Tasks } from './pages/Tasks';
import { TaskDetail } from './pages/TaskDetail';
import { MeetingDetail } from './pages/MeetingDetail';
import { Clients } from './pages/Clients';
import { Documents } from './pages/Documents';
import { Calendar } from './pages/Calendar';
import { AdminUsers } from './pages/AdminUsers';
import { Notifications } from './pages/Notifications';
import { Projects } from './pages/Projects';
import { ProjectDetail } from './pages/ProjectDetail';
import { Knowledge } from './pages/Knowledge';


import { useLocation, useNavigate } from 'react-router-dom';




function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) {
  const { user, profile, loading } = useAuth();

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-950 text-slate-400">Loading...</div>;
  if (!user || !profile) return <Navigate to="/login" />;
  
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <div className="p-8 text-center text-red-400">Access Denied</div>;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            
            <Route path="inbox" element={<Inbox />} />
            
            <Route path="tasks" element={<Tasks />} />
            <Route path="tasks/:id" element={<TaskDetail />} />
            
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="knowledge" element={<Knowledge />} />
            <Route path="clients" element={<Clients />} />
            <Route path="clients/:id" element={<div className="p-6">Client Detail (Coming Soon)</div>} />
            <Route path="meetings/:id" element={<MeetingDetail />} />
            
            <Route path="calendar" element={<Calendar />} />
            <Route path="documents" element={<Documents />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminUsers /></ProtectedRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}


