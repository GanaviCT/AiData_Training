import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { API_BASE_URL } from '../config';
import { 
  Database,
  Search, 
  RotateCw, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  User,
  Activity,
  Code,
  Terminal,
  BarChart3,
  X,
  SlidersHorizontal,
  Info,
  AlertTriangle,
  XCircle
} from 'lucide-react';

interface AuditLog {
  _id: string;
  timestamp: string;
  user_id: number | null;
  username: string | null;
  action: string;
  resource_type: string | null;
  resource_id: any;
  details: any;
  ip_address: string | null;
}

interface AuditAnalytics {
  action_counts: Record<string, number>;
  level_counts: {
    INFO: number;
    WARNING: number;
    ERROR: number;
  };
  user_counts: Record<string, number>;
  histogram: Array<{ date: string; count: number }>;
  total_logs: number;
}

const AuditLogsPage: React.FC = () => {
  const { token } = useSelector((state: RootState) => state.auth);
  
  // State
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [analytics, setAnalytics] = useState<AuditAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingCharts, setLoadingCharts] = useState(true);
  const [searchUser, setSearchUser] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [luceneQuery, setLuceneQuery] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [page, setPage] = useState(0);
  const [limit] = useState(25);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE_URL}/audit/logs?limit=${limit}&skip=${page * limit}`;
      if (searchUser.trim()) {
        url += `&username=${encodeURIComponent(searchUser.trim())}`;
      }
      if (filterAction) {
        url += `&action=${encodeURIComponent(filterAction)}`;
      }
      if (luceneQuery.trim()) {
        url += `&q=${encodeURIComponent(luceneQuery.trim())}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (err) {
      console.error("Error fetching audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    setLoadingCharts(true);
    try {
      const response = await fetch(`${API_BASE_URL}/audit/analytics`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error("Error fetching audit analytics:", err);
    } finally {
      setLoadingCharts(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchAnalytics();
  }, [page, filterAction, token]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchLogs();
  };

  const handleQuickSearch = (queryStr: string) => {
    setLuceneQuery(queryStr);
    setPage(0);
    // Directly fetch logs with updated query
    setTimeout(() => {
      fetchLogs();
    }, 50);
  };

  const handleClearFilters = () => {
    setSearchUser('');
    setFilterAction('');
    setLuceneQuery('');
    setPage(0);
    setTimeout(() => {
      fetchLogs();
    }, 50);
  };

  const toggleExpandLog = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case 'USER_LOGIN':
      case 'USER_REGISTER':
        return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'TASK_CREATE':
      case 'TASK_BULK_IMPORT':
        return 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400';
      case 'TASK_ASSIGN':
      case 'TASK_UPDATE':
        return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      case 'ANNOTATION_CREATE':
        return 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400';
      case 'QA_APPROVE':
        return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      case 'QA_REJECT':
        return 'bg-rose-500/10 border-rose-500/20 text-rose-450';
      default:
        return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
    }
  };

  const formatDetails = (log: AuditLog) => {
    const { action, resource_id, details } = log;
    switch (action) {
      case 'USER_LOGIN':
        return `Signed in to application`;
      case 'USER_REGISTER':
        return `Registered new user account with role '${details?.role}'`;
      case 'TASK_CREATE':
        return `Created task #${resource_id} (Type: ${details?.type}, Priority: ${details?.priority})`;
      case 'TASK_BULK_IMPORT':
        return `Imported batch of ${details?.count} tasks`;
      case 'TASK_ASSIGN':
        return `Assigned task #${resource_id} to user ID ${details?.assigned_to_id || 'unassigned'}`;
      case 'TASK_UPDATE':
        return `Updated task #${resource_id} status to '${details?.status}'`;
      case 'ANNOTATION_CREATE':
        return `Submitted annotation for task #${details?.task_id || resource_id} (Label: ${details?.label})`;
      case 'QA_APPROVE':
        return `Approved QA review for annotation #${details?.annotation_id}`;
      case 'QA_REJECT':
        return `Rejected QA review for annotation #${details?.annotation_id} (Reason: "${details?.comments || 'None'}")`;
      default:
        return details ? JSON.stringify(details) : 'No extra details';
    }
  };

  const actionOptions = [
    'USER_LOGIN',
    'USER_REGISTER',
    'TASK_CREATE',
    'TASK_BULK_IMPORT',
    'TASK_ASSIGN',
    'TASK_UPDATE',
    'ANNOTATION_CREATE',
    'QA_APPROVE',
    'QA_REJECT'
  ];

  // Helper to draw Area Chart for daily log density
  const renderAreaChart = () => {
    if (!analytics || !analytics.histogram || analytics.histogram.length === 0) return null;
    const data = analytics.histogram;
    const width = 600;
    const height = 140;
    const padding = 20;
    
    const maxVal = Math.max(...data.map(d => d.count), 1);
    const stepX = (width - padding * 2) / (data.length - 1 || 1);
    
    // Generate path coordinates
    const points = data.map((d, i) => {
      const x = padding + i * stepX;
      const y = height - padding - ((d.count / maxVal) * (height - padding * 2));
      return { x, y };
    });
    
    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
    }
    
    const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

    return (
      <svg className="w-full h-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        {/* Horizontal grid lines */}
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#1e293b" strokeDasharray="3,3" />
        <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#1e293b" strokeDasharray="3,3" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#334155" />
        
        {/* Area fill */}
        <path d={areaD} fill="url(#chartGradient)" />
        
        {/* Line stroke */}
        <path d={pathD} fill="none" stroke="#22d3ee" strokeWidth="2.5" />
        
        {/* Dots & labels */}
        {points.map((pt, idx) => (
          <g key={idx}>
            <circle cx={pt.x} cy={pt.y} r="4" fill="#0f172a" stroke="#22d3ee" strokeWidth="2" />
            {/* Value tooltip label */}
            <text x={pt.x} y={pt.y - 8} fill="#e2e8f0" fontSize="9" fontWeight="bold" textAnchor="middle">
              {data[idx].count}
            </text>
            {/* Date label */}
            <text x={pt.x} y={height - 4} fill="#64748b" fontSize="8" textAnchor="middle">
              {data[idx].date.substring(5)}
            </text>
          </g>
        ))}
      </svg>
    );
  };

  return (
    <div className="p-8 space-y-6">
      {/* Title block */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyan-500/15 border border-cyan-500/20 rounded-xl text-cyan-400 animate-pulse">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">System Audit Trail Logs</h2>
            <p className="text-slate-400 text-xs mt-0.5">
              Elasticsearch-like query execution and Kibana-inspired SVG log visualizations.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { fetchLogs(); fetchAnalytics(); }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700/80 text-cyan-400 hover:text-cyan-300 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Analytics
          </button>
        </div>
      </div>

      {/* Kibana Charts Row */}
      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart 1: Log Density Line Graph */}
          <div className="lg:col-span-2 bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-cyan-400" /> Log Ingestion Volume (7-Day Density)
              </span>
              <span className="text-[10px] bg-slate-850 px-2 py-0.5 rounded-full text-slate-300 font-mono">
                Total Logs: {analytics.total_logs}
              </span>
            </div>
            <div className="h-40 w-full flex items-center justify-center bg-slate-950/20 border border-slate-850/50 rounded-2xl p-2">
              {loadingCharts ? (
                <div className="text-slate-500 text-xs flex items-center gap-2">
                  <RotateCw className="w-4 h-4 animate-spin text-cyan-400" /> Loading chart...
                </div>
              ) : (
                renderAreaChart()
              )}
            </div>
          </div>

          {/* Chart 2: Log Severity Stacked Bar & Top Actors */}
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-3xl p-5 space-y-5 flex flex-col justify-between">
            {/* Log Levels */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Log Level Severities</span>
              {loadingCharts ? (
                <div className="text-slate-500 text-xs py-2">Loading...</div>
              ) : (
                <div className="space-y-3">
                  {/* Stacked Bar indicator */}
                  <div className="h-3.5 w-full bg-slate-950 rounded-full overflow-hidden flex">
                    {Object.entries(analytics.level_counts).map(([level, count]) => {
                      const total = Object.values(analytics.level_counts).reduce((a, b) => a + b, 0) || 1;
                      const percentage = (count / total) * 100;
                      const color = level === 'ERROR' ? 'bg-rose-500' : level === 'WARNING' ? 'bg-amber-400' : 'bg-emerald-400';
                      return (
                        <div 
                          key={level} 
                          className={`${color} transition-all duration-500`}
                          style={{ width: `${percentage}%` }}
                          title={`${level}: ${count} (${percentage.toFixed(0)}%)`}
                        />
                      );
                    })}
                  </div>
                  {/* Legends */}
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-emerald-400 block" />
                      <span className="text-slate-300 font-bold">INFO ({analytics.level_counts.INFO})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-amber-400 block" />
                      <span className="text-slate-300 font-bold">WARN ({analytics.level_counts.WARNING})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-rose-500 block" />
                      <span className="text-slate-300 font-bold">ERR ({analytics.level_counts.ERROR})</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Top Actors */}
            <div className="space-y-2 border-t border-slate-850/60 pt-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Top Actors (Activity)</span>
              <div className="space-y-1.5 max-h-[100px] overflow-y-auto pr-1">
                {Object.entries(analytics.user_counts)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 3)
                  .map(([user, count]) => {
                    const maxVal = Math.max(...Object.values(analytics.user_counts), 1);
                    const pct = (count / maxVal) * 100;
                    return (
                      <div key={user} className="space-y-0.5">
                        <div className="flex justify-between text-[10px] font-mono">
                          <span className="text-slate-200 font-bold">{user}</span>
                          <span className="text-cyan-400 font-semibold">{count} logs</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Input Bar (Lucene Style) */}
      <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6 space-y-4">
        <form onSubmit={handleSearchSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-cyan-400 animate-pulse" /> Elasticsearch / Lucene Query
              </label>
              <button 
                type="button" 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 transition-all cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                {showAdvanced ? 'Hide advanced filters' : 'Show advanced filters'}
              </button>
            </div>
            
            <div className="relative">
              <input
                type="text"
                value={luceneQuery}
                onChange={(e) => setLuceneQuery(e.target.value)}
                placeholder="Enter query string (e.g., action:TASK_CREATE user:admin type:task) or free text search..."
                className="w-full pl-10 pr-24 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-550 focus:outline-none focus:border-cyan-500/50 font-mono tracking-wide"
              />
              <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
              <div className="absolute right-2.5 top-2 flex items-center gap-1">
                {luceneQuery && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="p-1.5 hover:bg-slate-850 text-slate-400 hover:text-white rounded-lg transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg text-xs font-bold transition-all shadow shadow-cyan-500/10 cursor-pointer"
                >
                  Query
                </button>
              </div>
            </div>
          </div>

          {/* Quick Query tags */}
          <div className="flex flex-wrap gap-2 items-center text-[10px] text-slate-400">
            <span className="font-semibold uppercase tracking-wider">Quick Filters:</span>
            <button
              type="button"
              onClick={() => handleQuickSearch("action:USER_LOGIN")}
              className="px-2 py-0.5 bg-slate-800/80 hover:bg-slate-700/80 hover:text-white border border-slate-700/50 rounded-md transition font-mono cursor-pointer"
            >
              action:USER_LOGIN
            </button>
            <button
              type="button"
              onClick={() => handleQuickSearch("user:admin")}
              className="px-2 py-0.5 bg-slate-800/80 hover:bg-slate-700/80 hover:text-white border border-slate-700/50 rounded-md transition font-mono cursor-pointer"
            >
              user:admin
            </button>
            <button
              type="button"
              onClick={() => handleQuickSearch("type:task")}
              className="px-2 py-0.5 bg-slate-800/80 hover:bg-slate-700/80 hover:text-white border border-slate-700/50 rounded-md transition font-mono cursor-pointer"
            >
              type:task
            </button>
            <button
              type="button"
              onClick={() => handleQuickSearch("action:QA_REJECT")}
              className="px-2 py-0.5 bg-slate-800/80 hover:bg-slate-700/80 hover:text-white border border-slate-700/50 rounded-md transition font-mono cursor-pointer"
            >
              action:QA_REJECT
            </button>
          </div>

          {/* Advanced Filters Drawer */}
          {showAdvanced && (
            <div className="p-4 bg-slate-950/50 border border-slate-850 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-500" /> Filter by User
                </label>
                <input
                  type="text"
                  placeholder="Username regex (e.g. admin)"
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-slate-500" /> Filter by Action Type
                </label>
                <select
                  value={filterAction}
                  onChange={(e) => {
                    setFilterAction(e.target.value);
                    setPage(0);
                  }}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="">All Actions</option>
                  {actionOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Logs Table/List Card */}
      <div className="bg-slate-900/35 backdrop-blur-md border border-slate-800/80 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                <th className="px-6 py-4 w-52">Timestamp</th>
                <th className="px-6 py-4 w-44">User</th>
                <th className="px-6 py-4 w-48">Action Type</th>
                <th className="px-6 py-4">Event Details</th>
                <th className="px-6 py-4 w-28 text-right">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 text-xs">
                    <div className="flex justify-center items-center gap-2">
                      <RotateCw className="w-4 h-4 animate-spin text-cyan-400" />
                      Loading logs from MongoDB...
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 text-xs">
                    No matching audit logs found in the database.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isExpanded = expandedLogId === log._id;
                  return (
                    <React.Fragment key={log._id}>
                      <tr className="hover:bg-slate-900/20 transition-colors text-xs text-slate-350 align-top">
                        <td className="px-6 py-4 whitespace-nowrap text-slate-450 font-medium">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-650" />
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {log.username ? (
                            <span className="font-semibold text-white">{log.username}</span>
                          ) : (
                            <span className="text-slate-550 italic">system</span>
                          )}
                          {log.ip_address && (
                            <span className="block text-[10px] text-slate-500 mt-0.5">{log.ip_address}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getActionBadgeClass(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 leading-normal font-medium text-slate-300">
                          {formatDetails(log)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => toggleExpandLog(log._id)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 border border-slate-700/80 text-cyan-400 rounded-md text-[10px] font-bold inline-flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <Code className="w-3 h-3" />
                            {isExpanded ? 'Hide' : 'Inspect'}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-950/50">
                          <td colSpan={5} className="px-6 py-4">
                            <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 overflow-x-auto text-[11px] font-mono text-cyan-300">
                              <pre>{JSON.stringify(log, null, 2)}</pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {!loading && logs.length > 0 && (
          <div className="flex justify-between items-center px-6 py-4 bg-slate-950/30 border-t border-slate-850 text-xs">
            <span className="text-slate-500">
              Showing page <strong className="text-slate-300">{page + 1}</strong> (up to {limit} entries per page)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700/80 text-slate-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <button
                disabled={logs.length < limit}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700/80 text-slate-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogsPage;
