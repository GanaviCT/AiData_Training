import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { API_BASE_URL } from '../config';
import { 
  Activity, 
  Server, 
  RefreshCw, 
  AlertTriangle, 
  Clock, 
  CheckCircle,
  XCircle,
  HelpCircle
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

const SystemMonitor: React.FC = () => {
  const { token } = useSelector((state: RootState) => state.auth);
  
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshInterval, setRefreshInterval] = useState(3000); // 3s polling
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchMetrics = async () => {
    setIsRefreshing(true);
    try {
      // Fetch Health Metrics
      const healthRes = await fetch(`${API_BASE_URL}/system/health`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!healthRes.ok) throw new Error("Failed to fetch system SLA logs");
      const healthData = await healthRes.json();
      setHealth(healthData);
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case 'uncalibrated':
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      case 'unhealthy':
      case 'offline':
        return <XCircle className="w-5 h-5 text-rose-400" />;
      default:
        return <HelpCircle className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300';
      case 'uncalibrated':
      case 'degraded':
        return 'border-amber-500/20 bg-amber-500/5 text-amber-300';
      case 'unhealthy':
      case 'offline':
        return 'border-rose-500/20 bg-rose-500/5 text-rose-300';
      default:
        return 'border-slate-800 bg-slate-900/40 text-slate-400';
    }
  };

  if (loading && !health) {
    return (
      <div className="p-8 text-center text-slate-400 flex items-center justify-center min-h-[300px]">
        <RefreshCw className="w-8 h-8 animate-spin text-cyan-400 mr-3" />
        <span className="font-semibold">Querying system telemetry indicators...</span>
      </div>
    );
  }

  // Calculate SVG circular gauge variables
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const uptime = health?.uptime_percentage || 99.98;
  const strokeDashoffset = circumference - (uptime / 100) * circumference;

  return (
    <div className="p-8 space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-black tracking-tight text-white">
            System SLA & Health Monitor
          </h2>
          <p className="text-sm text-slate-400">
            Real-time status indicators, service latencies, and background worker queue metrics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={refreshInterval} 
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="bg-slate-950/60 border border-slate-855 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
          >
            <option value="2000">Refresh: 2s</option>
            <option value="3000">Refresh: 3s</option>
            <option value="5000">Refresh: 5s</option>
            <option value="10000">Refresh: 10s</option>
          </select>
          <button
            onClick={fetchMetrics}
            disabled={isRefreshing}
            className="p-2 bg-slate-900/40 hover:bg-slate-850/60 border border-slate-800 rounded-xl transition text-slate-400 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 border border-rose-500/20 bg-rose-500/5 rounded-2xl flex items-center gap-3 text-rose-300 text-sm">
          <XCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}. Check backend server status.</span>
        </div>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* SLA Gauge Dial */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-3xl p-6 flex items-center justify-between relative overflow-hidden">
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Service SLA Status</span>
            <div className="text-2xl font-black text-white">{uptime.toFixed(2)}%</div>
            <div className="flex items-center gap-1.5">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${uptime >= 99.5 ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500 animate-pulse'}`} />
              <span className="text-xs font-bold text-slate-300">{health?.sla_status}</span>
            </div>
            <span className="text-[10px] text-slate-400 block">SLA Commitment Target: {health?.sla_target_percentage.toFixed(1)}%</span>
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
                {health?.latency_metrics.avg_ms.toFixed(1)} <span className="text-xs font-normal text-slate-400">ms</span>
              </div>
            </div>
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
              <Clock className="w-5 h-5 text-indigo-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-850 text-xs">
            <div>
              <span className="text-slate-400 block">Min Latency</span>
              <span className="font-bold text-white">{health?.latency_metrics.min_ms.toFixed(1)} ms</span>
            </div>
            <div>
              <span className="text-slate-400 block">Peak Latency</span>
              <span className="font-bold text-white">{health?.latency_metrics.max_ms.toFixed(1)} ms</span>
            </div>
          </div>
        </div>

        {/* Request volume card */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Network Traffic</span>
              <div className="text-2xl font-black text-white">
                {health?.requests_total} <span className="text-xs font-normal text-slate-400">requests</span>
              </div>
            </div>
            <div className="p-2 bg-pink-500/10 border border-pink-500/20 rounded-xl">
              <Activity className="w-5 h-5 text-pink-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-850 text-xs">
            <div>
              <span className="text-slate-400 block">Successful Requests</span>
              <span className="font-bold text-emerald-400">{health ? (health.requests_total - health.requests_failed) : 0}</span>
            </div>
            <div>
              <span className="text-slate-400 block">HTTP 5xx Failures</span>
              <span className={`font-bold ${health?.requests_failed && health.requests_failed > 0 ? 'text-rose-400' : 'text-slate-400'}`}>{health?.requests_failed}</span>
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
          {health && Object.entries(health.services).map(([name, detail]) => (
            <div key={name} className={`border rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-2.5 transition-all ${getStatusColor(detail.status)}`}>
              <span className="text-xs font-bold capitalize tracking-wide">{name === 'postgresql' ? 'PostgreSQL' : name === 'mongodb' ? 'MongoDB' : name === 'ml_engine' ? 'ML Engine' : name === 'message_queue' ? 'Message Queue' : name}</span>
              {getStatusIcon(detail.status)}
              <div className="text-[10px] space-y-0.5">
                <div className="font-semibold uppercase text-slate-400">{detail.status}</div>
                {detail.latency_ms !== undefined && detail.latency_ms > 0 && (
                  <div className="font-mono text-slate-400">{detail.latency_ms.toFixed(0)}ms latency</div>
                )}
                {detail.backend && (
                  <div className="text-cyan-400 font-mono">({detail.backend})</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SystemMonitor;
