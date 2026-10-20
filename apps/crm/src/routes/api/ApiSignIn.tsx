import * as React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError, createLaravelClient } from '../../app/laravelClient';

/**
 * Real Laravel session sign-in. Kept separate from mock-backed /app routes until
 * organization selection and the Leads service adapter are fully integrated.
 */
export default function ApiSignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const apiBase = import.meta.env.VITE_CRM_API_URL as string | undefined;
  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!apiBase || pending) return;
    setPending(true);
    setError('');
    try {
      const client = createLaravelClient({ baseUrl: apiBase });
      await client.login(email, password);
      navigate('/api-workspace', { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to reach the CRM API.');
    } finally {
      setPending(false);
    }
  };
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-default bg-surface p-8 shadow-lg">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">CRM API sign in</h1>
          <p className="text-sm text-muted">Sign in securely using your organization account. This is the new Laravel-backed workspace preview.</p>
        </header>
        {location.state?.passwordReset && <p role="status" className="rounded border p-3 text-sm">Password changed. Please sign in.</p>}
        {!apiBase ? (
          <p role="alert" className="rounded border p-3 text-sm">API access is not configured. Set VITE_CRM_API_URL to the Laravel server origin to enable sign-in.</p>
        ) : (
          <form className="space-y-4" onSubmit={(event) => { void signIn(event); }}>
            <label className="block space-y-1 text-sm">Email
              <input className="w-full rounded border border-default bg-surface p-2" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="block space-y-1 text-sm">Password
              <input className="w-full rounded border border-default bg-surface p-2" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <button className="w-full rounded bg-blue-700 p-3 font-medium text-white disabled:opacity-50" type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
          </form>
        )}
        <div className="flex flex-wrap justify-between gap-3 text-sm"><Link className="underline" to="/forgot-password">Forgot password?</Link><Link className="underline" to="/app/home">Demo CRM</Link></div>
      </div>
    </main>
  );
}
