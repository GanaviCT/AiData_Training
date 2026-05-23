import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from './store';
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


const App: React.FC = () => {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
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
    if (isAuthenticated) {
      const params = new URLSearchParams(window.location.search);
      const pageParam = params.get('page');
      if (pageParam && ['dashboard', 'tasks', 'annotation', 'qa', 'audit', 'agreement', 'settings', 'system-monitor'].includes(pageParam)) {
        setActivePage(pageParam);
        // Clean up URL query parameters from address bar
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <Login />;
  }

  const renderPage = () => {
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
