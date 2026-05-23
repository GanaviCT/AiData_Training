import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { setActiveTask } from '../store/taskSlice';
import { API_BASE_URL } from '../config';
import { 
  Sparkles, 
  ArrowLeft, 
  RotateCcw, 
  CheckCircle,
  HelpCircle,
  Database,
  History,
  AlertCircle,
  ExternalLink
} from 'lucide-react';

interface AnnotationHistory {
  id: number;
  label: string;
  confidence: number;
  version: number;
  created_at: string;
  created_by: { username: string };
}

interface AnnotationPageProps {
  setActivePage: (page: string) => void;
}

const AnnotationPage: React.FC<AnnotationPageProps> = ({ setActivePage }) => {
  const dispatch = useDispatch();
  const { token } = useSelector((state: RootState) => state.auth);
  const { activeTask } = useSelector((state: RootState) => state.tasks);
  
  const [selectedLabel, setSelectedLabel] = useState('');
  const [confidence, setConfidence] = useState(1.0);
  const [isAiAssisted, setIsAiAssisted] = useState(false);
  const [originalLabel, setOriginalLabel] = useState<string | null>(null);

  // AI Suggestion State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ label: string; confidence: number } | null>(null);

  // Annotation Versioning History
  const [history, setHistory] = useState<AnnotationHistory[]>([]);

  // Image load error fallback state
  const [imageError, setImageError] = useState(false);

  // Video States
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const renderLabel = (label: string, taskType: string) => {
    if (taskType === 'video') {
      try {
        const parsed = JSON.parse(label);
        return `${parsed.label} (${formatTime(parsed.start_time)} - ${formatTime(parsed.end_time)})`;
      } catch (e) {
        return label;
      }
    }
    return label;
  };

  // Categories
  const categories = activeTask?.type === 'text' 
    ? ['Positive', 'Negative', 'Neutral']
    : activeTask?.type === 'video'
    ? ['Action', 'Speech', 'Landscape', 'Commercial', 'Silent']
    : ['Nature', 'Urban', 'People', 'Animals', 'Interior'];

  // Fetch past version history for this task
  const fetchHistory = async () => {
    if (!activeTask) return;
    try {
      const response = await fetch(`${API_BASE_URL}/annotations/${activeTask.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Error loading history:", err);
    }
  };

  useEffect(() => {
    fetchHistory();
    // Reset inputs
    setSelectedLabel('');
    setConfidence(1.0);
    setIsAiAssisted(false);
    setOriginalLabel(null);
    setAiSuggestion(null);
    setImageError(false);
    setDuration(0);
    setStartTime(0);
    setEndTime(0);
    setVideoCurrentTime(0);
  }, [activeTask]);

  // Request local LLM suggestion
  const getAiSuggestion = async () => {
    if (!activeTask || activeTask.type !== 'text') return;
    setAiLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/ai/suggest-label`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text: activeTask.data,
          categories: categories
        })
      });
      if (response.ok) {
        const data = await response.json();
        setAiSuggestion(data);
      }
    } catch (err) {
      console.error("AI suggest failed:", err);
    } finally {
      setAiLoading(false);
    }
  };

  const acceptAiSuggestion = () => {
    if (!aiSuggestion) return;
    setSelectedLabel(aiSuggestion.label);
    setConfidence(aiSuggestion.confidence);
    setIsAiAssisted(true);
    setOriginalLabel(aiSuggestion.label);
  };

  const handleSubmitAnnotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTask || !selectedLabel) return;

    // Detect if human corrected the AI suggestions
    let correctedLabel: string | null = null;
    if (isAiAssisted && originalLabel !== selectedLabel) {
      correctedLabel = originalLabel; // Store the original AI label to record human correction feedback loop
    }

    const finalLabel = activeTask.type === 'video'
      ? JSON.stringify({ label: selectedLabel, start_time: startTime, end_time: endTime })
      : selectedLabel;

    try {
      const response = await fetch(`${API_BASE_URL}/annotations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          task_id: activeTask.id,
          label: finalLabel,
          confidence: confidence,
          corrected_label: correctedLabel
        })
      });

      if (response.ok) {
        dispatch(setActiveTask(null));
        window.dispatchEvent(new CustomEvent('qa-count-updated'));
        setActivePage('tasks');
      }
    } catch (err) {
      console.error("Failed submitting annotation:", err);
    }
  };

  if (!activeTask) {
    return (
      <div className="p-8 text-center text-slate-400">
        <HelpCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        No active task selected. Please select a task from the management queue.
      </div>
    );
  }

  return (
    <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Back button */}
      <div className="lg:col-span-3">
        <button
          onClick={() => setActivePage('tasks')}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Task Management Queue
        </button>
      </div>

      {/* Main workspace layout */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-3xl p-6 relative overflow-hidden">
          <div className="flex items-center justify-between mb-4 border-b border-slate-850 pb-4">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Task #{activeTask.id} ({activeTask.type} payload)
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
              activeTask.priority === 'high' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-slate-800 text-slate-400'
            }`}>
              {activeTask.priority} Priority
            </span>
          </div>

          {/* Text workspace */}
          {activeTask.type === 'text' && (
            <div className="p-6 bg-slate-950/60 border border-slate-850 rounded-2xl text-white text-base leading-relaxed font-sans min-h-[180px] flex items-center justify-center">
              "{activeTask.data}"
            </div>
          )}

          {/* Image workspace */}
          {activeTask.type === 'image' && (
            <div className="w-full flex flex-col items-center justify-center bg-slate-950/40 border border-slate-850 rounded-2xl p-6 min-h-[300px]">
              {imageError ? (
                <div className="flex flex-col items-center justify-center text-center p-6 space-y-4 max-w-md">
                  <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-2xl">
                    <AlertCircle className="w-8 h-8 text-red-400" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="text-sm font-bold text-white">Image Failed to Load</h5>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      The image could not be rendered directly. This usually happens if the link is a web page (not a direct image file) or if the host blocks external connections (CORS policy).
                    </p>
                  </div>
                  <div className="text-[10px] bg-slate-950/60 p-2.5 rounded-lg border border-slate-850 w-full break-all font-mono text-slate-400">
                    {activeTask.data}
                  </div>
                  <a
                    href={activeTask.data}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 transition text-xs font-semibold text-white px-4 py-2 rounded-xl shadow-md cursor-pointer"
                  >
                    Open Link in New Tab
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : (
                <img
                  src={activeTask.data}
                  alt="Annotation Payload"
                  onError={() => setImageError(true)}
                  className="max-h-[350px] object-contain rounded-xl shadow-lg border border-slate-800"
                />
              )}
            </div>
          )}
          
          {/* Video workspace */}
          {activeTask.type === 'video' && (
            <div className="w-full flex flex-col space-y-4 bg-slate-950/40 border border-slate-850 rounded-2xl p-6 min-h-[300px]">
              <div className="relative w-full rounded-xl overflow-hidden border border-slate-800 bg-black flex items-center justify-center">
                <video
                  ref={videoRef}
                  src={activeTask.data}
                  onLoadedMetadata={() => {
                    if (videoRef.current) {
                      const dur = videoRef.current.duration;
                      setDuration(dur);
                      setEndTime(dur);
                    }
                  }}
                  onTimeUpdate={() => {
                    if (videoRef.current) {
                      setVideoCurrentTime(videoRef.current.currentTime);
                    }
                  }}
                  className="max-h-[300px] w-full object-contain"
                />
              </div>
              
              {/* Video Controls Panel */}
              <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-xl space-y-4">
                {/* Playback Controls & Tracker */}
                <div className="flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (videoRef.current) {
                        if (videoRef.current.paused) {
                          videoRef.current.play();
                        } else {
                          videoRef.current.pause();
                        }
                      }
                    }}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-cyan-400 hover:text-cyan-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {videoRef.current && !videoRef.current.paused ? 'Pause' : 'Play'}
                  </button>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Position: {formatTime(videoCurrentTime)} / {formatTime(duration)}
                  </div>
                </div>

                {/* Timeline visualization */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">Start Segment Time: <strong className="text-white font-mono">{formatTime(startTime)}</strong></span>
                      <button
                        type="button"
                        onClick={() => setStartTime(Math.min(videoCurrentTime, endTime))}
                        className="text-[9px] text-cyan-400 hover:text-cyan-300 font-bold"
                      >
                        Set to Current Time
                      </button>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      step={0.1}
                      value={startTime}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setStartTime(val);
                        if (val > endTime) {
                          setEndTime(val);
                        }
                      }}
                      className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-855 rounded-lg"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">End Segment Time: <strong className="text-white font-mono">{formatTime(endTime)}</strong></span>
                      <button
                        type="button"
                        onClick={() => setEndTime(Math.max(videoCurrentTime, startTime))}
                        className="text-[9px] text-cyan-400 hover:text-cyan-300 font-bold"
                      >
                        Set to Current Time
                      </button>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      step={0.1}
                      value={endTime}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setEndTime(val);
                        if (val < startTime) {
                          setStartTime(val);
                        }
                      }}
                      className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-855 rounded-lg"
                    />
                  </div>

                  {/* Colored segment representation */}
                  <div className="h-2.5 w-full bg-slate-950 rounded-full relative overflow-hidden border border-slate-850 mt-2">
                    {duration > 0 && (
                      <div
                        className="absolute h-full bg-gradient-to-r from-cyan-500/50 to-indigo-500/50 border-x border-cyan-400/30"
                        style={{
                          left: `${(startTime / duration) * 100}%`,
                          width: `${((endTime - startTime) / duration) * 100}%`
                        }}
                      />
                    )}
                    {duration > 0 && (
                      <div
                        className="absolute h-full w-0.5 bg-yellow-400"
                        style={{ left: `${(videoCurrentTime / duration) * 100}%` }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Version Control Logs */}
        {history.length > 0 && (
          <div className="bg-slate-900/25 border border-slate-800 rounded-2xl p-6">
            <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
              <History className="w-4 h-4 text-cyan-400" />
              Annotation History & Version Logs
            </h4>
            <div className="space-y-3">
              {history.map((hist) => (
                <div key={hist.id} className="p-3 bg-slate-950/30 border border-slate-850/60 rounded-xl flex items-center justify-between text-xs text-slate-400">
                  <div>
                    <span className="font-semibold text-white">v{hist.version}</span> - Tagged as <span className="text-cyan-400 font-medium">{renderLabel(hist.label, activeTask.type)}</span>
                    <span className="text-[10px] text-slate-500 ml-2">by @{hist.created_by.username}</span>
                  </div>
                  <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">
                    Confidence: {(hist.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Control panel (Right Sidebar) */}
      <div className="space-y-6">
        {/* Local LLM Assistant */}
        {activeTask.type === 'text' && (
          <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-3xl p-6 space-y-4 relative overflow-hidden">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <h4 className="font-display font-bold text-sm text-white">Local AI Copilot</h4>
            </div>
            
            <p className="text-xs text-slate-400 leading-relaxed">
              Use the local <strong>mistral</strong> LLM running locally via Ollama to predict tags and calculate confidence score.
            </p>

            {aiSuggestion ? (
              <div className="p-4 bg-indigo-950/20 border border-indigo-500/30 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-indigo-300 font-semibold">AI Recommendation</span>
                  <span className="text-xs font-bold text-white bg-indigo-500/30 px-2 py-0.5 rounded-full">
                    {(aiSuggestion.confidence * 100).toFixed(0)}% Confidence
                  </span>
                </div>
                <div className="text-lg font-bold text-white tracking-wide">
                  {aiSuggestion.label}
                </div>
                <button
                  type="button"
                  onClick={acceptAiSuggestion}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  Accept AI Suggestion
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={getAiSuggestion}
                disabled={aiLoading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-md shadow-indigo-500/10"
              >
                {aiLoading ? 'AI Thinking...' : 'Suggest Label'}
                {!aiLoading && <Sparkles className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        )}

        {/* Manual Annotation Form */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-3xl p-6">
          <form onSubmit={handleSubmitAnnotation} className="space-y-6">
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Assign Category / Tag
              </label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedLabel(cat)}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                      selectedLabel === cat
                        ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400'
                        : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* If corrected label */}
            {isAiAssisted && originalLabel !== selectedLabel && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[10px] text-amber-400 leading-normal">
                <strong>Feedback Loop Active:</strong> You edited the AI label (originally <em>{originalLabel}</em>). This modification will be logged in the database to optimize LLM prompting.
              </div>
            )}

            <button
              type="submit"
              disabled={!selectedLabel}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-bold rounded-2xl text-xs tracking-wider uppercase transition-all shadow-lg shadow-cyan-500/10 active:scale-95 disabled:opacity-40"
            >
              Submit Annotation
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AnnotationPage;
