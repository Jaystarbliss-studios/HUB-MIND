import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { LoadingProvider } from './lib/loadingContext';
import { Layout } from './components/Layout';
import { PWAPrompt } from './components/PWAPrompt';
import { Shawn } from './components/Shawn';
import { ShawnTaskStatus } from './components/ShawnTaskStatus';
import { Loader2 } from 'lucide-react';

// Lazy loaded pages
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Inbox = lazy(() => import('./pages/Inbox').then(m => ({ default: m.Inbox })));
const Tasks = lazy(() => import('./pages/Tasks').then(m => ({ default: m.Tasks })));
const TaskDetail = lazy(() => import('./pages/TaskDetail').then(m => ({ default: m.TaskDetail })));
const MeetingDetail = lazy(() => import('./pages/MeetingDetail').then(m => ({ default: m.MeetingDetail })));
const Clients = lazy(() => import('./pages/Clients').then(m => ({ default: m.Clients })));
const ClientDetail = lazy(() => import('./pages/ClientDetail').then(m => ({ default: m.ClientDetail })));
const Documents = lazy(() => import('./pages/Documents').then(m => ({ default: m.Documents })));
const DocumentEditor = lazy(() => import('./pages/DocumentEditor').then(m => ({ default: m.DocumentEditor })));
const Calendar = lazy(() => import('./pages/Calendar').then(m => ({ default: m.Calendar })));
const AdminUsers = lazy(() => import('./pages/AdminUsers').then(m => ({ default: m.AdminUsers })));
const Notifications = lazy(() => import('./pages/Notifications').then(m => ({ default: m.Notifications })));
const Projects = lazy(() => import('./pages/Projects').then(m => ({ default: m.Projects })));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail').then(m => ({ default: m.ProjectDetail })));
const Knowledge = lazy(() => import('./pages/Knowledge').then(m => ({ default: m.Knowledge })));

const LoadingScreen = () => (
  <div className="h-screen w-full flex items-center justify-center bg-slate-950 text-slate-400">
    <Loader2 className="w-8 h-8 animate-spin text-accent" />
  </div>
);

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) {
  const { user, profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  if (!user || !profile) return <Navigate to="/login" />;

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <div className="p-8 text-center text-red-400">Access Denied</div>;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <LoadingProvider>
        <BrowserRouter>
          <PWAPrompt />
          <Shawn />
          <ShawnTaskStatus />
          <Suspense fallback={<LoadingScreen />}>
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
                <Route path="clients/:id" element={<ClientDetail />} />

                <Route path="meetings/:id" element={<MeetingDetail />} />
                
                <Route path="calendar" element={<Calendar />} />

                <Route path="documents" element={<Documents />} />
                <Route path="documents/:id" element={<DocumentEditor />} />

                <Route path="notifications" element={<Notifications />} />

                <Route path="admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminUsers /></ProtectedRoute>} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </LoadingProvider>
    </AuthProvider>
  );
}
