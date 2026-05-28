import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { logout, updateUser } from '../store/authSlice';
import { API_BASE_URL } from '../config';
import { 
  Shield, 
  Trash2, 
  Database, 
  Download, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle,
  FileArchive,
  UploadCloud,
  Lock,
  QrCode
} from 'lucide-react';

interface BackupItem {
  filename: string;
  size_bytes: number;
  created_at: string;
}

const Settings: React.FC = () => {
  const dispatch = useDispatch();
  const { user, token } = useSelector((state: RootState) => state.auth);
  
  // Notification States
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // MFA States
  const [mfaEnabled, setMfaEnabled] = useState(user?.mfa_enabled || false);
  const [mfaSetupData, setMfaSetupData] = useState<{ secret: string; qr_code_url: string } | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [showMfaDisable, setShowMfaDisable] = useState(false);

  // GDPR States
  const [gdprConsent, setGdprConsent] = useState(user?.gdpr_consent || false);

  // Backup States
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Pending User Approvals States
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<Record<number, string>>({});

  const fetchBackups = async () => {
    if (user?.role !== 'admin' || !token) return;
    try {
      const response = await fetch(`${API_BASE_URL}/admin/backups`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setBackups(data);
      }
    } catch (err) {
      console.error("Failed to load backups:", err);
    }
  };

  const fetchPendingUsers = async () => {
    if (user?.role?.toLowerCase() !== 'admin' || !token) return;
    try {
      const response = await fetch(`${API_BASE_URL}/auth/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        const pending = data.filter((u: any) => u.role.toLowerCase() === 'pending');
        setPendingUsers(pending);
      }
    } catch (err) {
      console.error("Failed to load pending users:", err);
    }
  };

  const handleApproveUser = async (userId: number) => {
    const assignedRole = selectedRoles[userId] || 'annotator';
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/users/${userId}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: assignedRole })
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Approval failed.");
      }
      showNotification("User approved and role assigned successfully!");
      fetchPendingUsers();
    } catch (err: any) {
      showNotification(err.message || "Failed to approve user.", true);
    } finally {
      setLoading(false);
    }
  };

  const checkCurrentUserDetails = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const userData = await response.json();
        setMfaEnabled(userData.mfa_enabled);
        setGdprConsent(userData.gdpr_consent);
        dispatch(updateUser({
          mfa_enabled: userData.mfa_enabled,
          gdpr_consent: userData.gdpr_consent
        }));
      }
    } catch (err) {
      console.error("Failed to check user details:", err);
    }
  };

  useEffect(() => {
    checkCurrentUserDetails();
    fetchBackups();
    fetchPendingUsers();
  }, [token]);

  const showNotification = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setSuccessMsg(null);
    } else {
      setSuccessMsg(msg);
      setErrorMsg(null);
    }
    setTimeout(() => {
      setSuccessMsg(null);
      setErrorMsg(null);
    }, 5000);
  };

  // 1. MFA Handlers
  const handleMfaSetupInit = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/mfa/setup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error("Failed to initiate MFA setup.");
      const data = await response.json();
      setMfaSetupData(data);
      setShowMfaSetup(true);
      setShowMfaDisable(false);
    } catch (err: any) {
      showNotification(err.message || "Failed to setup MFA.", true);
    } finally {
      setLoading(false);
    }
  };

  const handleMfaEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaSetupData || !otpCode) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/mfa/enable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          secret: mfaSetupData.secret,
          code: otpCode
        })
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Verification failed.");
      }
      setMfaEnabled(true);
      dispatch(updateUser({ mfa_enabled: true }));
      setShowMfaSetup(false);
      setMfaSetupData(null);
      setOtpCode('');
      showNotification("MFA enabled successfully!");
    } catch (err: any) {
      showNotification(err.message || "Failed to enable MFA.", true);
    } finally {
      setLoading(false);
    }
  };

  const handleMfaDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/mfa/disable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          code: otpCode
        })
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Verification failed.");
      }
      setMfaEnabled(false);
      dispatch(updateUser({ mfa_enabled: false }));
      setShowMfaDisable(false);
      setOtpCode('');
      showNotification("MFA disabled successfully.");
    } catch (err: any) {
      showNotification(err.message || "Failed to disable MFA.", true);
    } finally {
      setLoading(false);
    }
  };

  // 2. GDPR Handlers
  const handleToggleGDPR = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.checked;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/user/gdpr-consent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: user?.username,
          consent: nextVal
        })
      });
      if (!response.ok) throw new Error("Failed to update GDPR consent.");
      setGdprConsent(nextVal);
      dispatch(updateUser({ gdpr_consent: nextVal }));
      showNotification(`GDPR consent ${nextVal ? 'granted' : 'withdrawn'} successfully.`);
    } catch (err: any) {
      showNotification(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleAccountErasure = async () => {
    const confirmMessage = "WARNING: Permanent Deletion!\n\nAre you absolutely sure you want to permanently erase your account?\nAll annotations and reviews you completed will be anonymized, and your profile will be completely destroyed under GDPR Right to be Forgotten. This action CANNOT be undone.";
    if (!window.confirm(confirmMessage)) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/user/erasure`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error("Erasure request failed.");
      alert("Your account has been successfully anonymized and erased. Logging out now.");
      dispatch(logout());
    } catch (err: any) {
      showNotification(err.message, true);
      setLoading(false);
    }
  };

  // 3. Backup Handlers
  const handleGenerateBackup = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/backups/export`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error("Failed to generate backup.");
      const data = await response.json();
      showNotification(`Backup generated: ${data.filename}`);
      fetchBackups();
    } catch (err: any) {
      showNotification(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreLocal = async (filename: string) => {
    if (!window.confirm(`Are you sure you want to restore the platform state to the backup "${filename}"?\nAll newer transactions will be overwritten.`)) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/backups/restore-local`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ filename })
      });
      if (!response.ok) throw new Error("Restore failed.");
      showNotification("Database successfully restored!");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      showNotification(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    
    if (!window.confirm(`Are you sure you want to upload and restore "${uploadFile.name}"?`)) return;

    setLoading(true);
    const formData = new FormData();
    formData.append("file", uploadFile);

    try {
      const response = await fetch(`${API_BASE_URL}/admin/backups/restore`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      if (!response.ok) throw new Error("Upload restore failed.");
      showNotification("Backup file uploaded and restored successfully!");
      setUploadFile(null);
      fetchBackups();
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      showNotification(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 pb-16">
      {/* Alert Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center gap-3 text-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center gap-3 text-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* LEFT COLUMN: Security & GDPR */}
        <div className="space-y-8">
          
          {/* Multi-Factor Authentication Card */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 relative overflow-hidden shadow-xl shadow-cyan-500/5">
            <div className="absolute -top-12 -left-12 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl" />
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-cyan-500/10 rounded-2xl text-cyan-400 border border-cyan-500/20">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Two-Factor Authentication (2FA)</h3>
                <p className="text-xs text-slate-400 mt-0.5">Secure your annotation profile with TOTP codes</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-950/45 border border-slate-850/80 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${mfaEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`} />
                  <span className="text-sm font-semibold text-slate-300">
                    MFA is <strong className={mfaEnabled ? 'text-emerald-400' : 'text-slate-400'}>{mfaEnabled ? 'ENABLED' : 'DISABLED'}</strong>
                  </span>
                </div>

                {!mfaEnabled && !showMfaSetup && (
                  <button
                    onClick={handleMfaSetupInit}
                    disabled={loading}
                    className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/20 transition-all duration-300"
                  >
                    Setup 2FA
                  </button>
                )}

                {mfaEnabled && !showMfaDisable && (
                  <button
                    onClick={() => { setShowMfaDisable(true); setShowMfaSetup(false); }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-red-400 border border-slate-700/80 rounded-xl text-xs font-semibold transition"
                  >
                    Disable 2FA
                  </button>
                )}
              </div>

              {/* MFA Setup Panel */}
              {showMfaSetup && mfaSetupData && (
                <div className="p-4 bg-slate-950/30 border border-slate-850 rounded-2xl space-y-4 animate-in fade-in duration-300">
                  <div className="flex flex-col items-center text-center p-3 bg-white rounded-xl mx-auto w-fit">
                    <img 
                      src={mfaSetupData.qr_code_url} 
                      alt="MFA QR Code" 
                      className="w-40 h-40"
                    />
                    <span className="text-[10px] text-slate-500 font-bold tracking-wide uppercase mt-1">Scan with Google Authenticator</span>
                  </div>
                  
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Manual Setup Key</span>
                    <code className="block p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl text-xs font-mono text-center text-cyan-400 select-all tracking-wider">
                      {mfaSetupData.secret}
                    </code>
                  </div>

                  <form onSubmit={handleMfaEnable} className="space-y-3 pt-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Enter 6-Digit Authenticator Code</label>
                      <input
                        type="text"
                        placeholder="000000"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        className="w-full text-center py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl text-white tracking-widest text-lg font-mono focus:outline-none focus:border-cyan-500/50"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={loading || otpCode.length !== 6}
                        className="flex-1 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-xs font-bold transition"
                      >
                        Verify & Enable
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowMfaSetup(false); setMfaSetupData(null); setOtpCode(''); }}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* MFA Disable Panel */}
              {showMfaDisable && (
                <form onSubmit={handleMfaDisable} className="p-4 bg-slate-950/30 border border-slate-850 rounded-2xl space-y-3 animate-in fade-in duration-300">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Enter Code to Confirm Disabling</label>
                    <input
                      type="text"
                      placeholder="000000"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-center py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl text-white tracking-widest text-lg font-mono focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={loading || otpCode.length !== 6}
                      className="flex-1 py-2 bg-red-500 hover:bg-red-400 text-white rounded-xl text-xs font-bold transition"
                    >
                      Confirm Disable
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowMfaDisable(false); setOtpCode(''); }}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* GDPR, Data Consent & Erasure Card */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 relative overflow-hidden shadow-xl shadow-cyan-500/5">
            <div className="absolute -bottom-12 -left-12 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl" />
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400 border border-indigo-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">GDPR & Privacy Center</h3>
                <p className="text-xs text-slate-400 mt-0.5">Control your platform data footprint and consent options</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* GDPR Toggle */}
              <div className="flex items-start justify-between p-4 bg-slate-950/45 border border-slate-850/80 rounded-2xl">
                <div className="flex-1 pr-4">
                  <h4 className="text-sm font-semibold text-slate-200">System Log Consent</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Consent to logging annotation metrics, platform audit records, and workspace details.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={gdprConsent}
                    onChange={handleToggleGDPR}
                    disabled={loading}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-350 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500 peer-checked:after:bg-slate-950 peer-checked:after:border-transparent"></div>
                </label>
              </div>

              {/* GDPR Account Erasure Card */}
              <div className="p-4 border border-red-500/25 bg-red-500/5 rounded-2xl space-y-4">
                <div className="flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-red-400 uppercase tracking-wide">Right to be Forgotten</h4>
                    <p className="text-xs text-red-300/80 mt-1 leading-relaxed">
                      Erase your personal data and account logs permanently. All annotations and completed QA sessions will be fully anonymized to preserve integrity.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleAccountErasure}
                  disabled={loading}
                  className="w-full py-2.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/35 hover:border-transparent rounded-xl text-xs font-bold transition duration-300"
                >
                  Request Profile Erasure
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Backup & Disaster Recovery (Admin Only) */}
        <div>
          {user?.role?.toLowerCase() === 'admin' ? (
            <div className="space-y-8">
              <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 relative overflow-hidden shadow-xl shadow-cyan-500/5 flex flex-col">
                <div className="absolute -top-12 -right-12 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl" />
                
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-cyan-500/10 rounded-2xl text-cyan-400 border border-cyan-500/20">
                      <Database className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white tracking-tight">System Backup & Recovery</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Manage snapshots of SQL and MongoDB data logs</p>
                    </div>
                  </div>
                  <button
                    onClick={fetchBackups}
                    disabled={loading}
                    className="p-2 text-slate-400 hover:text-cyan-400 rounded-xl hover:bg-slate-800/50 border border-transparent hover:border-slate-700/55 transition"
                    title="Refresh backups list"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {/* Action Panels */}
                <div className="space-y-4 mb-6">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Export Button */}
                    <button
                      onClick={handleGenerateBackup}
                      disabled={loading}
                      className="flex flex-col items-center justify-center p-4 bg-slate-950/45 hover:bg-slate-950 border border-slate-850 hover:border-cyan-500/35 rounded-2xl text-center transition group"
                    >
                      <Download className="w-6 h-6 text-cyan-400 group-hover:scale-110 transition duration-300 mb-2" />
                      <span className="text-xs font-bold text-white">Generate Snapshot</span>
                      <span className="text-[9px] text-slate-500 mt-0.5">Save DB state locally</span>
                    </button>

                    {/* Upload Backup */}
                    <label className="flex flex-col items-center justify-center p-4 bg-slate-950/45 hover:bg-slate-950 border border-slate-850 hover:border-cyan-500/35 rounded-2xl text-center cursor-pointer transition group">
                      <UploadCloud className="w-6 h-6 text-indigo-400 group-hover:scale-110 transition duration-300 mb-2" />
                      <span className="text-xs font-bold text-white">Upload Backup</span>
                      <span className="text-[9px] text-slate-500 mt-0.5">Restore from .zip file</span>
                      <input
                        type="file"
                        accept=".zip"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setUploadFile(file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {uploadFile && (
                    <form onSubmit={handleUploadBackup} className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl flex items-center justify-between animate-in fade-in duration-200">
                      <div className="flex items-center gap-2">
                        <FileArchive className="w-4 h-4 text-indigo-400" />
                        <span className="text-xs text-slate-300 font-medium truncate max-w-[180px]">{uploadFile.name}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="submit"
                          disabled={loading}
                          className="px-2.5 py-1 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg text-[10px] font-bold transition"
                        >
                          Restore
                        </button>
                        <button
                          type="button"
                          onClick={() => setUploadFile(null)}
                          className="px-2.5 py-1 bg-slate-850 hover:bg-slate-850/80 text-slate-400 rounded-lg text-[10px] font-semibold transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Local Backups List */}
                <div className="flex-1 flex flex-col min-h-[220px]">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-3">Snapshots on Server</span>
                  
                  {backups.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-2xl p-6 text-center">
                      <FileArchive className="w-8 h-8 text-slate-700 mb-2" />
                      <span className="text-xs text-slate-500">No backups found</span>
                      <span className="text-[10px] text-slate-600 mt-1">Click "Generate Snapshot" above to create one.</span>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto max-h-[260px] space-y-2 pr-1">
                      {backups.map((b) => (
                        <div key={b.filename} className="p-3 bg-slate-950/45 hover:bg-slate-950 border border-slate-850 rounded-xl flex items-center justify-between group transition">
                          <div className="flex items-center gap-3">
                            <FileArchive className="w-5 h-5 text-cyan-500/70" />
                            <div>
                              <span className="text-xs font-semibold text-slate-200 block truncate max-w-[180px]" title={b.filename}>
                                {b.filename}
                              </span>
                              <span className="text-[10px] text-slate-500 block mt-0.5">
                                {formatBytes(b.size_bytes)} • {new Date(b.created_at).toLocaleString()}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition">
                            <button
                              onClick={() => handleRestoreLocal(b.filename)}
                              disabled={loading}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-300 text-[10px] font-bold rounded-lg border border-slate-700/80 hover:border-transparent transition"
                            >
                              Restore
                            </button>
                            <a
                              href={`${API_BASE_URL}/admin/backups/download/${b.filename}?token=${token}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg border border-slate-700/80 transition"
                              title="Download backup file"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Pending Approvals Card */}
              <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 relative overflow-hidden shadow-xl shadow-cyan-500/5">
                <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl" />
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500 border border-amber-500/20">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white tracking-tight">Pending User Approvals</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Approve and assign roles to unrecognized SSO registrations</p>
                    </div>
                  </div>
                  <button
                    onClick={fetchPendingUsers}
                    disabled={loading}
                    className="p-2 text-slate-400 hover:text-amber-500 rounded-xl hover:bg-slate-800/50 border border-transparent hover:border-slate-700/55 transition"
                    title="Refresh approvals list"
                    type="button"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="space-y-3">
                  {pendingUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-2xl p-6 text-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-slate-700 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs text-slate-500 font-semibold">No pending approvals</span>
                      <span className="text-[10px] text-slate-655 text-slate-500 mt-1">Users signing up with unrecognized email domains will appear here.</span>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                      {pendingUsers.map((p) => (
                        <div key={p.id} className="p-3 bg-slate-950/45 border border-slate-850 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 group transition">
                          <div className="space-y-0.5">
                            <span className="text-xs font-semibold text-white block">@{p.username}</span>
                            <span className="text-[10px] text-slate-450 font-mono block">{p.email || 'No email associated'}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 shrink-0">
                            <select
                              value={selectedRoles[p.id] || 'annotator'}
                              onChange={(e) => setSelectedRoles({ ...selectedRoles, [p.id]: e.target.value })}
                              className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-[11px] text-white focus:outline-none focus:border-amber-500/50 cursor-pointer"
                            >
                              <option value="annotator">Annotator</option>
                              <option value="reviewer">Reviewer</option>
                              <option value="admin">Admin</option>
                            </select>
                            <button
                              onClick={() => handleApproveUser(p.id)}
                              disabled={loading}
                              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold rounded-lg transition cursor-pointer"
                            >
                              Approve
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/10 border border-dashed border-slate-800 rounded-3xl p-8 text-center flex flex-col items-center justify-center h-full">
              <Lock className="w-10 h-10 text-slate-700 mb-3" />
              <h4 className="text-sm font-semibold text-slate-400">Governance Controls Limited</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-[280px]">
                Backup and platform snapshots are restricted to administrators. Contact your operations manager for system-wide restores.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Settings;
