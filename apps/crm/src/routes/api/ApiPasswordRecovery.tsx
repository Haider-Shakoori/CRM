import * as React from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, createLaravelClient } from '../../app/laravelClient';

/** Backend-issued reset links use /reset-password?token=...&email=... . */
export default function ApiPasswordRecovery() {
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const isReset = location.pathname === '/reset-password';
  const apiBase = import.meta.env.VITE_CRM_API_URL as string | undefined;
  const [email, setEmail] = React.useState(() => params.get('email') ?? '');
  const [password, setPassword] = React.useState('');
  const [confirmation, setConfirmation] = React.useState('');
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const token = params.get('token') ?? '';
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!apiBase || pending) return;
    setPending(true); setError(''); setMessage('');
    try {
      const client = createLaravelClient({ baseUrl: apiBase });
      if (isReset) {
        if (!token) throw new Error('Missing password reset token.');
        if (password !== confirmation) throw new Error('The passwords do not match.');
        await client.resetPassword(email, token, password, confirmation);
        navigate('/api-sign-in', { replace: true, state: { passwordReset: true } });
      } else {
        await client.forgotPassword(email);
        setMessage('If an account exists for this address, recovery instructions will be sent.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not process the recovery request.');
    } finally { setPending(false); }
  };
  return <main className="flex min-h-screen items-center justify-center p-6">
    <section className="w-full max-w-md space-y-5 rounded-xl border p-8">
      <h1 className="text-2xl font-semibold">{isReset ? 'Choose a new password' : 'Recover your account'}</h1>
      {!apiBase ? <p role="alert">VITE_CRM_API_URL is not configured.</p>
        : isReset && !token ? <p role="alert">Your reset link is incomplete. Request a new one.</p>
          : <form className="space-y-4" onSubmit={(event) => { void submit(event); }}>
            <label className="block space-y-1">Email
              <input type="email" required autoComplete="email" className="block w-full rounded border p-2" value={email}
                onChange={(event) => setEmail(event.target.value)} />
            </label>
            {isReset && <>
              <label className="block space-y-1">New password (12+ characters, including letters and numbers)
                <input type="password" minLength={12} required autoComplete="new-password" className="block w-full rounded border p-2"
                  value={password} onChange={(event) => setPassword(event.target.value)} />
              </label>
              <label className="block space-y-1">Confirm new password
                <input type="password" minLength={12} required autoComplete="new-password" className="block w-full rounded border p-2"
                  value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
              </label>
            </>}
            {error && <p role="alert" className="text-red-600">{error}</p>}
            {message && <p role="status">{message}</p>}
            <button disabled={pending} className="w-full rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">
              {pending ? 'Submitting…' : isReset ? 'Reset password' : 'Send recovery instructions'}
            </button>
          </form>}
      <Link className="inline-block underline" to="/api-sign-in">Back to sign in</Link>
    </section>
  </main>;
}
