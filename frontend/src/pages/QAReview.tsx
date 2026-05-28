import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { API_BASE_URL } from '../config';
import { Check, X, ShieldAlert, AlertCircle, ExternalLink, Shuffle, RefreshCw, Layers } from 'lucide-react';

interface QAItem {
  id: number;
  type: string;
  data: string;
  status: string;
  priority: string;
  cost: number;
  assigned_to: { username: string } | null;
  annotations: Array<{
    id: number;
    label: string;
    confidence: number;
    created_by: { username: string; email?: string };
    qa_results: Array<{
      id: number;
      approved: boolean;
      comments: string;
    }>;
  }>;
}

const QAImagePayload: React.FC<{ src: string }> = ({ src }) => {
  const [imageError, setImageError] = useState(false);

  if (imageError) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-3 space-y-2 bg-slate-950/40 border border-slate-850 rounded-xl w-full">
        <div className="flex items-center gap-1.5 text-xs text-red-400 font-semibold justify-center">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Failed to load image</span>
        </div>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded-lg transition cursor-pointer font-semibold shadow"
        >
          Open Link
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt="QA payload"
      onError={() => setImageError(true)}
      className="max-h-[140px] rounded-lg object-contain shadow cursor-pointer border border-slate-800 hover:border-indigo-500/50 transition duration-200"
      onClick={() => window.open(src, '_blank')}
    />
  );
};

