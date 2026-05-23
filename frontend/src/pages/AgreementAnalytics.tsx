import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { API_BASE_URL } from '../config';
import { 
  Users, 
  RotateCw, 
  Brain, 
  ShieldCheck, 
  Sparkles, 
  Check, 
  X, 
  AlertCircle,
  HelpCircle,
  TrendingUp
} from 'lucide-react';

interface AnnotationDetail {
  username: string;
  label: string;
  version: number;
  created_at: string;
}

interface IAATaskDetail {
  task_id: number;
  type: string;
  data: string;
  annotations: AnnotationDetail[];
  agreement_rate: number;
}

interface IAAMetrics {
  human_human: {
    total_tasks: number;
    percentage_agreement: number;
    fleiss_kappa: number;
    unanimous_count: number;
    details: IAATaskDetail[];
  };
  human_ai: {
    total_tasks: number;
    agreement_rate: number;
    accepted: number;
    corrected: number;
  };
  human_qa: {
    total_tasks: number;
    agreement_rate: number;
    approved: number;
    rejected: number;
  };
}

const AgreementAnalytics: React.FC = () => {
  const { token } = useSelector((state: RootState) => state.auth);
  
  const [metrics, setMetrics] = useState<IAAMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [toastTimeout, setToastTimeout] = useState<any | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }
    setToast({ message, type });
    const timer = setTimeout(() => {
      setToast(null);
    }, 4000);
    setToastTimeout(timer);
  };

  useEffect(() => {
    return () => {
      if (toastTimeout) clearTimeout(toastTimeout);
    };
  }, [toastTimeout]);

  const fetchAgreementMetrics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/annotations/agreement`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      } else {
        showToast("Failed to fetch agreement analytics from server.", 'error');
      }
    } catch (err) {
      console.error("Error loading agreement metrics:", err);
      showToast("Network error loading agreement metrics.", 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchAgreementMetrics();
    }
  }, [token]);

  const handleSeedDemoData = async () => {
    setSeeding(true);
    try {
      const response = await fetch(`${API_BASE_URL}/annotations/seed-iaa`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        showToast(`Successfully seeded ${data.tasks_seeded} tasks with multi-worker annotations!`, 'success');
        fetchAgreementMetrics();
      } else {
        showToast("Failed to seed demo data.", 'error');
      }
    } catch (err) {
      console.error("Error seeding IAA demo data:", err);
      showToast("Network error seeding demo data.", 'error');
    } finally {
      setSeeding(false);
    }
  };

  const getKappaInterpretation = (kappa: number) => {
    if (kappa >= 0.81) return { label: 'Almost Perfect', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25' };
    if (kappa >= 0.61) return { label: 'Substantial', color: 'text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border-cyan-500/25' };
    if (kappa >= 0.41) return { label: 'Moderate', color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-950/20 border-indigo-500/25' };
    if (kappa >= 0.21) return { label: 'Fair', color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/25' };
    if (kappa >= 0.0) return { label: 'Slight', color: 'text-slate-650 dark:text-slate-400 bg-slate-500/10 border-slate-500/20' };
    return { label: 'Poor Agreement', color: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/25' };
  };

  if (loading && !metrics) {
    return (
      <div className="p-8 text-center text-slate-400 flex flex-col justify-center items-center h-[60vh] gap-4">
        <RotateCw className="w-10 h-10 animate-spin text-cyan-400" />
        <span className="text-sm font-medium">Calculating Inter-Annotator Agreement statistics...</span>
      </div>
    );
  }

  const humanStats = metrics?.human_human;
  const aiStats = metrics?.human_ai;
  const qaStats = metrics?.human_qa;
  const hasHumanData = humanStats && humanStats.total_tasks > 0;

  return (
    <div className="p-5 md:p-6 space-y-6 animate-fade-in">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-slate-800/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-cyan-400">
            <Users className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider font-mono">Consensus Diagnostics</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight font-display">Inter-Annotator Agreement (IAA) Analytics</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Consolidated telemetry monitoring annotator consensus (Fleiss' Kappa), copilot alignment, and expert QA concordance.
          </p>
        </div>
        <div className="flex gap-3 shrink-0 w-full sm:w-auto">
          <button
            onClick={fetchAgreementMetrics}
            className="flex-1 sm:flex-initial px-4 py-2 bg-slate-900/40 hover:bg-slate-950/40 border border-slate-800/80 text-cyan-400 hover:text-cyan-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Recalculate
          </button>
          <button
            onClick={handleSeedDemoData}
            disabled={seeding}
            className="flex-1 sm:flex-initial px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md hover:shadow-cyan-500/10 active:scale-[0.98]"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {seeding ? 'Seeding...' : 'Seed Demo Data'}
          </button>
        </div>
      </div>

      {/* 3-Column Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Human Consensus */}
        <div className="group relative bg-slate-900/30 border border-slate-800/80 hover:border-cyan-500/30 rounded-xl p-5 transition-all duration-300 shadow-md">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Human Consensus</span>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold text-white font-mono">{hasHumanData ? humanStats.fleiss_kappa.toFixed(3) : '0.000'}</span>
                {hasHumanData && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${getKappaInterpretation(humanStats.fleiss_kappa).color}`}>
                    {getKappaInterpretation(humanStats.fleiss_kappa).label}
                  </span>
                )}
              </div>
            </div>
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
          </div>
          
          <div className="mt-4 pt-3 border-t border-slate-800/50 space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Agreement Index</span>
              <span className="text-cyan-400 font-mono font-semibold">{hasHumanData ? humanStats.percentage_agreement.toFixed(1) : '0.0'}%</span>
            </div>
            <div className="w-full bg-slate-950/40 rounded-full h-1 overflow-hidden">
              <div 
                className="bg-cyan-500 h-full rounded-full transition-all duration-350"
                style={{ width: `${hasHumanData ? humanStats.percentage_agreement : 0}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
              {hasHumanData ? (
                <>Across <span className="text-slate-350 font-medium">{humanStats.total_tasks} tasks</span>. Unanimous on <span className="text-slate-350 font-medium">{humanStats.unanimous_count}</span>.</>
              ) : (
                "No multi-annotated task data available."
              )}
            </p>
          </div>
        </div>

        {/* Card 2: AI Copilot Alignment */}
        <div className="group relative bg-slate-900/30 border border-slate-800/80 hover:border-indigo-500/30 rounded-xl p-5 transition-all duration-300 shadow-md">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">AI Copilot Alignment</span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-white font-mono">{aiStats && aiStats.total_tasks > 0 ? `${aiStats.agreement_rate.toFixed(1)}%` : '100.0%'}</span>
              </div>
            </div>
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg">
              <Brain className="w-4 h-4" />
            </div>
          </div>
          
          <div className="mt-4 pt-3 border-t border-slate-800/50 space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Acceptance Rate</span>
              <span className="text-indigo-400 font-mono font-semibold">{aiStats ? aiStats.accepted : 0} / {aiStats ? aiStats.total_tasks : 0}</span>
            </div>
            <div className="w-full bg-slate-950/40 rounded-full h-1 overflow-hidden">
              <div 
                className="bg-indigo-500 h-full rounded-full transition-all duration-350"
                style={{ width: `${aiStats && aiStats.total_tasks > 0 ? aiStats.agreement_rate : 100}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
              {aiStats && aiStats.total_tasks > 0 ? (
                <>Annotators corrected <span className="text-slate-350 font-medium">{aiStats.corrected}</span> suggestions.</>
              ) : (
                "AI-assisted annotation metrics will populate upon submission."
              )}
            </p>
          </div>
        </div>

        {/* Card 3: Expert QA Concordance */}
        <div className="group relative bg-slate-900/30 border border-slate-800/80 hover:border-emerald-500/30 rounded-xl p-5 transition-all duration-300 shadow-md">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Expert QA Concordance</span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-white font-mono">{qaStats && qaStats.total_tasks > 0 ? `${qaStats.agreement_rate.toFixed(1)}%` : '100.0%'}</span>
              </div>
            </div>
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 rounded-lg">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          
          <div className="mt-4 pt-3 border-t border-slate-800/50 space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Auditor Approval</span>
              <span className="text-emerald-400 font-mono font-semibold">{qaStats ? qaStats.approved : 0} / {qaStats ? qaStats.total_tasks : 0}</span>
            </div>
            <div className="w-full bg-slate-950/40 rounded-full h-1 overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-350"
                style={{ width: `${qaStats && qaStats.total_tasks > 0 ? qaStats.agreement_rate : 100}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
              {qaStats && qaStats.total_tasks > 0 ? (
                <>Auditors flagged <span className="text-rose-500 dark:text-rose-400 font-medium">{qaStats.rejected}</span> annotations as incorrect.</>
              ) : (
                "QA reviews will track concordance once verification begins."
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Empty State warning if no multi-annotator data */}
      {!hasHumanData && (
        <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-8 text-center space-y-4 shadow-md flex flex-col justify-center items-center max-w-md mx-auto min-h-[250px]">
          <HelpCircle className="w-12 h-12 text-slate-500 mx-auto animate-pulse" />
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-white">No Multi-Annotated Tasks Found</h3>
            <p className="text-xs text-slate-450 max-w-sm mx-auto leading-relaxed">
              Inter-annotator agreement metrics and Fleiss' Kappa require annotations from at least two distinct annotators per task.
            </p>
          </div>
          <button
            onClick={handleSeedDemoData}
            disabled={seeding}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-md"
          >
            {seeding ? 'Generating Data...' : 'Generate Demo IAA Dataset'}
          </button>
        </div>
      )}

      {/* Full-width Detailed Consensus Breakdown Table */}
      {hasHumanData && humanStats.details.length > 0 && (
        <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl overflow-hidden shadow-lg shadow-black/5 p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white font-display">Detailed Annotator Agreement Consensus</h3>
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {humanStats.details.length} Tasks Tracked
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/30 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                  <th className="px-4 py-3 w-28">Task ID</th>
                  <th className="px-4 py-3 w-24">Type</th>
                  <th className="px-4 py-3">Content Passage / Data Source</th>
                  <th className="px-4 py-3 w-[450px]">Worker Label Submissions</th>
                  <th className="px-4 py-3 w-32 text-right">Consensus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 bg-slate-900/10">
                {humanStats.details.map((task) => (
                  <tr key={task.task_id} className="hover:bg-slate-950/30 transition-colors text-slate-350">
                    <td className="px-4 py-3.5 font-mono font-bold text-slate-500 whitespace-nowrap">#00{task.task_id}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-500/10 border border-slate-500/20 text-slate-400 capitalize">
                        {task.type}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-xs text-slate-300 leading-relaxed font-normal italic max-w-md truncate" title={task.data}>
                        "{task.data}"
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-2">
                        {task.annotations.map((ann, idx) => {
                          let disp = ann.label;
                          if (task.type === 'video') {
                            try {
                              const p = JSON.parse(ann.label);
                              disp = `${p.label} [${Math.floor(p.start_time)}s-${Math.floor(p.end_time)}s]`;
                            } catch (_) {}
                          }
                          return (
                            <div key={idx} className="inline-flex items-center gap-1.5 bg-slate-950/40 border border-slate-800/60 rounded-xl px-2.5 py-0.5 text-[11px] hover:border-slate-700 transition-colors">
                              <span className="text-slate-450 font-semibold">@{ann.username}</span>
                              <span className="text-slate-500 font-bold">•</span>
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                disp.startsWith('Positive') ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                                disp.startsWith('Negative') ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20' :
                                'bg-slate-500/10 text-slate-600 dark:text-slate-300 border border-slate-500/20'
                              }`}>
                                <span className={`w-1 h-1 rounded-full ${
                                  disp.startsWith('Positive') ? 'bg-emerald-500' :
                                  disp.startsWith('Negative') ? 'bg-rose-500' :
                                  'bg-slate-500'
                                }`} />
                                {disp}
                              </span>
                              <span className="text-[9px] text-slate-500 font-mono opacity-80">v{ann.version}</span>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-12 bg-slate-950/40 rounded-full h-1 overflow-hidden border border-slate-800/50">
                          <div 
                            className={`h-full rounded-full ${
                              task.agreement_rate === 100 ? 'bg-emerald-500' :
                              task.agreement_rate >= 60 ? 'bg-amber-500' :
                              'bg-rose-500'
                            }`}
                            style={{ width: `${task.agreement_rate}%` }}
                          />
                        </div>
                        <span className={`text-[11px] font-bold font-mono ${
                          task.agreement_rate === 100 ? 'text-emerald-600 dark:text-emerald-400' :
                          task.agreement_rate >= 60 ? 'text-amber-600 dark:text-amber-400' :
                          'text-rose-600 dark:text-rose-400'
                        }`}>
                          {task.agreement_rate.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md transition-all duration-300 animate-slide-in-right ${
          toast.type === 'success' 
            ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-400' 
            : 'bg-rose-950/80 border-rose-500/30 text-rose-400'
        }`}>
          {toast.type === 'success' ? (
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <X className="w-4 h-4 shrink-0 text-rose-400" />
          )}
          <span className="text-xs font-semibold pr-1">{toast.message}</span>
          <button 
            onClick={() => setToast(null)}
            className="ml-1 hover:opacity-85 hover:bg-slate-800/40 p-1 rounded transition-all"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default AgreementAnalytics;
