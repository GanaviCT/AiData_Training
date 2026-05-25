import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { API_BASE_URL } from '../config';
import {
  Activity,
  Cpu,
  Layers,
  Server,
  RefreshCw,
  Clock,
  Zap,
  CheckCircle,
  XCircle,
  HelpCircle,
  Users,
  AlertCircle,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  Trash2,
  ChevronRight,
  UserCheck
} from 'lucide-react';

interface ServiceDetail {
  status: string;
  latency_ms?: number;
  backend?: string;
}

interface LatencyMetrics {
  avg_ms: number;
  min_ms: number;
  max_ms: number;
}

interface HealthResponse {
  status: string;
  uptime_percentage: number;
  sla_target_percentage: number;
  sla_status: string;
  requests_total: number;
  requests_failed: number;
  latency_metrics: LatencyMetrics;
  services: {
    postgresql: ServiceDetail;
    mongodb: ServiceDetail;
    redis: ServiceDetail;
    ml_engine: ServiceDetail;
    smtp: ServiceDetail;
    message_queue: ServiceDetail;
  };
}

interface QueueJob {
  id: string;
  type: string;
  payload: any;
  status: string;
  created_at: number;
  completed_at: number | null;
  error: string | null;
}

interface QueueStatus {
  queue_backend: string;
  queue_size: number;
  total_queued: number;
  total_completed: number;
  total_failed: number;
  throughput_jobs_per_sec: number;
  active_workers: number;
  history: QueueJob[];
}

interface LeaderboardEntry {
  username: string;
  tasks_completed: number;
  accuracy_rating: number;
  ppu_earnings: number;
}

interface WorkloadItem {
  username: string;
  completed: number;
  active: number;
  accuracy?: number;
}