const QAReview: React.FC = () => {
  const { token, user } = useSelector((state: RootState) => state.auth);
  const isAdmin = user?.role === 'admin';
  const [items, setItems] = useState<QAItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [toastTimeout, setToastTimeout] = useState<any | null>(null);

  // Reviewer comment state
  const [comments, setComments] = useState<{ [key: number]: string }>({});

  // Spot-Check / Audit Sampling State
  const [isSpotCheckMode, setIsSpotCheckMode] = useState(false);
  const [spotCheckConfig, setSpotCheckConfig] = useState<{ type: 'percentage' | 'count'; value: number }>({
    type: 'percentage',
    value: 20
  });
  const [spotCheckActive, setSpotCheckActive] = useState(false);
  const [spotCheckItems, setSpotCheckItems] = useState<QAItem[]>([]);
  const [reviewedSessionIds, setReviewedSessionIds] = useState<number[]>([]);
  const [sessionReviews, setSessionReviews] = useState<{ [key: number]: { approved: boolean; comments: string } }>({});
  const [showCompletionModal, setShowCompletionModal] = useState(false);

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

  const fetchCompletedTasks = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/tasks?status=completed`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setItems(data);
      }
    } catch (err) {
      console.error("Error loading completed tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompletedTasks();
  }, [token]);

  const handleStartSpotCheck = async () => {
    setLoading(true);
    try {
      const queryParam = spotCheckConfig.type === 'percentage' 
        ? `percentage=${spotCheckConfig.value}` 
        : `count=${spotCheckConfig.value}`;
        
      const response = await fetch(`${API_BASE_URL}/qa/sample?${queryParam}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.length === 0) {
          showToast("No pending completed tasks in queue to sample.", 'error');
        } else {
          setSpotCheckItems(data);
          setSpotCheckActive(true);
          setReviewedSessionIds([]);
          setSessionReviews({});
          showToast(`Generated spot-check sample with ${data.length} tasks!`, 'success');
        }
      } else {
        showToast("Failed to fetch spot-check sample from server.", 'error');
      }
    } catch (err) {
      console.error("Error loading spot check sample:", err);
      showToast("Network error generating spot-check.", 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSession = () => {
    setSpotCheckActive(false);
    setSpotCheckItems([]);
    setReviewedSessionIds([]);
    setSessionReviews({});
    fetchCompletedTasks();
    showToast("Spot-check session cancelled.", 'error');
  };

  const handleFinishSession = () => {
    setShowCompletionModal(false);
    setSpotCheckActive(false);
    setSpotCheckItems([]);
    setReviewedSessionIds([]);
    setSessionReviews({});
    fetchCompletedTasks();
  };

  useEffect(() => {
    if (spotCheckActive && spotCheckItems.length > 0 && reviewedSessionIds.length === spotCheckItems.length) {
      const timer = setTimeout(() => {
        setShowCompletionModal(true);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [reviewedSessionIds, spotCheckItems, spotCheckActive]);

  const handleReview = async (taskId: number, annotationId: number, approved: boolean) => {
    try {
      const response = await fetch(`${API_BASE_URL}/qa/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          annotation_id: annotationId,
          approved: approved,
          comments: comments[annotationId] || ''
        })
      });

      if (response.ok) {
        const taskItem = (spotCheckActive ? spotCheckItems : items).find(item => item.id === taskId);
        const latestAnnotation = taskItem?.annotations && taskItem.annotations.length > 0
          ? taskItem.annotations[taskItem.annotations.length - 1]
          : null;
        const annotatorEmail = latestAnnotation?.created_by?.email || (latestAnnotation?.created_by?.username && latestAnnotation.created_by.username.includes('@') ? latestAnnotation.created_by.username : 'ganavigowda.ct@gmail.com');

        if (spotCheckActive) {
          setReviewedSessionIds(prev => [...prev, taskId]);
          setSessionReviews(prev => ({
            ...prev,
            [taskId]: { approved, comments: comments[annotationId] || '' }
          }));

          if (approved) {
            const msg = `Task #00${taskId} approved in session! Notification sent to ${annotatorEmail}`;
            showToast(msg, 'success');
            alert(msg);
          } else {
            const msg = `Task #00${taskId} rejected in session! Notification sent to ${annotatorEmail}`;
            showToast(msg, 'error');
            alert(msg);
          }

          setComments(prev => {
            const copy = { ...prev };
            delete copy[annotationId];
            return copy;
          });
        } else {
          setItems(prev => prev.filter(item => item.id !== taskId));
          setComments(prev => {
            const copy = { ...prev };
            delete copy[annotationId];
            return copy;
          });

          if (approved) {
            const msg = `Task #00${taskId} approved successfully! Notification sent to ${annotatorEmail}`;
            showToast(msg, 'success');
            alert(msg);
          } else {
            const msg = `Task #00${taskId} rejected successfully! Notification sent to ${annotatorEmail}`;
            showToast(msg, 'error');
            alert(msg);
          }
        }

        window.dispatchEvent(new CustomEvent('qa-count-updated'));
      } else {
        const errData = await response.json();
        showToast(errData.detail || `Failed to submit review for Task #00${taskId}`, 'error');
      }
    } catch (err) {
      console.error("Failed submitting QA review:", err);
      showToast("Network error submitting review.", 'error');
    }
  };

  const pendingItems = items.filter(item => {
    const latestAnnotation = item.annotations && item.annotations.length > 0
      ? item.annotations[item.annotations.length - 1]
      : null;
    if (!latestAnnotation) return false;
    
    const hasBeenReviewed = latestAnnotation.qa_results && latestAnnotation.qa_results.length > 0;
    return !hasBeenReviewed;
  });

  const visibleItems = spotCheckActive ? spotCheckItems : pendingItems;

  return (
    <div className="p-8 space-y-6">
      {/* Alert Warning for QA SLA */}
      <div className="p-4 bg-indigo-950/20 border border-indigo-500/25 rounded-2xl flex items-center gap-3 text-indigo-300 text-xs">
        <ShieldAlert className="w-5 h-5 shrink-0" />
        {isAdmin ? (
          <span>
            <strong>Quality SLA Active:</strong> Double check label classifications. Any rejected tasks will return to the annotator queue with comments.
          </span>
        ) : (
          <span>
            <strong>View-Only Access:</strong> You are viewing pending QA reviews. Only administrators have permission to approve or reject annotations.
          </span>
        )}
      </div>

      {/* Spot Check Control Panel */}
      {isAdmin && (
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-3xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Shuffle className="w-4 h-4 text-indigo-400" />
                Audit Sampling & Quality Spot-Checks
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Select a randomized sample of pending annotations to perform focused quality audits.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {!spotCheckActive ? (
                <button
                  onClick={() => setIsSpotCheckMode(!isSpotCheckMode)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    isSpotCheckMode
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-650'
                      : 'bg-slate-950/40 border-slate-800/80 text-slate-300 hover:bg-slate-900/40'
                  }`}
                >
                  {isSpotCheckMode ? 'Hide Setup' : 'Setup Spot-Check'}
                </button>
              ) : (
                <button
                  onClick={handleCancelSession}
                  className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 hover:text-rose-350 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Cancel Session
                </button>
              )}
            </div>
          </div>

          {isSpotCheckMode && !spotCheckActive && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-850/60 items-end">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Sampling Type
                </label>
                <select
                  value={spotCheckConfig.type}
                  onChange={(e) => setSpotCheckConfig({ ...spotCheckConfig, type: e.target.value as 'percentage' | 'count' })}
                  className="w-full px-3.5 py-2 bg-slate-950/60 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
                >
                  <option value="percentage">Percentage (%) of Queue</option>
                  <option value="count">Fixed Task Count</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  {spotCheckConfig.type === 'percentage' ? 'Percentage Value (1-100)' : 'Number of Tasks'}
                </label>
                <input
                  type="number"
                  min="1"
                  max={spotCheckConfig.type === 'percentage' ? 100 : undefined}
                  value={spotCheckConfig.value}
                  onChange={(e) => setSpotCheckConfig({ ...spotCheckConfig, value: parseInt(e.target.value) || 1 })}
                  className="w-full px-3.5 py-2 bg-slate-950/60 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>
              <div>
                <button
                  onClick={handleStartSpotCheck}
                  className="w-full py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg hover:shadow-indigo-500/10 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  Generate Spot-Check
                </button>
              </div>
            </div>
          )}

          {spotCheckActive && (
            <div className="pt-4 border-t border-slate-850/60 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-indigo-300">
                  Active Spot-Check Session Progress
                </span>
                <span className="font-bold text-white">
                  {reviewedSessionIds.length} / {spotCheckItems.length} Tasks Audited
                </span>
              </div>
              <div className="w-full bg-slate-950/80 rounded-full h-2 overflow-hidden border border-slate-850">
                <div
                  className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${(reviewedSessionIds.length / spotCheckItems.length) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-400">Loading pending reviews...</div>
      ) : visibleItems.length === 0 ? (
        <div className="p-12 text-center text-slate-400 bg-slate-900/10 border border-slate-800/80 rounded-2xl">
          <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          No annotations awaiting QA review. Outstanding queue is empty.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {visibleItems.map((item) => {
            const latestAnnotation = item.annotations && item.annotations.length > 0
              ? item.annotations[item.annotations.length - 1]
              : null;

            if (!latestAnnotation) return null;
            const isAudited = spotCheckActive && reviewedSessionIds.includes(item.id);

            return (
              <div key={item.id} className="bg-slate-900/40 backdrop-blur-md border border-slate-855 rounded-3xl p-6 flex flex-col justify-between gap-5 relative overflow-hidden">
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex flex-col gap-2 border-b border-slate-850 pb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Task #00{item.id} ({item.type})
                      </span>
                      <span className="text-xs font-semibold text-slate-300">
                        Annotated by <strong className="text-white">@{latestAnnotation.created_by.username}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-emerald-300 text-[10px] font-semibold">
                        Submitted by @{latestAnnotation.created_by.username}
                      </span>
                      {item.assigned_to && (
                        <span className="px-1.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-md text-indigo-300 text-[10px] font-semibold">
                          Assigned to @{item.assigned_to.username}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Task Payload content */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Payload</span>
                    {item.type === 'text' ? (
                      <div className="p-3.5 bg-slate-950/50 border border-slate-850 rounded-xl text-xs text-white leading-normal italic">
                        "{item.data}"
                      </div>
                    ) : item.type === 'video' ? (
                      <div className="w-full flex flex-col items-center justify-center p-3 bg-slate-950/30 border border-slate-850 rounded-xl">
                        <video
                          src={item.data}
                          controls
                          className="max-h-[140px] rounded-lg object-contain border border-slate-800 focus:outline-none hover:border-indigo-500/50 transition duration-200"
                        />
                      </div>
                    ) : (
                      <div className="w-full flex items-center justify-center p-3 bg-slate-950/30 border border-slate-850 rounded-xl">
                        <QAImagePayload src={item.data} />
                      </div>
                    )}
                  </div>

                  {/* Submission Info */}
                  {(() => {
                    let displayLabel = latestAnnotation.label;
                    let videoRange = '';
                    if (item.type === 'video') {
                      try {
                        const parsed = JSON.parse(latestAnnotation.label);
                        displayLabel = parsed.label || latestAnnotation.label;
                        const formatTime = (secs: number) => {
                          const m = Math.floor(secs / 60);
                          const s = Math.floor(secs % 60);
                          return `${m}:${s < 10 ? '0' : ''}${s}`;
                        };
                        if (parsed.start_time !== undefined && parsed.end_time !== undefined) {
                          videoRange = `Segment: ${formatTime(parsed.start_time)} - ${formatTime(parsed.end_time)}`;
                        }
                      } catch (e) {
                        // Legacy label fallback
                      }
                    }
                    return (
                      <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/20 rounded-xl border border-slate-850/50">
                        <div>
                          <span className="text-[10px] text-slate-500 block">Submitted Tag</span>
                          <span className="text-xs font-bold text-cyan-400 capitalize">
                            {displayLabel}
                            {videoRange && <span className="block text-[10px] text-slate-400 font-normal mt-0.5">{videoRange}</span>}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Confidence Score</span>
                          <span className="text-xs font-semibold text-slate-350">
                            {(latestAnnotation.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Comment */}
                  {isAdmin && !isAudited && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Review Comments</span>
                      <input
                        type="text"
                        placeholder="Add correction comments on rejection"
                        value={comments[latestAnnotation.id] || ''}
                        onChange={(e) => setComments({ ...comments, [latestAnnotation.id]: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950/50 border border-slate-850 rounded-xl text-xs text-white placeholder-slate-650 focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Actions / View Only Mode / Audited Info */}
                {isAudited ? (
                  <div className={`p-3.5 rounded-xl border flex flex-col gap-1.5 ${
                    sessionReviews[item.id]?.approved 
                      ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400' 
                      : 'bg-rose-950/20 border-rose-500/20 text-rose-400'
                  }`}>
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      {sessionReviews[item.id]?.approved ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span>Audit Result: Approved</span>
                        </>
                      ) : (
                        <>
                          <X className="w-4 h-4 text-rose-400" />
                          <span>Audit Result: Rejected</span>
                        </>
                      )}
                    </div>
                    {sessionReviews[item.id]?.comments && (
                      <p className="text-[11px] text-slate-300 italic mt-0.5">
                        Comments: "{sessionReviews[item.id]?.comments}"
                      </p>
                    )}
                  </div>
                ) : isAdmin ? (
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => handleReview(item.id, latestAnnotation.id, false)}
                      className="flex-1 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-350 border border-rose-500/20 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                    <button
                      onClick={() => handleReview(item.id, latestAnnotation.id, true)}
                      className="flex-1 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 hover:text-emerald-300 border border-emerald-500/25 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      Approve
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 p-3 bg-slate-950/30 border border-slate-850 rounded-xl flex items-center justify-center gap-2 text-[11px] text-slate-400">
                    <ShieldAlert className="w-4 h-4 text-amber-500/80" />
                    <span>View-only mode (Admin approval required)</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCompletionModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-md w-full text-center space-y-6 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Layers className="w-8 h-8 text-indigo-400" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white tracking-wide">
                Spot-Check Session Complete!
              </h3>
              <p className="text-xs text-slate-400">
                You have audited all selected tasks in this random quality spot-check sample.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-2xl">
                <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Audited</span>
                <span className="text-lg font-bold text-white">{spotCheckItems.length}</span>
              </div>
              <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-2xl">
                <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider text-emerald-400">Approved</span>
                <span className="text-lg font-bold text-emerald-400">
                  {Object.values(sessionReviews).filter(r => r.approved).length}
                </span>
              </div>
              <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-2xl">
                <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider text-rose-400">Rejected</span>
                <span className="text-lg font-bold text-rose-400">
                  {Object.values(sessionReviews).filter(r => !r.approved).length}
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-950/50 border border-slate-850 rounded-2xl flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Sample Accuracy Rate</span>
              <span className={`text-base font-extrabold px-3 py-1 rounded-xl border ${
                (Object.values(sessionReviews).filter(r => r.approved).length / spotCheckItems.length * 100) >= 90
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              }`}>
                {spotCheckItems.length > 0 
                  ? `${(Object.values(sessionReviews).filter(r => r.approved).length / spotCheckItems.length * 100).toFixed(1)}%` 
                  : '0%'}
              </span>
            </div>

            <button
              onClick={handleFinishSession}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-indigo-500/10 cursor-pointer border-0"
            >
              Finish Spot-Check Session
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3.5 rounded-xl border shadow-2xl backdrop-blur-md transition-all duration-300 animate-slide-in-right ${
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

export default QAReview;

