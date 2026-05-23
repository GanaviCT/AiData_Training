import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { logout } from '../store/authSlice';
import { API_BASE_URL } from '../config';
import { 
  LayoutDashboard, 
  ListTodo, 
  ShieldCheck, 
  LogOut,
  BrainCircuit,
  Database,
  Users,
  Settings,
  Activity
} from 'lucide-react';

interface SidebarProps {
  activePage: string;
  setActivePage: (page: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage }) => {
  const dispatch = useDispatch();
  const { user, token } = useSelector((state: RootState) => state.auth);
  const [qaCount, setQaCount] = useState<number>(0);

  const fetchQaCount = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE_URL}/tasks?status=completed`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        // Filter tasks that have annotations but no QA reviews yet
        const pending = data.filter((item: any) => {
          const latestAnnotation = item.annotations && item.annotations.length > 0
            ? item.annotations[item.annotations.length - 1]
            : null;
          if (!latestAnnotation) return false;
          const hasBeenReviewed = latestAnnotation.qa_results && latestAnnotation.qa_results.length > 0;
          return !hasBeenReviewed;
        });
        setQaCount(pending.length);
      }
    } catch (err) {
      console.error("Failed loading QA count for sidebar:", err);
    }
  };

  useEffect(() => {
    fetchQaCount();
  }, [token, activePage]); // Refresh count on load or page navigation

  useEffect(() => {
    const handleUpdate = () => {
      fetchQaCount();
    };
    window.addEventListener('qa-count-updated', handleUpdate);
    return () => {
      window.removeEventListener('qa-count-updated', handleUpdate);
    };
  }, [token]);

  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'annotator', 'reviewer'] },
    { id: 'tasks', name: 'Task Management', icon: ListTodo, roles: ['admin', 'annotator', 'reviewer'] },
    { id: 'qa', name: 'QA Review', icon: ShieldCheck, roles: ['admin', 'reviewer'] },
    { id: 'agreement', name: 'Agreement (IAA)', icon: Users, roles: ['admin'] },
    { id: 'audit', name: 'Audit Logs', icon: Database, roles: ['admin'] },
    { id: 'system-monitor', name: 'System Monitor', icon: Activity, roles: ['admin'] },
    { id: 'settings', name: 'Settings', icon: Settings, roles: ['admin', 'annotator', 'reviewer'] },
  ];

  const handleLogout = () => {
    dispatch(logout());
  };

  return (
    <aside className="w-64 bg-slate-900/60 backdrop-blur-xl border-r border-slate-800 text-slate-200 flex flex-col h-screen sticky top-0">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <BrainCircuit className="w-8 h-8 text-cyan-400 animate-pulse" />
        <div>
          <h1 className="font-display font-bold text-lg leading-none text-white tracking-wide">
            TRAINLYFT AI
          </h1>
          <span className="text-[10px] text-cyan-400 font-semibold tracking-widest uppercase">
            Operations
          </span>
        </div>
      </div>

      {/* User Info Card */}
      <div className="px-6 py-4 border-b border-slate-800/50 bg-slate-950/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center font-bold text-white shadow-lg shadow-cyan-500/10">
            {user?.username.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white truncate max-w-[140px]">{user?.username}</h4>
            <span className="text-xs text-slate-400 capitalize px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/50 inline-block mt-0.5">
              {user?.role}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-4 py-6 space-y-1.5">
        {menuItems
          .filter(item => item.roles.includes(user?.role || ''))
          .map(item => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/15 to-indigo-500/15 border border-cyan-500/30 text-cyan-400 shadow-md shadow-cyan-500/5'
                    : 'border border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{item.name}</span>
                </div>
                {item.id === 'qa' && qaCount > 0 && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all duration-300 ${
                    isActive 
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' 
                      : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
                  }`}>
                    {qaCount}
                  </span>
                )}
              </button>
            );
          })}
      </nav>

      {/* Footer / Logout */}
      <div className="p-4 border-t border-slate-850">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors duration-300"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
