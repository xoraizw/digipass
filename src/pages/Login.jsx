import { useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Field, Logo, Mark, Notice } from '../components/ui';

export default function Login() {
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get('mode') === 'signup' ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const next = location.state?.from || '/dashboard';

  if (user) return <Navigate to={next} replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { data, error } =
      mode === 'signup'
        ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/dashboard` } })
        : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setMsg({ tone: 'error', text: error.message });
    if (mode === 'signup' && !data.session) {
      return setMsg({ tone: 'info', text: 'Check your inbox to confirm your email, then sign in.' });
    }
    navigate(next, { replace: true });
  }

  return (
    <div className="auth">
      <div className="auth-panel">
        <Logo />
        <h1>{mode === 'signup' ? 'Bring your shop online' : 'Welcome back'}</h1>
        <p className="auth-sub">
          {mode === 'signup'
            ? 'Create the owner account for a coffee shop. You’ll design its card next.'
            : 'Sign in to your shop dashboard.'}
        </p>
        <form onSubmit={submit} className="stack">
          <Field label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </Field>
          <Field label="Password" hint={mode === 'signup' ? 'At least 6 characters' : null}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          </Field>
          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
          <button className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <button className="link-btn" onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}>
          {mode === 'signup' ? 'Already have an account? Sign in' : 'New shop? Create an account'}
        </button>
      </div>
      <div className="auth-art" aria-hidden="true">
        <div className="auth-mark">
          <Mark size={460} />
        </div>
        <p>“Every tenth coffee is on us.”</p>
        <span>Loyalty cards for Apple Wallet &amp; Google Wallet</span>
      </div>
    </div>
  );
}
