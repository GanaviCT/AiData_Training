import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Calendar, Sun, Moon } from 'lucide-react';

interface HeaderProps {
  title: string;
}

const Header: React.FC<HeaderProps> = ({ title }) => {
  const { user } = useSelector((state: RootState) => state.auth);
  
  // Theme state initialized from localStorage
  const [theme, setTheme] = useState<'dark' | 'light'>(
    (localStorage.getItem('theme') as 'dark' | 'light') || 'dark'
  );

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <header className="h-20 bg-slate-950/20 backdrop-blur-md border-b border-slate-800/80 px-8 flex items-center justify-between sticky top-0 z-10 transition-colors duration-200">
      <div>
        <h2 className="font-display font-bold text-2xl text-white tracking-tight">
          {title}
        </h2>
      </div>
      <div className="flex items-center gap-4">
        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-slate-900/50 border border-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800/40 hover:border-slate-700/80 transition-all cursor-pointer flex items-center justify-center shadow-inner"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-500" />
          )}
        </button>

        {/* Date Display */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900/50 border border-slate-800/80 text-slate-400 text-xs font-semibold">
          <Calendar className="w-4 h-4 text-cyan-400" />
          <span>{today}</span>
        </div>
      </div>
    </header>
  );
};

export default Header;

