import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { API_BASE_URL } from '../config';
import { 
  CheckCircle, 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  ListChecks,
  Brain,
  Cpu,
  RefreshCw,
  Clock,
  Play,
  Check,
  AlertCircle,
  Sparkles
} from 'lucide-react';

interface Stats {
  total_reviewed: number;
  approved_count: number;
  rejected_count: number;
  accuracy_percentage: number;
}

interface Activity {
  id: string;
  type?: string;
  message?: string;
  timestamp: string;
  username?: string;
  action?: string;
  resource_type?: string;
  resource_id?: any;
  details?: any;
}

interface LeaderboardEntry {
  username: string;
  tasks_completed: number;
  accuracy_rating: number;
  ppu_earnings: number;
}

const Dashboard: React.FC = () => {
  const { token, user } = useSelector((state: RootState) => state.auth);
  
  // Dashboard states
  const [stats, setStats] = useState<Stats | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [opMetrics, setOpMetrics] = useState({
    totalTasks: 0,
    completedTasks: 0,
    approvedTasks: 0,
    totalSpent: 0.0
  });

  // ML Training & Inference states
  const [training, setTraining] = useState(false);
  const [trainingMsg, setTrainingMsg] = useState<string | null>(null);
  const [trainingSuccess, setTrainingSuccess] = useState<boolean | null>(null);

  const [testText, setTestText] = useState('');
  const [inferenceResult, setInferenceResult] = useState<any>(null);
  const [inferenceLoading, setInferenceLoading] = useState(false);

  const fetchStats = async () => {
    try {
      // Fetch QA Stats
      const qaResponse = await fetch(`${API_BASE_URL}/qa/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (qaResponse.ok) {
        const qaData = await qaResponse.json();
        setStats(qaData);
      }

      // Fetch Dashboard Stats
      const dashboardResponse = await fetch(`${API_BASE_URL}/dashboard/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (dashboardResponse.ok) {
        const dashData = await dashboardResponse.json();
        setOpMetrics({
          totalTasks: dashData.total_tasks,
          completedTasks: dashData.completed_tasks,
          approvedTasks: dashData.approved_tasks,
          totalSpent: dashData.total_spent
        });
      }

      // Fetch Recent Activities (Audit Logs if Admin, otherwise fallback to recent-activity)
      const isAdmin = user?.role?.toLowerCase() === 'admin';
      const endpoint = isAdmin ? `${API_BASE_URL}/audit/logs?limit=30` : `${API_BASE_URL}/dashboard/recent-activity`;

      const activityResponse = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (activityResponse.ok) {
        const actData = await activityResponse.json();
        const mappedData = actData.map((item: any) => ({
          ...item,
          id: item.id || item._id || Math.random().toString(36).substr(2, 9)
        }));
        setActivities(mappedData);
      }

      if (isAdmin) {
        try {
          const leaderboardResponse = await fetch(`${API_BASE_URL}/dashboard/leaderboard`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (leaderboardResponse.ok) {
            const lbData = await leaderboardResponse.json();
            setLeaderboard(lbData);
          }
        } catch (lbErr) {
          console.error("Error fetching leaderboard stats:", lbErr);
        }
      }
    } catch (err) {
      console.error("Error fetching dashboard stats:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchStats();
    }
  }, [token, user]);

  const getActivityColor = (activity: Activity) => {
    if (activity.action) {
      switch (activity.action) {
        case 'USER_LOGIN':
        case 'USER_REGISTER':
          return 'bg-blue-500/20 border-blue-500/40 text-blue-400';
        case 'TASK_CREATE':
        case 'TASK_BULK_IMPORT':
          return 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400';
        case 'TASK_ASSIGN':
        case 'TASK_UPDATE':
          return 'bg-amber-500/20 border-amber-500/40 text-amber-400';
        case 'ANNOTATION_CREATE':
          return 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400';
        case 'QA_APPROVE':
          return 'bg-emerald-500/20 border-emerald-500/40 text-emerald-450';
        case 'QA_REJECT':
          return 'bg-rose-500/20 border-rose-500/40 text-rose-400';
        default:
          return 'bg-slate-500/20 border-slate-500/40 text-slate-400';
      }
    }
    return 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400';
  };

  const renderActivityMessage = (activity: Activity) => {
    if (activity.action) {
      const { action, username, resource_id, details } = activity;
      switch (action) {
        case 'USER_LOGIN':
          return (
            <span>
              User <strong className="text-white">{username}</strong> logged in
            </span>
          );
        case 'USER_REGISTER':
          return (
            <span>
              User <strong className="text-white">{username}</strong> registered as <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-semibold text-slate-300">{details?.role}</span>
            </span>
          );
        case 'TASK_CREATE':
          return (
            <span>
              Task <strong className="text-cyan-400">#{resource_id}</strong> created by <strong className="text-white">{username}</strong> (Priority: {details?.priority})
            </span>
          );
        case 'TASK_BULK_IMPORT':
          return (
            <span>
              Bulk import of <strong className="text-white">{details?.count || 0} tasks</strong> completed by <strong className="text-white">{username}</strong>
            </span>
          );
        case 'TASK_ASSIGN':
          return (
            <span>
              Task <strong className="text-cyan-400">#{resource_id}</strong> assigned to User ID <strong className="text-white">{details?.assigned_to_id || 'unassigned'}</strong> by <strong className="text-white">{username}</strong>
            </span>
          );
        case 'TASK_UPDATE':
          return (
            <span>
              Task <strong className="text-cyan-400">#{resource_id}</strong> status updated to <span className="text-cyan-400 font-semibold">{details?.status}</span> by <strong className="text-white">{username}</strong>
            </span>
          );
        case 'ANNOTATION_CREATE':
          return (
            <span>
              Task <strong className="text-cyan-400">#{details?.task_id || resource_id}</strong> annotated with <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-semibold text-[10px]">{details?.label}</span> by <strong className="text-white">{username}</strong>
            </span>
          );
        case 'QA_APPROVE':
          return (
            <span>
              Annotation <strong className="text-white">#{details?.annotation_id}</strong> <span className="text-emerald-400 font-bold">Approved</span> by <strong className="text-white">{username}</strong>
            </span>
          );
        case 'QA_REJECT':
          return (
            <span>
              Annotation <strong className="text-white">#{details?.annotation_id}</strong> <span className="text-rose-400 font-bold">Rejected</span> by <strong className="text-white">{username}</strong>. Comments: <em className="text-slate-400">"{details?.comments || 'None'}"</em>
            </span>
          );
        default:
          return <span>{action} by {username}</span>;
      }
    }
    return <span>{activity.message}</span>;
  };

  const handleTrainModel = async () => {
    setTraining(true);
    setTrainingMsg(null);
    setTrainingSuccess(null);
    try {
      const response = await fetch(`${API_BASE_URL}/train-model`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setTrainingSuccess(true);
        setTrainingMsg(`Model trained successfully on ${data.samples_trained} sample(s) (Classes: ${data.classes.join(', ')}).`);
        fetchStats(); // Refresh dashboard stats
      } else {
        setTrainingSuccess(false);
        setTrainingMsg(data.detail || 'Training failed.');
      }
    } catch (err) {
      setTrainingSuccess(false);
      setTrainingMsg('Error connecting to ML training service.');
    } finally {
      setTraining(false);
    }
  };

  const handleRunInference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testText.trim()) return;
    setInferenceLoading(true);
    setInferenceResult(null);
    try {
      const response = await fetch(`${API_BASE_URL}/model/predict?text=${encodeURIComponent(testText)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setInferenceResult(data);
      } else {
        setInferenceResult({ error: data.detail || 'Inference request failed.' });
      }
    } catch (err) {
      setInferenceResult({ error: 'Connection error during model inference.' });
    } finally {
      setInferenceLoading(false);
    }
  };

  const getAccuracyDisplay = () => {
    if (stats && stats.total_reviewed > 0) {
      return `${stats.accuracy_percentage}%`;
    }
    return '100.00%';
  };

  const totalReviewed = stats?.total_reviewed || 0;
  const approvedCount = stats?.approved_count || 0;
  const rejectedCount = stats?.rejected_count || 0;
  const approvedPct = totalReviewed > 0 ? (approvedCount / totalReviewed) * 100 : 0;
  const rejectedPct = totalReviewed > 0 ? (rejectedCount / totalReviewed) * 100 : 0;

  return (
    <div className="p-5 md:p-6 space-y-5 animate-fade-in">
      {/* Welcome Banner */}
      <div className="relative bg-gradient-to-r from-cyan-500/10 to-indigo-500/10 backdrop-blur-md border border-cyan-500/20 rounded-2xl p-4 md:p-5 overflow-hidden shadow-xl shadow-black/20">
        <div className="absolute -right-24 -top-24 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-24 -bottom-24 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[9px] uppercase font-bold tracking-widest bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 px-2.5 py-0.5 rounded-full">
                <Sparkles className="w-2.5 h-2.5 text-cyan-400 animate-pulse" />
                Live Control Center
              </span>
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight font-display">
              Welcome back, <span className="bg-gradient-to-r from-cyan-400 via-indigo-300 to-indigo-400 text-transparent bg-clip-text font-black">{user?.username}</span>!
            </h3>
            <p className="text-slate-400 text-[11px] max-w-xl leading-normal">
              Monitoring active labeling pipelines, golden-truth annotation metrics, and local ML classifier training protocols in real time.
            </p>
          </div>
          
          <div className="flex items-center gap-4 bg-slate-950/60 backdrop-blur-md border border-slate-800/80 p-3 rounded-xl shrink-0 w-full md:w-auto justify-around md:justify-start">
            <div className="space-y-0.5">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Platform SLA</span>
              <div className="flex items-center gap-1.5 font-mono">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <h4 className="text-base font-bold text-emerald-400">99.8%</h4>
              </div>
            </div>
            <div className="w-px h-6 bg-slate-800" />
            <div className="space-y-0.5">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Avg SLA Duration</span>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-indigo-400" />
                <h4 className="text-base font-bold text-indigo-400 font-mono">3.85d</h4>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Tasks */}
        <div className="group relative bg-slate-900/30 backdrop-blur-md border border-slate-800/80 hover:border-cyan-500/40 rounded-xl p-4 flex items-center justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-cyan-500/5 overflow-hidden">
          <div className="absolute right-0 bottom-0 w-16 h-16 bg-gradient-to-br from-transparent to-cyan-500/5 rounded-br-xl blur-lg pointer-events-none group-hover:to-cyan-500/10 transition-all" />
          <div className="relative z-10 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Total Sourced Tasks</span>
            <h3 className="text-2xl font-black text-white font-mono leading-none my-0.5">{opMetrics.totalTasks.toLocaleString()}</h3>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-medium inline-block">Sourcing Ops</span>
          </div>
          <div className="relative z-10 w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20 group-hover:scale-105 group-hover:bg-cyan-500/20 transition-all duration-300 shadow-md">
            <BarChart3 className="w-4 h-4" />
          </div>
        </div>

        {/* Card 2: Completed */}
        <div className="group relative bg-slate-900/30 backdrop-blur-md border border-slate-800/80 hover:border-emerald-500/40 rounded-xl p-4 flex items-center justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-500/5 overflow-hidden">
          <div className="absolute right-0 bottom-0 w-16 h-16 bg-gradient-to-br from-transparent to-emerald-500/5 rounded-br-xl blur-lg pointer-events-none group-hover:to-emerald-500/10 transition-all" />
          <div className="relative z-10 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Delivered Today</span>
            <h3 className="text-2xl font-black text-white font-mono leading-none my-0.5">{opMetrics.completedTasks.toLocaleString()}</h3>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium inline-block">+12.4% vs Yesterday</span>
          </div>
          <div className="relative z-10 w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20 group-hover:scale-105 group-hover:bg-emerald-500/20 transition-all duration-300 shadow-md">
            <CheckCircle className="w-4 h-4" />
          </div>
        </div>

        {/* Card 3: Accuracy */}
        <div className="group relative bg-slate-900/30 backdrop-blur-md border border-slate-800/80 hover:border-indigo-500/40 rounded-xl p-4 flex items-center justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-500/5 overflow-hidden">
          <div className="absolute right-0 bottom-0 w-16 h-16 bg-gradient-to-br from-transparent to-indigo-500/5 rounded-br-xl blur-lg pointer-events-none group-hover:to-indigo-500/10 transition-all" />
          <div className="relative z-10 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Validation Accuracy</span>
            <h3 className="text-2xl font-black text-white font-mono leading-none my-0.5">{getAccuracyDisplay()}</h3>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-medium inline-block">Golden Truth QA</span>
          </div>
          <div className="relative z-10 w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 group-hover:scale-105 group-hover:bg-indigo-500/20 transition-all duration-300 shadow-md">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>

        {/* Card 4: Cost */}
        <div className="group relative bg-slate-900/30 backdrop-blur-md border border-slate-800/80 hover:border-amber-500/40 rounded-xl p-4 flex items-center justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-amber-500/5 overflow-hidden">
          <div className="absolute right-0 bottom-0 w-16 h-16 bg-gradient-to-br from-transparent to-amber-500/5 rounded-br-xl blur-lg pointer-events-none group-hover:to-amber-500/10 transition-all" />
          <div className="relative z-10 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Realized Cost</span>
            <h3 className="text-2xl font-black text-white font-mono leading-none my-0.5">${opMetrics.totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-medium inline-block">Ops Budget</span>
          </div>
          <div className="relative z-10 w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20 group-hover:scale-105 group-hover:bg-amber-500/20 transition-all duration-300 shadow-md">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Main Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Columns (QA breakdown, ML training & Leaderboard) */}
        <div className="lg:col-span-2 space-y-5">
          
          {/* QA Breakdown */}
          <div className="bg-slate-900/30 backdrop-blur-md border border-slate-800/80 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5 font-display">
                <ListChecks className="w-4 h-4 text-cyan-400" />
                Operational QA Audit Breakdown
              </h4>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-950/60 border border-slate-850 text-slate-500">
                Consensus Metrics Active
              </span>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl relative overflow-hidden">
                <div className="absolute right-2 top-2 w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span className="text-[10px] text-slate-500 font-semibold block">Total Audited</span>
                <h3 className="text-lg font-bold text-white mt-0.5 font-mono">{totalReviewed}</h3>
                <span className="text-[9px] text-slate-600 block mt-0.5">Sample set</span>
              </div>
              <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl relative overflow-hidden">
                <div className="absolute right-2 top-2 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-emerald-400 font-semibold block">Tasks Approved</span>
                <h3 className="text-lg font-bold text-emerald-400 mt-0.5 font-mono">{approvedCount}</h3>
                <span className="text-[9px] text-emerald-600/80 block mt-0.5">{approvedPct.toFixed(1)}% Ratio</span>
              </div>
              <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl relative overflow-hidden">
                <div className="absolute right-2 top-2 w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span className="text-[10px] text-rose-400 font-semibold block">Tasks Rejected</span>
                <h3 className="text-lg font-bold text-rose-400 mt-0.5 font-mono">{rejectedCount}</h3>
                <span className="text-[9px] text-rose-600/80 block mt-0.5">{rejectedPct.toFixed(1)}% Ratio</span>
              </div>
            </div>

            {totalReviewed > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                  <span>Validation Ratio</span>
                  <span className="text-emerald-400 font-bold">{approvedPct.toFixed(1)}% Approved</span>
                </div>
                <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden flex border border-slate-850">
                  <div 
                    style={{ width: `${approvedPct}%` }} 
                    className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-500" 
                  />
                  <div 
                    style={{ width: `${rejectedPct}%` }} 
                    className="bg-gradient-to-r from-rose-500 to-orange-500 h-full transition-all duration-500" 
                  />
                </div>
              </div>
            )}
          </div>

          {/* ML Model Training & Inference Hub */}
          <div className="bg-slate-900/30 backdrop-blur-md border border-slate-800/80 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5 font-display">
                <Brain className="w-4 h-4 text-indigo-400" />
                Local ML Model Training Hub
              </h4>
              <span className="text-[9px] font-bold text-cyan-400 tracking-wider bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20 flex items-center gap-1">
                <Cpu className="w-2.5 h-2.5 animate-spin" />
                Ollama Engine Active
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Training section */}
              <div className="space-y-3 bg-slate-950/20 p-4 rounded-xl border border-slate-850 flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-white text-xs font-semibold">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span>Pipeline Controller</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Train a custom text classifier using `scikit-learn` (LogisticRegression + CountVectorizer) utilizing active QA-approved text annotations.
                  </p>
                </div>
                
                <div className="space-y-2 mt-2">
                  <button
                    type="button"
                    onClick={handleTrainModel}
                    disabled={training}
                    className="w-full py-2 bg-gradient-to-r from-cyan-600 via-indigo-600 to-indigo-700 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-md active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {training ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin text-white" />
                        Training Pipeline Active...
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-current text-white" />
                        Trigger Training Routine
                      </>
                    )}
                  </button>

                  {trainingMsg && (
                    <div className={`p-2 rounded-lg text-[10px] flex items-start gap-1.5 border leading-normal bg-rose-500/10 border-rose-500/20 text-rose-455 text-rose-400 ${
                      trainingSuccess 
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400!' 
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-400!'
                    }`}>
                      {trainingSuccess ? <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-400" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />}
                      <span>{trainingMsg}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Inference Section */}
              <form onSubmit={handleRunInference} className="space-y-3 bg-slate-950/20 p-4 rounded-xl border border-slate-850 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-white text-xs font-semibold">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    <span>Inference Playground</span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Input sample text snippet..."
                      value={testText}
                      onChange={(e) => setTestText(e.target.value)}
                      className="w-full pl-3 pr-8 py-2 bg-slate-900 border border-slate-800 rounded-lg text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={inferenceLoading || !testText.trim()}
                      className="absolute right-1 top-1 p-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded text-cyan-400 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      {inferenceLoading ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Play className="w-2.5 h-2.5 fill-current" />
                      )}
                    </button>
                  </div>
                </div>

                {inferenceResult && (
                  <div className="p-2 bg-slate-950/60 border border-slate-850 rounded-lg space-y-1.5 font-mono text-[10px] mt-2">
                    {inferenceResult.error ? (
                      <span className="text-rose-400 block leading-tight">{inferenceResult.error}</span>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-semibold">Predicted Class:</span>
                          <span className={`font-bold px-1.5 py-0.5 rounded uppercase tracking-wider text-[9px] ${
                            inferenceResult.predicted_label === 'Positive' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' :
                            inferenceResult.predicted_label === 'Negative' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/25' :
                            'bg-slate-500/10 text-slate-400 border border-slate-700/25'
                          }`}>
                            {inferenceResult.predicted_label}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Confidence:</span>
                          <div className="flex items-center gap-1.5">
                            <div className="w-12 h-1 bg-slate-900 rounded-full overflow-hidden border border-slate-850/60">
                              <div 
                                style={{ width: `${inferenceResult.confidence * 100}%` }} 
                                className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full" 
                              />
                            </div>
                            <span className="font-semibold text-white">{(inferenceResult.confidence * 100).toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* Annotator Productivity Leaderboard */}
          {user?.role?.toLowerCase() === 'admin' && (
            <div className="bg-slate-900/30 backdrop-blur-md border border-slate-800/80 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5 font-display">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Annotator Productivity Leaderboard
                </h4>
                <span className="text-[9px] text-slate-500 font-mono">
                  Monthly Cycle Standings
                </span>
              </div>
              
              <div className="overflow-x-auto rounded-lg border border-slate-850 overflow-hidden">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-slate-950/40 text-slate-400 font-semibold border-b border-slate-850 text-[9px] tracking-wider uppercase">
                      <th className="py-2 px-3 w-14">Rank</th>
                      <th className="py-2 px-3">Annotator</th>
                      <th className="py-2 px-3 text-center">Tasks Completed</th>
                      <th className="py-2 px-3 text-center">Accuracy Score</th>
                      <th className="py-2 px-3 text-right">PPU Earnings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 bg-slate-900/30">
                    {leaderboard.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500 font-semibold">
                          No annotator records found. Seed demo data to populate standings.
                        </td>
                      </tr>
                    ) : (
                      leaderboard.map((entry, index) => {
                        let rankBadge = '';
                        let rankStyle = 'text-slate-400';
                        let avatarBorder = 'border-slate-850 bg-slate-900/30';
                        if (index === 0) {
                          rankBadge = '🥇';
                          rankStyle = 'text-amber-400 font-bold';
                          avatarBorder = 'border-amber-500/40 bg-amber-500/10 text-amber-300';
                        } else if (index === 1) {
                          rankBadge = '🥈';
                          rankStyle = 'text-slate-300 font-bold';
                          avatarBorder = 'border-slate-500/40 bg-slate-500/10 text-slate-400';
                        } else if (index === 2) {
                          rankBadge = '🥉';
                          rankStyle = 'text-amber-600 font-bold';
                          avatarBorder = 'border-amber-500/40 bg-amber-500/10 text-amber-600';
                        }
                        
                        return (
                          <tr key={entry.username} className="hover:bg-slate-950/30 transition-all duration-150">
                            <td className="py-2 px-3 font-mono font-bold">
                              <div className="flex items-center gap-1">
                                {rankBadge && <span className="text-xs">{rankBadge}</span>}
                                <span className={rankStyle}>#{index + 1}</span>
                              </div>
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded border flex items-center justify-center font-bold text-[9px] ${avatarBorder}`}>
                                  {entry.username.slice(0, 2).toUpperCase()}
                                </div>
                                <span className="font-semibold text-white hover:text-cyan-400 transition-colors cursor-pointer">{entry.username}</span>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-semibold text-slate-300">
                              {entry.tasks_completed}
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex flex-col items-center gap-0.5">
                                <span className={`px-1.5 py-0.25 rounded font-mono font-bold text-[9px] border ${
                                  entry.accuracy_rating >= 90 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                  entry.accuracy_rating >= 75 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                  'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                }`}>
                                  {entry.accuracy_rating.toFixed(1)}%
                                </span>
                                <div className="w-12 h-0.5 bg-slate-950 rounded-full overflow-hidden hidden sm:block border border-slate-850/40">
                                  <div 
                                    style={{ width: `${entry.accuracy_rating}%` }} 
                                    className={`h-full ${
                                      entry.accuracy_rating >= 90 ? 'bg-emerald-400' :
                                      entry.accuracy_rating >= 75 ? 'bg-amber-400' :
                                      'bg-rose-400'
                                    }`}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-right text-emerald-400 font-mono font-black">
                              ${entry.ppu_earnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Recent Activity Feed / Audit Trail */}
        <div className="bg-slate-900/30 backdrop-blur-md border border-slate-800/80 rounded-xl p-4 space-y-4 flex flex-col h-[520px] overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 shrink-0">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5 font-display">
              <Clock className="w-4 h-4 text-indigo-400" />
              {user?.role?.toLowerCase() === 'admin' ? 'System Audit Trail' : 'Recent Platform Activity'}
            </h4>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">Live Logs</span>
            </div>
          </div>
          
          <div className="relative flex-1 overflow-y-auto pr-1 flex flex-col space-y-3 custom-scrollbar">
            {/* Timeline path line */}
            <div className="absolute left-2 top-1.5 bottom-1.5 border-l border-slate-800/80" />
            
            {activities.length === 0 ? (
              <div className="text-center py-12 text-[11px] text-slate-500 font-semibold">
                No system activities recorded.
              </div>
            ) : (
              activities.map((activity) => (
                <div key={activity.id} className="relative flex gap-3 text-[11px] leading-relaxed group">
                  {/* Timeline circle dot */}
                  <div className={`w-4 h-4 rounded-full z-10 bg-slate-950 border flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 duration-200 ${
                    activity.action ? (
                      activity.action.startsWith('QA_APPROVE') ? 'border-emerald-500 text-emerald-400' :
                      activity.action.startsWith('QA_REJECT') ? 'border-rose-500 text-rose-400' :
                      activity.action.startsWith('USER_') ? 'border-blue-500 text-blue-400' :
                      activity.action.startsWith('TASK_CREATE') || activity.action.startsWith('TASK_BULK') ? 'border-cyan-500 text-cyan-400' :
                      'border-indigo-500 text-indigo-400'
                    ) : 'border-slate-700 text-slate-400'
                  }`}>
                    <div className={`w-1 h-1 rounded-full ${
                      activity.action ? (
                        activity.action.startsWith('QA_APPROVE') ? 'bg-emerald-500' :
                        activity.action.startsWith('QA_REJECT') ? 'bg-rose-500' :
                        activity.action.startsWith('USER_') ? 'bg-blue-500' :
                        activity.action.startsWith('TASK_CREATE') || activity.action.startsWith('TASK_BULK') ? 'bg-cyan-500' :
                        'bg-indigo-500'
                      ) : 'bg-slate-500'
                    }`} />
                  </div>

                  <div className="flex-1 space-y-1 p-2.5 bg-slate-950/20 border border-slate-800/80 hover:border-slate-800 rounded-lg transition-all duration-200">
                    <div className="flex justify-between items-start gap-1.5">
                      <span className="text-[8px] font-bold px-1 py-0.25 rounded uppercase tracking-wider bg-slate-900 border border-slate-850 font-mono text-slate-500">
                        {activity.action || 'system'}
                      </span>
                      {activity.timestamp && (
                        <span className="text-[8px] text-slate-500 font-mono">
                          {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-300 font-medium leading-normal text-[11px]">
                      {renderActivityMessage(activity)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