const SystemMonitor: React.FC = () => {
  const { token } = useSelector((state: RootState) => state.auth);

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [queue, setQueue] = useState<QueueStatus | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshInterval, setRefreshInterval] = useState(3000); // 3s polling
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'operations' | 'devops'>('operations');

  const fetchMetrics = async () => {
    setIsRefreshing(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };

      const [healthRes, queueRes, tasksRes, leaderboardRes] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/system/health`, { headers }),
        fetch(`${API_BASE_URL}/admin/queue/status`, { headers }),
        fetch(`${API_BASE_URL}/tasks`, { headers }),
        fetch(`${API_BASE_URL}/dashboard/leaderboard`, { headers })
      ]);

      if (healthRes.status === 'fulfilled' && healthRes.value.ok) {
        const healthData = await healthRes.value.json();
        setHealth(healthData);
      } else {
        throw new Error("Failed to fetch system health status");
      }

      if (queueRes.status === 'fulfilled' && queueRes.value.ok) {
        const queueData = await queueRes.value.json();
        setQueue(queueData);
      }

      if (tasksRes.status === 'fulfilled' && tasksRes.value.ok) {
        const tasksData = await tasksRes.value.json();
        setTasks(tasksData);
      }

      if (leaderboardRes.status === 'fulfilled' && leaderboardRes.value.ok) {
        const lbData = await leaderboardRes.value.json();
        setLeaderboard(lbData);
      }

      setError('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Server connection issue');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [token, refreshInterval]);

  const handleClearHistory = async () => {
    if (!window.confirm("Are you sure you want to clear system queue histories and metrics?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/queue/clear`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchMetrics();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // High-Level Status & Alerts Helper
  const getSystemStatus = () => {
    if (!health) return 'Down';
    const services = health.services;
    if (!services) return 'Down';

    if (
      services.postgresql?.status === 'unhealthy' ||
      services.mongodb?.status === 'unhealthy' ||
      services.redis?.status === 'unhealthy'
    ) {
      return 'Down';
    }

    const hasWarning = Object.values(services).some(
      (s: any) => s && (s.status === 'degraded' || s.status === 'uncalibrated' || s.status === 'offline' || s.status === 'unhealthy')
    );
    if (hasWarning) {
      return 'Warning';
    }

    return 'Healthy';
  };

  const getAlerts = () => {
    const alertsList: { text: string; type: 'error' | 'warning' }[] = [];
    if (!health || !health.services) return alertsList;

    const services = health.services;

    if (services.redis?.status === 'unhealthy') {
      alertsList.push({ text: 'Redis disconnected', type: 'error' });
    }
    if (services.smtp?.status !== 'healthy') {
      alertsList.push({ text: 'Email service delayed', type: 'warning' });
    }
    if (services.postgresql?.status === 'unhealthy') {
      alertsList.push({ text: 'PostgreSQL database offline', type: 'error' });
    }
    if (services.mongodb?.status === 'unhealthy') {
      alertsList.push({ text: 'MongoDB database offline', type: 'error' });
    }
    if (services.ml_engine?.status === 'uncalibrated') {
      alertsList.push({ text: 'ML Engine calibration required', type: 'warning' });
    }
    if (services.message_queue?.status === 'degraded') {
      alertsList.push({ text: 'Queue processing delay detected', type: 'warning' });
    }

    return alertsList;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-emerald-400 animate-pulse" />;
      case 'uncalibrated':
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-amber-400 animate-pulse" />;
      case 'unhealthy':
      case 'offline':
        return <XCircle className="w-5 h-5 text-rose-400 animate-pulse" />;
      default:
        return <HelpCircle className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'border-emerald-500/20 bg-emerald-500/5 text-emerald-350 dark:text-emerald-300';
      case 'uncalibrated':
      case 'degraded':
        return 'border-amber-500/20 bg-amber-500/5 text-amber-350 dark:text-amber-300';
      case 'unhealthy':
      case 'offline':
        return 'border-rose-500/20 bg-rose-500/5 text-rose-350 dark:text-rose-300';
      default:
        return 'border-slate-800 bg-slate-900/40 text-slate-400';
    }
  };

  // Guard against null health object before rendering
  if (!health) {
    return (
      <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center min-h-[400px]">
        {error ? (
          <div className="p-8 border border-rose-500/20 bg-rose-500/5 rounded-3xl text-rose-300 text-sm max-w-md text-center space-y-4 shadow-2xl">
            <XCircle className="w-12 h-12 text-rose-500 mx-auto animate-bounce" />
            <h3 className="font-bold text-white text-base">System Telemetry Connection Issue</h3>
            <p className="text-xs text-slate-400">{error}. Please ensure the backend server is running.</p>
            <button
              onClick={fetchMetrics}
              className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-rose-500/20 cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-10 h-10 animate-spin text-cyan-400" />
            <span className="font-semibold text-slate-300 tracking-wide">Querying platform telemetries...</span>
          </div>
        )}
      </div>
    );
  }

  // Calculate stats
  const totalTasks = Array.isArray(tasks) ? tasks.length : 0;
  const completedTasks = Array.isArray(tasks) ? tasks.filter(t => t && t.status === 'completed').length : 0;

  const awaitingQATasks = Array.isArray(tasks) ? tasks.filter(t => {
    if (!t || t.status !== 'completed') return false;
    if (!t.annotations || !Array.isArray(t.annotations) || t.annotations.length === 0) return true;
    const sortedAnns = [...t.annotations].sort((a, b) => b.version - a.version);
    const latest = sortedAnns[0];
    return !latest || !latest.qa_results || latest.qa_results.length === 0;
  }).length : 0;

  // Workload calculations with defensive array verification
  const workloadMap: { [username: string]: WorkloadItem } = {};
  if (Array.isArray(leaderboard)) {
    leaderboard.forEach(entry => {
      if (entry && entry.username) {
        workloadMap[entry.username] = {
          username: entry.username,
          completed: entry.tasks_completed || 0,
          active: 0,
          accuracy: entry.accuracy_rating
        };
      }
    });
  }

  if (Array.isArray(tasks)) {
    tasks.forEach(task => {
      if (task && task.assigned_to && task.assigned_to.username) {
        const username = task.assigned_to.username;
        if (!workloadMap[username]) {
          workloadMap[username] = { username, completed: 0, active: 0 };
        }
        if (task.status === 'pending' || task.status === 'in-progress') {
          workloadMap[username].active += 1;
        }
      }
    });
  }

  const workloads = Object.values(workloadMap).sort((a, b) => b.active - a.active);

  // Circular progress for QA queue
  const qaCircumference = 2 * Math.PI * 40; // radius = 40
  const qaPercentage = completedTasks > 0 ? (awaitingQATasks / completedTasks) * 100 : 0;
  const qaDashoffset = qaCircumference - (qaPercentage / 100) * qaCircumference;

  // DevOps circular gauge calculations
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const uptime = typeof health.uptime_percentage === 'number' ? health.uptime_percentage : 99.98;
  const strokeDashoffset = circumference - (uptime / 100) * circumference;

  const systemStatus = getSystemStatus();
  const alertsList = getAlerts();

  // Navigate to QA Tool helper using deep linking
  const handleOpenQATool = () => {
    // Triggers direct deep-linking in App.tsx via query parameters
    window.location.search = '?page=qa';
  };

  return (
    <div className="p-8 space-y-8">
      {/* Page Header with Tab Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-black tracking-tight text-white">
            Operations & Health Dashboard
          </h2>
          <p className="text-sm text-slate-400">
            Real-time business performance overview, QA metrics, and platform status.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-4">
          <div className="bg-slate-950/80 p-1 border border-slate-850 rounded-2xl flex shadow-inner">
            <button
              onClick={() => setActiveTab('operations')}
              className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 flex items-center gap-2 cursor-pointer ${
                activeTab === 'operations'
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-lg shadow-indigo-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Operations Dashboard
            </button>
            <button
              onClick={() => setActiveTab('devops')}
              className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 flex items-center gap-2 cursor-pointer ${
                activeTab === 'devops'
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-lg shadow-indigo-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              DevOps Telemetry
            </button>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="bg-slate-950/60 border border-slate-855 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="2000">Refresh: 2s</option>
              <option value="3000">Refresh: 3s</option>
              <option value="5000">Refresh: 5s</option>
              <option value="10000">Refresh: 10s</option>
            </select>
            <button
              onClick={fetchMetrics}
              disabled={isRefreshing}
              className="p-2.5 bg-slate-900/40 hover:bg-slate-850/60 border border-slate-800 rounded-xl transition text-slate-400 hover:text-white cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 border border-rose-500/20 bg-rose-500/5 rounded-2xl flex items-center gap-3 text-rose-300 text-sm">
          <XCircle className="w-5 h-5 flex-shrink-0 text-rose-500" />
          <span>{error}. Check backend server status.</span>
        </div>
      )}

      {/* RENDER OPERATIONS DASHBOARD VIEW */}
      {activeTab === 'operations' && (
        <div className="space-y-8 animate-fadeIn">
          
          {/* High-Level System Status & Alerts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* System Status Indicator Card */}
            <div className={`backdrop-blur-xl border rounded-3xl p-6 flex flex-col justify-between min-h-[170px] relative overflow-hidden shadow-xl transition-all duration-300 ${
              systemStatus === 'Healthy'
                ? 'bg-gradient-to-br from-emerald-500/10 via-emerald-500/2 to-transparent border-emerald-500/25 shadow-emerald-500/5'
                : systemStatus === 'Warning'
                ? 'bg-gradient-to-br from-amber-500/10 via-amber-500/2 to-transparent border-amber-500/25 shadow-amber-500/5'
                : 'bg-gradient-to-br from-rose-500/10 via-rose-500/2 to-transparent border-rose-500/25 shadow-rose-500/5'
            }`}>
              {/* Floating Large Glowing Icon in Background */}
              <div className="absolute -right-8 -top-8 opacity-[0.08] dark:opacity-[0.05]">
                {systemStatus === 'Healthy' && <ShieldCheck className="w-32 h-32 text-emerald-400" />}
                {systemStatus === 'Warning' && <AlertTriangle className="w-32 h-32 text-amber-400" />}
                {systemStatus === 'Down' && <XCircle className="w-32 h-32 text-rose-400" />}
              </div>

              <div className="space-y-2 relative z-10">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-display">System Integrity</span>
                <div className="flex items-center gap-3.5 mt-2">
                  <span className={`inline-block w-4 h-4 rounded-full ${
                    systemStatus === 'Healthy'
                      ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.75)] animate-pulse'
                      : systemStatus === 'Warning'
                      ? 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.75)] animate-pulse'
                      : 'bg-rose-500 shadow-[0_0_12px_rgba(239,68,68,0.75)] animate-pulse'
                  }`} />
                  <span className={`text-2xl font-display font-black tracking-tight ${
                    systemStatus === 'Healthy'
                      ? 'text-emerald-400'
                      : systemStatus === 'Warning'
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}>
                    System {systemStatus}
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-2 relative z-10">
                <p className="text-xs text-slate-400 leading-relaxed">
                  {systemStatus === 'Healthy' && "All integration pipelines and endpoints are operating at peak efficiency."}
                  {systemStatus === 'Warning' && "Partial network latency or offline mail relay detected. System degraded."}
                  {systemStatus === 'Down' && "Critical platform databases are experiencing outages. Actions required."}
                </p>
                <div className="flex items-center gap-4 text-[10px] text-slate-500 font-bold uppercase tracking-wider pt-2 border-t border-slate-800/10 dark:border-slate-800/40">
                  <span>SLA Uptime: <strong className="text-white font-black">{uptime.toFixed(2)}%</strong></span>
                  <span>Compliance: <strong className={uptime >= 99.5 ? 'text-emerald-400' : 'text-rose-400'}>{health.sla_status}</strong></span>
                </div>
              </div>
            </div>

            {/* Alerts Panel Section (Spans 2 columns) */}
            <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 lg:col-span-2 flex flex-col justify-between min-h-[170px] shadow-xl relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl" />
              <div className="w-full">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-display mb-3">ACTIVE INTEGRATION BANNERS</span>
                <div className="space-y-3 mt-1 max-h-[120px] overflow-y-auto pr-1">
                  {alertsList.length > 0 ? (
                    alertsList.map((alert, idx) => (
                      <div
                        key={idx}
                        className={`pl-3 pr-4 py-2.5 border-l-4 rounded-r-xl flex items-center justify-between text-xs font-semibold shadow-sm transition duration-300 ${
                          alert.type === 'error'
                            ? 'border-l-rose-500 border-rose-500/25 bg-rose-500/5 text-rose-350 dark:text-rose-300 hover:bg-rose-500/10'
                            : 'border-l-amber-500 border-amber-500/25 bg-amber-500/5 text-amber-350 dark:text-amber-300 hover:bg-amber-500/10'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <AlertCircle className={`w-4 h-4 flex-shrink-0 ${alert.type === 'error' ? 'text-rose-400' : 'text-amber-400'}`} />
                          {alert.text}
                        </span>
                        <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded ${
                          alert.type === 'error' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {alert.type === 'error' ? 'Critical' : 'Warning'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="px-5 py-4 border border-emerald-500/20 bg-emerald-500/5 text-emerald-350 dark:text-emerald-350 rounded-2xl flex items-center gap-3 text-xs font-medium shadow-inner">
                      <div className="p-1 bg-emerald-500/10 rounded-lg">
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <span className="font-bold text-white block text-sm">All Integrations Operational</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">No critical warnings or active outages currently reported.</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* QA Status & Team Pending Workload Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Live Pipeline QA Card */}
            <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 flex flex-col justify-between min-h-[260px] shadow-xl relative overflow-hidden group hover:border-slate-700 transition duration-300">
              <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl" />
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-display">Pipeline Queue</span>
                
                <div className="flex items-center justify-between mt-6">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200">Awaiting QA Review</h3>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed max-w-[130px]">
                      Annotated tasks ready for admin auditing.
                    </p>
                  </div>

                  {/* High-tech circular progress chart */}
                  <div className="relative w-20 h-20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-full h-full transform -rotate-95">
                      <circle
                        cx="40"
                        cy="40"
                        r="32"
                        className="stroke-slate-850"
                        strokeWidth="5"
                        fill="transparent"
                      />
                      <circle
                        cx="40"
                        cy="40"
                        r="32"
                        className="stroke-cyan-500"
                        strokeWidth="5"
                        fill="transparent"
                        strokeDasharray={qaCircumference}
                        strokeDashoffset={qaDashoffset}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                      />
                    </svg>
                    <div className="absolute text-center">
                      <span className="text-xl font-display font-black text-white">{awaitingQATasks}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-850">
                <button
                  onClick={handleOpenQATool}
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/20 transition-all duration-300 cursor-pointer"
                >
                  Open QA Review Tool
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Team Pending Workload Table (Spans 2 columns) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute -top-12 -right-12 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl" />
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-display">HUMAN WORKFLOW PIPELINES</span>
                    <h3 className="text-sm font-semibold text-slate-200 mt-1">Annotator Queue Workloads</h3>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left text-slate-350">
                    <thead className="text-[10px] uppercase font-black text-slate-500 border-b border-slate-850">
                      <tr>
                        <th className="pb-3 text-left pl-2">Annotator</th>
                        <th className="pb-3 text-center">Load Status</th>
                        <th className="pb-3 text-center">Task Completion</th>
                        <th className="pb-3 text-right pr-2">Expert Accuracy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/50">
                      {workloads.length > 0 ? (
                        workloads.map((user, idx) => {
                          const totalUserTasks = user.completed + user.active;
                          const completionRatio = totalUserTasks > 0 ? (user.completed / totalUserTasks) * 100 : 100;
                          
                          return (
                            <tr key={idx} className="hover:bg-slate-950/10 dark:hover:bg-slate-950/30 transition-all duration-150 group">
                              <td className="py-3.5 pl-2 font-semibold text-white flex items-center gap-3">
                                <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-500 flex items-center justify-center text-[10px] font-black text-white uppercase shadow-md shadow-cyan-500/5 group-hover:scale-105 transition duration-300">
                                  {user.username ? user.username.substring(0, 2) : 'U'}
                                </span>
                                <span className="truncate max-w-[120px]" title={user.username}>{user.username || 'Unknown'}</span>
                              </td>
                              <td className="py-3.5 text-center">
                                <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider ${
                                  user.active > 5
                                    ? 'bg-rose-500/10 text-rose-450 border border-rose-500/20'
                                    : user.active > 0
                                    ? 'bg-amber-500/10 text-amber-450 border border-amber-500/20'
                                    : 'bg-slate-800/40 text-slate-400'
                                }`}>
                                  {user.active > 5
                                    ? `🔥 High (${user.active} tasks)`
                                    : user.active > 0
                                    ? `⚡ Active (${user.active} tasks)`
                                    : '💤 Idle'}
                                </span>
                              </td>
                              <td className="py-3.5 text-center">
                                <div className="flex items-center justify-center gap-3 min-w-[140px] max-w-[180px] mx-auto">
                                  <span className="font-mono font-bold text-white text-[10px] w-8 text-right">{user.completed}</span>
                                  <div className="flex-1 h-1.5 bg-slate-950/50 rounded-full overflow-hidden relative border border-slate-900">
                                    <div
                                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500"
                                      style={{ width: `${completionRatio}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 text-right pr-2 font-mono font-black text-emerald-400">
                                {typeof user.accuracy === 'number' ? `${user.accuracy.toFixed(0)}%` : '100%'}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-500">
                            No active pending user workloads found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* RENDER DEVOPS TELEMETRY VIEW (Hidden by default, DevOps only role toggle) */}
      {activeTab === 'devops' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Main Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* SLA Gauge Dial */}
            <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-3xl p-6 flex items-center justify-between relative overflow-hidden">
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Service SLA Status</span>
                <div className="text-2xl font-black text-white">{uptime.toFixed(2)}%</div>
                <div className="flex items-center gap-1.5">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${uptime >= 99.5 ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500 animate-pulse'}`} />
                  <span className="text-xs font-bold text-slate-300">{health.sla_status}</span>
                </div>
                <span className="text-[10px] text-slate-400 block">SLA Commitment Target: {health.sla_target_percentage.toFixed(1)}%</span>
              </div>

              {/* Circular SVG Gauge */}
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="56"
                    cy="56"
                    r={radius}
                    className="stroke-slate-800"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <circle
                    cx="56"
                    cy="56"
                    r={radius}
                    className={uptime >= 99.5 ? 'stroke-cyan-500' : 'stroke-rose-500'}
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-xs font-bold text-white">UPTIME</span>
                </div>
              </div>
            </div>

            {/* API Latency Spark card */}
            <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block font-semibold">Average Response Time</span>
                  <div className="text-2xl font-black text-white flex items-baseline gap-1">
                    {health.latency_metrics.avg_ms.toFixed(1)} <span className="text-xs font-normal text-slate-400">ms</span>
                  </div>
                </div>
                <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                  <Clock className="w-5 h-5 text-indigo-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-850 text-xs">
                <div>
                  <span className="text-slate-400 block">Min Latency</span>
                  <span className="font-bold text-white">{health.latency_metrics.min_ms.toFixed(1)} ms</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Peak Latency</span>
                  <span className="font-bold text-white">{health.latency_metrics.max_ms.toFixed(1)} ms</span>
                </div>
              </div>
            </div>

            {/* Request volume card */}
            <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Network Traffic</span>
                  <div className="text-2xl font-black text-white">
                    {health.requests_total} <span className="text-xs font-normal text-slate-400">requests</span>
                  </div>
                </div>
                <div className="p-2 bg-pink-500/10 border border-pink-500/20 rounded-xl">
                  <Activity className="w-5 h-5 text-pink-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-850 text-xs">
                <div>
                  <span className="text-slate-400 block">Successful Requests</span>
                  <span className="font-bold text-emerald-400">{health.requests_total - health.requests_failed}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">HTTP 5xx Failures</span>
                  <span className={`font-bold ${health.requests_failed > 0 ? 'text-rose-400' : 'text-slate-400'}`}>{health.requests_failed}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Services Grid Check */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-400" />
              Service Integrations Health State
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              {health.services && Object.entries(health.services).map(([name, detail]) => (
                <div key={name} className={`border rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-2.5 transition-all ${getStatusColor(detail.status)}`}>
                  <span className="text-xs font-bold capitalize tracking-wide">{name === 'postgresql' ? 'PostgreSQL' : name === 'mongodb' ? 'MongoDB' : name === 'ml_engine' ? 'ML Engine' : name === 'message_queue' ? 'Message Queue' : name}</span>
                  {getStatusIcon(detail.status)}
                  <div className="text-[10px] space-y-0.5">
                    <div className="font-semibold uppercase text-slate-400">{detail.status}</div>
                    {detail.latency_ms !== undefined && detail.latency_ms > 0 && (
                      <div className="font-mono text-slate-400">{detail.latency_ms.toFixed(0)}ms latency</div>
                    )}
                    {detail.backend && (
                      <div className="text-cyan-400 font-mono flex items-center gap-1 justify-center">({detail.backend})</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Asynchronous Message Queue Monitor */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Queue stats column */}
            <div className="space-y-6">
              <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-3xl p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="font-display font-bold text-sm text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    Task Queue Stats
                  </h4>
                  {queue?.queue_backend && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-bold uppercase">
                      {queue.queue_backend} Broker
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Active Jobs in Queue</span>
                    <div className="text-xl font-black text-white">{queue?.queue_size}</div>
                  </div>
                  <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Active Workers</span>
                    <div className="text-xl font-black text-white">{queue?.active_workers}</div>
                  </div>
                  <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Jobs Completed</span>
                    <div className="text-xl font-black text-emerald-400">{queue?.total_completed}</div>
                  </div>
                  <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Failed Jobs</span>
                    <div className="text-xl font-black text-rose-450">{queue?.total_failed}</div>
                  </div>
                </div>

                <div className="p-4 bg-slate-950/30 border border-slate-850 rounded-2xl flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>Job Throughput Rate</span>
                  </div>
                  <span className="font-mono text-white font-bold">
                    {queue ? queue.throughput_jobs_per_sec.toFixed(3) : '0.000'}/sec
                  </span>
                </div>

                <button
                  onClick={handleClearHistory}
                  className="w-full py-2.5 border border-slate-800 hover:border-rose-500/25 bg-slate-950/20 hover:bg-rose-500/5 text-slate-400 hover:text-rose-300 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Queue History
                </button>
              </div>
            </div>

            {/* Queue Logs History */}
            <div className="lg:col-span-2">
              <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-3xl p-6 space-y-4">
                <h4 className="font-display font-bold text-sm text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  Background Worker execution traces
                </h4>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left text-slate-300">
                    <thead className="text-[10px] uppercase font-bold text-slate-500 border-b border-slate-850">
                      <tr>
                        <th scope="col" className="pb-3 pr-2">Job ID</th>
                        <th scope="col" className="pb-3">Type</th>
                        <th scope="col" className="pb-3 text-center">Status</th>
                        <th scope="col" className="pb-3 text-right">Elapsed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/60">
                      {queue && Array.isArray(queue.history) && queue.history.length > 0 ? (
                        [...queue.history].reverse().map((job) => (
                          <tr key={job.id} className="hover:bg-slate-950/10">
                            <td className="py-3 font-mono font-bold pr-2">{job.id}</td>
                            <td className="py-3 font-medium">
                              <div>{job.type}</div>
                              {job.error && (
                                <div className="text-[10px] text-rose-400 mt-0.5 break-all max-w-sm">{job.error}</div>
                              )}
                            </td>
                            <td className="py-3 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                job.status === 'completed'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : job.status === 'processing'
                                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                  : job.status === 'failed'
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  : 'bg-slate-800 text-slate-400'
                              }`}>
                                {job.status}
                              </span>
                            </td>
                            <td className="py-3 text-right font-mono text-slate-400">
                              {job.completed_at ? `${(job.completed_at - job.created_at).toFixed(1)}s` : 'running'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-500">
                            No background worker traces found. Queue is idle.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default SystemMonitor;
