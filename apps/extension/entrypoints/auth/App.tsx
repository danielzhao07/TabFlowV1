import { useState, useRef } from 'react';
import {
  loginWithPassword,
  signUpUser,
  confirmUserSignUp,
  resendConfirmationCode,
  type TokenSet,
} from '@/lib/auth';

type View = 'signin' | 'signup' | 'confirm';

function formatError(msg: string): string {
  if (msg.includes('Incorrect username or password') || msg.includes('NotAuthorizedException'))
    return 'Incorrect email or password.';
  if (msg.includes('User does not exist') || msg.includes('UserNotFoundException'))
    return 'No account found with this email.';
  if (msg.includes('User already exists') || msg.includes('UsernameExistsException'))
    return 'An account with this email already exists. Try signing in.';
  if (msg.includes('Password does not conform') || msg.includes('InvalidPasswordException'))
    return 'Password must be at least 8 characters and include uppercase, lowercase, and a number.';
  if (msg.includes('CodeMismatchException') || msg.includes('Invalid verification code'))
    return 'Invalid verification code. Please try again.';
  if (msg.includes('ExpiredCodeException') || msg.includes('has expired'))
    return 'Code expired. Request a new one below.';
  if (msg.includes('UserNotConfirmedException') || msg.includes('not confirmed'))
    return '__NOT_CONFIRMED__';
  if (msg.includes('USER_PASSWORD_AUTH') || msg.includes('not enabled'))
    return 'Password sign-in is not enabled. Contact support or enable ALLOW_USER_PASSWORD_AUTH in your Cognito app client.';
  return msg;
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22" />
    </svg>
  );
}

function Spinner() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 16,
        height: 16,
        border: '2px solid rgba(255,255,255,0.25)',
        borderTopColor: 'white',
        borderRadius: '50%',
        animation: 'tf-spin 0.7s linear infinite',
      }}
    />
  );
}

