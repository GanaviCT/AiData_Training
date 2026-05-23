import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { setCredentials } from '../store/authSlice';
import { API_BASE_URL } from '../config';
import { BrainCircuit, Lock, User, AlertCircle, ArrowRight } from 'lucide-react';

const Login: React.FC = () => {
  const dispatch = useDispatch();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('annotator');
  const [gdprConsent, setGdprConsent] = useState(false);
  
  // MFA States
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [otpCode, setOtpCode] = useState('');
  
  // SSO States
  const [showSsoModal, setShowSsoModal] = useState(false);
  const [ssoProvider, setSsoProvider] = useState<'google' | 'github'>('google');
  const [ssoEmail, setSsoEmail] = useState('');
  const [ssoUsername, setSsoUsername] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    if (isRegister && !gdprConsent) {
      setError("You must consent to GDPR data terms to register.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        // Register Flow
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            username, 
            password, 
            role
          }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.detail || 'Registration failed.');
        }

        // Set GDPR consent status in database
        const userJson = await response.json();
        await fetch(`${API_BASE_URL}/user/gdpr-consent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username, consent: true })
        });

        setIsRegister(false);
        setError(null);
        alert("Registration successful! Please login.");
      } else {
        // Login Flow
        const response = await fetch(`${API_BASE_URL}/auth/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.detail || 'Login failed. Please check credentials.');
        }

        const data = await response.json();
        if (data.status === 'mfa_required') {
          setMfaRequired(true);
          setMfaToken(data.mfa_token);
        } else {
          dispatch(setCredentials({
            token: data.access_token,
            user: data.user
          }));
        }
      }
    } catch (err: any) {
      setError(err.message || 'Network error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode) return;

    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login/mfa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mfa_token: mfaToken, code: otpCode }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'MFA validation failed.');
      }

      const data = await response.json();
      dispatch(setCredentials({
        token: data.access_token,
        user: data.user
      }));
    } catch (err: any) {
      setError(err.message || 'MFA authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSsoClick = (provider: 'google' | 'github') => {
    setSsoProvider(provider);
    setSsoEmail(provider === 'google' ? 'sso.google@trainlyft.com' : 'sso.github@trainlyft.com');
    setSsoUsername(provider === 'google' ? 'sso_google_admin' : 'sso_github_annotator');
    setShowSsoModal(true);
  };

  const handleSsoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ssoEmail || !ssoUsername) return;
    setError(null);
    setLoading(true);
    setShowSsoModal(false);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/sso/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: ssoProvider,
          email: ssoEmail,
          username: ssoUsername,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'SSO Authentication failed.');
      }

      const data = await response.json();
      dispatch(setCredentials({
        token: data.access_token,
        user: data.user
      }));
    } catch (err: any) {
      setError(err.message || 'SSO Error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (user: string) => {
    setUsername(user);
    setPassword(`${user}123`);
  };

  return (
    <div className="min-h-screen bg-[#07080d] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background radial gradient wrapper (hidden in light mode) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-black z-0 dark-only-bg" />

      <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl shadow-indigo-500/5 relative z-10 overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl" />

        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 mb-4">
            <BrainCircuit className="w-8 h-8 text-white keep-white" />
          </div>
          <h2 className="font-display font-bold text-2xl text-white tracking-tight">
            {mfaRequired ? 'MFA Verification' : isRegister ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p className="text-slate-400 text-sm mt-1 text-center">
            {mfaRequired 
              ? 'Enter the 6-digit code from your Authenticator app' 
              : isRegister 
              ? 'Register a new data operation profile' 
              : 'Sign in to access your annotation workspace'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 mb-5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 text-red-400 text-xs relative z-10">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {mfaRequired ? (
          /* MFA Verification Form */
          <form onSubmit={handleMfaSubmit} className="space-y-5 relative z-10">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Verification Code</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full pl-11 pr-4 py-3 bg-slate-950/50 border border-slate-800/80 rounded-2xl text-white text-center text-lg tracking-widest placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all duration-300"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.length !== 6}
              className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white keep-white rounded-2xl text-sm font-semibold tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/20 active:scale-[0.98] transition-all duration-300 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify & Sign In'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => { setMfaRequired(false); setMfaToken(''); setOtpCode(''); }}
              className="w-full text-center text-xs font-semibold text-slate-450 hover:text-white transition duration-200"
            >
              Cancel & Go Back
            </button>
          </form>
        ) : (
          /* Normal Sign In / Register Form */
          <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Username</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full pl-11 pr-4 py-3 bg-slate-950/50 border border-slate-800/80 rounded-2xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all duration-300"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-11 pr-4 py-3 bg-slate-950/50 border border-slate-800/80 rounded-2xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all duration-300"
                />
              </div>
            </div>

            {isRegister && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-950/50 border border-slate-800/80 rounded-2xl text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-all duration-300 cursor-pointer"
                  >
                    <option value="annotator">Annotator (Data Worker)</option>
                    <option value="reviewer">QA Reviewer (Quality Expert)</option>
                    <option value="admin">Administrator (Manager)</option>
                  </select>
                </div>

                <div className="flex items-start gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="gdpr_checkbox"
                    checked={gdprConsent}
                    onChange={(e) => setGdprConsent(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-800 bg-slate-950/50 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
                  />
                  <label htmlFor="gdpr_checkbox" className="text-[11px] text-slate-400 leading-normal cursor-pointer select-none">
                    <strong>GDPR Consent:</strong> I agree that Trainlyft AI may collect and log my labeling metrics, IP address, and platform actions for performance reporting and quality audits.
                  </label>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white keep-white rounded-2xl text-sm font-semibold tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/20 active:scale-[0.98] transition-all duration-300 disabled:opacity-50"
            >
              {loading ? 'Processing...' : isRegister ? 'Register Account' : 'Sign In'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => { setIsRegister(!isRegister); setError(null); }}
              className="w-full text-center text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition duration-200"
            >
              {isRegister ? 'Already have an account? Sign In' : 'Need an account? Register Here'}
            </button>

            {!isRegister && (
              <>
                <div className="relative my-4 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-800"></div>
                  </div>
                  <span className="relative px-3 bg-white dark:bg-[#0c0d16] text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Or Federated SSO
                  </span>
                </div>
                
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => handleSsoClick('google')}
                    className="w-full py-2.5 px-4 bg-slate-950/30 hover:bg-slate-950/50 border border-slate-800/80 hover:border-slate-700 text-slate-350 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.68 1.54 14.98.96 12 .96c-4.47 0-8.31 2.56-10.14 6.29l3.85 2.99C6.62 7.02 9.07 5.04 12 5.04z" />
                      <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.33H12v4.42h6.45c-.28 1.47-1.11 2.72-2.36 3.56l3.66 2.84c2.14-1.97 3.38-4.87 3.38-8.49z" />
                      <path fill="#FBBC05" d="M5.71 14.76c-.23-.69-.36-1.43-.36-2.2s.13-1.51.36-2.2L1.86 7.37c-.78 1.56-1.22 3.31-1.22 5.19s.44 3.63 1.22 5.19l3.85-2.99z" />
                      <path fill="#34A853" d="M12 23.04c3.24 0 5.97-1.07 7.96-2.91l-3.66-2.84c-1.01.68-2.31 1.09-3.96 1.09-3.24 0-5.97-2.12-6.95-5.01L1.54 16.3c1.97 3.86 5.96 6.74 10.46 6.74z" />
                    </svg>
                    Sign in with Google
                  </button>
                </div>
              </>
            )}
          </form>
        )}

        {/* Demo Credentials Seeding Helper */}
        {!mfaRequired && !isRegister && (
          <div className="mt-8 pt-6 border-t border-slate-800/60 relative z-10">
            {(() => {
              const params = new URLSearchParams(window.location.search);
              const pageParam = params.get('page');
              let visibleRoles = ['admin', 'annotator', 'reviewer'];
              if (pageParam === 'annotation') {
                visibleRoles = ['annotator'];
              } else if (pageParam === 'qa') {
                visibleRoles = ['reviewer'];
              } else if (pageParam === 'tasks' || pageParam === 'dashboard') {
                visibleRoles = ['admin'];
              }
              
              return (
                <>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-3 text-center">
                    Quick-Login Demo Accounts
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {visibleRoles.map((role) => (
                      <button
                        key={role}
                        onClick={() => fillCredentials(role)}
                        className="py-2 px-1 text-center bg-slate-950/30 hover:bg-slate-950/50 text-[11px] font-medium text-slate-300 rounded-xl border border-slate-800/80 hover:border-slate-700 hover:text-white transition-all duration-200 capitalize cursor-pointer"
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Mock SSO Consent Dialog Overlay */}
      {showSsoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative z-25 overflow-hidden animate-scaleUp">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-slate-950/20 flex items-center justify-center border border-slate-800/80 mb-4">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.68 1.54 14.98.96 12 .96c-4.47 0-8.31 2.56-10.14 6.29l3.85 2.99C6.62 7.02 9.07 5.04 12 5.04z" />
                  <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.33H12v4.42h6.45c-.28 1.47-1.11 2.72-2.36 3.56l3.66 2.84c2.14-1.97 3.38-4.87 3.38-8.49z" />
                  <path fill="#FBBC05" d="M5.71 14.76c-.23-.69-.36-1.43-.36-2.2s.13-1.51.36-2.2L1.86 7.37c-.78 1.56-1.22 3.31-1.22 5.19s.44 3.63 1.22 5.19l3.85-2.99z" />
                  <path fill="#34A853" d="M12 23.04c3.24 0 5.97-1.07 7.96-2.91l-3.66-2.84c-1.01.68-2.31 1.09-3.96 1.09-3.24 0-5.97-2.12-6.95-5.01L1.54 16.3c1.97 3.86 5.96 6.74 10.46 6.74z" />
                </svg>
              </div>
              <h3 className="text-md font-bold text-white mb-1">
                Authorize Google SSO
              </h3>
              <p className="text-xs text-slate-400 mb-4 px-2">
                Allow Trainlyft AI to obtain your profile identity details from <strong>Google SSO</strong>:
              </p>
            </div>

            <form onSubmit={handleSsoSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">SSO Email Address</label>
                <input
                  type="email"
                  required
                  value={ssoEmail}
                  onChange={(e) => setSsoEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-3 py-2 bg-slate-950/50 border border-slate-800/80 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">SSO Username</label>
                <input
                  type="text"
                  required
                  value={ssoUsername}
                  onChange={(e) => setSsoUsername(e.target.value)}
                  placeholder="username"
                  className="w-full px-3 py-2 bg-slate-950/50 border border-slate-800/80 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/50 font-mono"
                />
              </div>

              <div className="text-[10px] text-slate-500 leading-relaxed border-t border-slate-850/60 pt-3 font-normal">
                💡 Logins with usernames containing <code>admin</code> will automatically provision an <strong>Administrator</strong> account; otherwise an <strong>Annotator</strong> profile is created.
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSsoModal(false)}
                  className="py-2 px-3 border border-slate-800/80 hover:bg-slate-950/30 rounded-xl text-xs font-semibold text-slate-350 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2 px-3 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white keep-white rounded-xl text-xs font-bold transition shadow shadow-cyan-500/10 cursor-pointer"
                >
                  Authorize & Sign In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
