import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from './store';
import { logout } from './store/authSlice';
import Login from './pages/Login';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import TaskManagement from './pages/TaskManagement';
import AnnotationPage from './pages/AnnotationPage';
import QAReview from './pages/QAReview';
import AuditLogsPage from './pages/AuditLogsPage';
import AgreementAnalytics from './pages/AgreementAnalytics';
import Settings from './pages/Settings';
import SystemMonitor from './pages/SystemMonitor';


const PAGE_PERMISSIONS: Record<string, string[]> = {
  dashboard: ['admin', 'annotator', 'reviewer'],
  tasks: ['admin', 'annotator', 'reviewer'],
  annotation: ['admin', 'annotator'],
  qa: ['admin', 'reviewer'],
  agreement: ['admin', 'reviewer'],
  audit: ['admin'],
  'system-monitor': ['admin', 'reviewer'],
  settings: ['admin', 'annotator', 'reviewer'],
};

const App: React.FC = () => {
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const [activePage, setActivePage] = useState('dashboard');

  // Recover theme from localStorage on initial page load
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, []);

  // Listen for query params to allow deep linking from notification emails
  useEffect(() => {
    if (isAuthenticated && user) {
      const params = new URLSearchParams(window.location.search);
      const pageParam = params.get('page');
      if (pageParam && PAGE_PERMISSIONS[pageParam]) {
        const userRole = user.role?.toLowerCase() || '';
        if (PAGE_PERMISSIONS[pageParam].includes(userRole)) {
          setActivePage(pageParam);
        }
        // Clean up URL query parameters from address bar
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }
  }, [isAuthenticated, user]);

  if (!isAuthenticated) {
    return <Login />;
  }

  // Handle pending role account gating
  if (user?.role?.toLowerCase() === 'pending') {
    return (
      <div className="min-h-screen bg-[#07080d] flex items-center justify-center p-4 relative overflow-hidden text-slate-100">
        {/* Background radial gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-black z-0 dark-only-bg" />
        
        <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 text-center space-y-6">
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl" />

          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 animate-pulse mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="font-display font-bold text-2xl text-white tracking-tight">Account Pending Approval</h2>
            <p className="text-slate-400 text-sm mt-3 leading-relaxed">
              Hello <strong className="text-cyan-400">@{user?.username}</strong>, your account has been registered via Google SSO.
            </p>
            <p className="text-slate-500 text-xs mt-2 leading-relaxed">
              Because your email domain (<span className="font-mono text-slate-400">{user?.email || 'unspecified'}</span>) is unrecognized, your account requires administrator authorization. A manager must approve your registration and assign you a role before you can access the Trainlyft AI workspace.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-800/60">
            <button 
              onClick={() => dispatch(logout())}
              className="w-full py-3 px-4 bg-slate-850 hover:bg-slate-800 text-white rounded-2xl text-sm font-semibold transition-all duration-300 cursor-pointer border border-slate-800"
            >
              Sign Out & Return
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getPageTitle = () => {
    switch (activePage) {
      case 'dashboard':
        return 'Operations Dashboard';
      case 'tasks':
        return 'Task Sourcing & Management';
      case 'annotation':
        return 'AI-Assisted Annotation Workspace';
      case 'qa':
        return 'Quality Assurance Review';
      case 'agreement':
        return 'Inter-Annotator Agreement (IAA) Analytics';
      case 'audit':
        return 'System Audit Trail (MongoDB)';
      case 'system-monitor':
        return 'System SLA & Health Monitor';
      case 'settings':
        return 'System Governance & Settings';
      default:
        return 'AI Data Platform';
    }
  };

  const renderPage = () => {
    const userRole = user?.role?.toLowerCase() || '';
    const allowedRoles = PAGE_PERMISSIONS[activePage];
    
    const isClientReviewer = user?.role?.toLowerCase() === 'reviewer' && 
      (user?.email?.endsWith('@client.com') || user?.username === 'client_reviewer');

    const isBlocked = (allowedRoles && !allowedRoles.includes(userRole)) ||
      (isClientReviewer && (activePage === 'system-monitor' || activePage === 'audit'));

    if (isBlocked) {
      return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)] p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white font-display">Access Denied</h2>
          <p className="text-slate-400 text-sm max-w-md">
            Your account role/privilege level (<span className="capitalize font-semibold text-cyan-400">{user?.role}{isClientReviewer ? ' (Client)' : ''}</span>) does not have authorization to view the <span className="font-semibold text-white">{getPageTitle()}</span>.
          </p>
          <button 
            onClick={() => setActivePage('dashboard')}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Return to Dashboard
          </button>
        </div>
      );
    }

    switch (activePage) {
      case 'dashboard':
        return <Dashboard />;
      case 'tasks':
        return <TaskManagement setActivePage={setActivePage} />;
      case 'annotation':
        return <AnnotationPage setActivePage={setActivePage} />;
      case 'qa':
        return <QAReview />;
      case 'agreement':
        return <AgreementAnalytics />;
      case 'audit':
        return <AuditLogsPage />;
      case 'system-monitor':
        return <SystemMonitor />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex bg-[#07080d] min-h-screen text-slate-100">
      {/* Sidebar Navigation */}
      <Sidebar activePage={activePage} setActivePage={setActivePage} />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header title={getPageTitle()} />
        <main className="flex-1 overflow-y-auto">
          {renderPage()}
        </main>
      </div>
    </div>
  );
};

export default App;