export function App() {
  const [view, setView] = useState<View>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  const pendingEmail = useRef('');
  const pendingPassword = useRef('');

  const logoUrl = typeof chrome !== 'undefined'
    ? chrome.runtime.getURL('TabFlowV3.png')
    : '';

  const completeAuth = async (tokenSet: TokenSet) => {
    await chrome.runtime.sendMessage({ type: 'auth-complete', success: true, tokenSet });
    window.close();
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const tokenSet = await loginWithPassword(email.trim(), password);
      await completeAuth(tokenSet);
    } catch (err: any) {
      const fmt = formatError(err.message);
      if (fmt === '__NOT_CONFIRMED__') {
        pendingEmail.current = email.trim();
        pendingPassword.current = password;
        setError('Your account isn\'t verified yet. Enter the code sent to your email.');
        setView('confirm');
      } else {
        setError(fmt);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      await signUpUser(email.trim(), password);
      pendingEmail.current = email.trim();
      pendingPassword.current = password;
      setView('confirm');
    } catch (err: any) {
      setError(formatError(err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await confirmUserSignUp(pendingEmail.current, code.trim());
      const tokenSet = await loginWithPassword(pendingEmail.current, pendingPassword.current);
      await completeAuth(tokenSet);
    } catch (err: any) {
      setError(formatError(err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendMsg(null);
    setError(null);
    try {
      await resendConfirmationCode(pendingEmail.current);
      setResendMsg('A new code was sent.');
      setTimeout(() => setResendMsg(null), 4000);
    } catch (err: any) {
      setError(formatError(err.message));
    }
  };

  const switchView = (v: View) => {
    setError(null);
    setView(v);
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07070f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        @keyframes tf-spin { to { transform: rotate(360deg); } }
        @keyframes tf-glow-spin { to { transform: rotate(-360deg); } }
        @keyframes tf-fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .tf-glow-wrap { position: relative; border-radius: 17px; padding: 1.5px; overflow: hidden; }
        .tf-glow-spin {
          position: absolute; width: 200%; height: 200%; top: -50%; left: -50%;
          background: conic-gradient(rgba(99,179,237,0) 0deg, rgba(147,210,255,0.9) 50deg, rgba(99,179,237,0) 100deg, rgba(99,179,237,0) 360deg);
          animation: tf-glow-spin 5s linear infinite;
        }
        .tf-card {
          position: relative; border-radius: 16px; overflow: hidden;
          background: rgba(11,11,20,0.99);
          animation: tf-fade-in 300ms cubic-bezier(0.16,1,0.3,1) both;
        }
        .tf-input {
          width: 100%; padding: 10px 14px; border-radius: 10px; font-size: 14px; color: white; outline: none;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);
          transition: border-color 150ms;
        }
        .tf-input::placeholder { color: rgba(255,255,255,0.25); }
        .tf-input:focus { border-color: rgba(99,179,237,0.55); }
        .tf-input:-webkit-autofill,
        .tf-input:-webkit-autofill:hover,
        .tf-input:-webkit-autofill:focus {
          -webkit-text-fill-color: white;
          -webkit-box-shadow: 0 0 0px 1000px rgba(11,11,20,0.99) inset;
          transition: background-color 5000s ease-in-out 0s;
        }
        .tf-btn {
          width: 100%; padding: 11px; border-radius: 10px; font-size: 14px; font-weight: 600; color: white;
          border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
          background: linear-gradient(135deg, rgba(99,179,237,0.9) 0%, rgba(56,139,253,0.9) 100%);
          transition: opacity 150ms, transform 80ms;
        }
        .tf-btn:hover:not(:disabled) { opacity: 0.9; }
        .tf-btn:active:not(:disabled) { transform: scale(0.98); }
        .tf-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .tf-tab {
          flex: 1; padding: 7px; font-size: 13px; font-weight: 500; border: none; border-radius: 8px;
          cursor: pointer; background: transparent; transition: background 150ms, color 150ms;
          color: rgba(255,255,255,0.4);
        }
        .tf-tab.active { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.90); }
      `}</style>

      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          {/* Glowing card wrapper */}
          <div className="tf-glow-wrap">
            <div className="tf-glow-spin" />
            <div className="tf-card">
              {/* Logo section */}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '36px 32px 24px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
                {logoUrl && (
                  <img src={logoUrl} alt="TabFlow" style={{ width: 120, height: 120, objectFit: 'contain', marginBottom: 14, transform: 'scale(1.25)', transformOrigin: 'center' }} />
                )}
                <div style={{ fontSize: 20, fontWeight: 700, color: 'white', letterSpacing: '-0.3px' }}>TabFlow</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
                  {view === 'confirm' ? 'Check your email' : 'Your intelligent tab manager'}
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: '24px 32px 32px' }}>
                {view === 'confirm' ? (
                  /* ── Confirmation view ── */
                  <form onSubmit={handleConfirm} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ textAlign: 'center', marginBottom: 4 }}>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
                        We sent a 6-digit code to<br />
                        <span style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>
                          {pendingEmail.current}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>
                        Verification code
                      </label>
                      <input
                        className="tf-input"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="123456"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        style={{ textAlign: 'center', fontSize: 20, letterSpacing: '0.2em' }}
                        autoFocus
                        required
                      />
                    </div>

                    {error && (
                      <div style={{ fontSize: 12, color: 'rgba(248,113,113,0.9)', textAlign: 'center' }}>
                        {error}
                      </div>
                    )}
                    {resendMsg && (
                      <div style={{ fontSize: 12, color: 'rgba(99,179,237,0.8)', textAlign: 'center' }}>
                        {resendMsg}
                      </div>
                    )}

                    <button className="tf-btn" type="submit" disabled={loading || code.length < 6}>
                      {loading ? <Spinner /> : 'Verify email'}
                    </button>

                    <div style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={handleResend}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: 12, color: 'rgba(99,179,237,0.65)',
                        }}
                      >
                        Didn't receive it? Resend code
                      </button>
                    </div>
                  </form>
                ) : (
                  /* ── Sign in / Sign up view ── */
                  <>
                    {/* Tab switcher */}
                    <div style={{
                      display: 'flex', gap: 4, padding: 4, borderRadius: 10, marginBottom: 20,
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                    }}>
                      <button className={`tf-tab${view === 'signin' ? ' active' : ''}`} onClick={() => switchView('signin')}>
                        Sign in
                      </button>
                      <button className={`tf-tab${view === 'signup' ? ' active' : ''}`} onClick={() => switchView('signup')}>
                        Sign up
                      </button>
                    </div>

                    <form
                      onSubmit={view === 'signin' ? handleSignIn : handleSignUp}
                      style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
                    >
                      <div>
                        <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>
                          Email
                        </label>
                        <input
                          className="tf-input"
                          type="email"
                          autoComplete="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          autoFocus
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>
                          Password
                        </label>
                        <div style={{ position: 'relative' }}>
                          <input
                            className="tf-input"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete={view === 'signin' ? 'current-password' : 'new-password'}
                            placeholder={view === 'signin' ? '••••••••' : 'Min. 8 characters'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{ paddingRight: 40 }}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{
                              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'rgba(255,255,255,0.30)', padding: 4,
                            }}
                          >
                            <EyeIcon open={showPassword} />
                          </button>
                        </div>
                      </div>

                      {view === 'signup' && (
                        <div>
                          <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>
                            Confirm password
                          </label>
                          <input
                            className="tf-input"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                          />
                        </div>
                      )}

                      {error && (
                        <div style={{
                          fontSize: 12, color: 'rgba(248,113,113,0.9)', padding: '8px 12px',
                          background: 'rgba(248,113,113,0.08)', borderRadius: 8,
                          border: '1px solid rgba(248,113,113,0.18)',
                        }}>
                          {error}
                        </div>
                      )}

                      <button className="tf-btn" type="submit" disabled={loading} style={{ marginTop: 4 }}>
                        {loading ? <Spinner /> : view === 'signin' ? 'Sign in' : 'Create account'}
                      </button>
                    </form>

                    {view === 'signin' && (
                      <div style={{ textAlign: 'center', marginTop: 16 }}>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)' }}>
                          Don't have an account?{' '}
                        </span>
                        <button
                          onClick={() => switchView('signup')}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: 12, color: 'rgba(99,179,237,0.75)',
                          }}
                        >
                          Sign up free
                        </button>
                      </div>
                    )}
                    {view === 'signup' && (
                      <div style={{ textAlign: 'center', marginTop: 16 }}>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)' }}>
                          Already have an account?{' '}
                        </span>
                        <button
                          onClick={() => switchView('signin')}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: 12, color: 'rgba(99,179,237,0.75)',
                          }}
                        >
                          Sign in
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: 'rgba(255,255,255,0.18)' }}>
            Free · No credit card required
          </div>
        </div>
      </div>
    </>
  );
}
