import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { ThemeProvider, Toaster, TooltipProvider } from '@crm/ui';
import { ServiceProvider } from './app/ServiceProvider';
import { router } from './app/router';
import './styles.css';

/**
 * Application entry point.
 *
 * Provider order matters and is deliberate:
 *
 *   1. `ThemeProvider` is outermost because it writes the `data-*` attributes every token
 *      depends on. Until it has mounted, nothing downstream can be styled correctly.
 *   2. `ServiceProvider` next, so a service failure surfaces as a screen-level error rather
 *      than as a crash inside a themed component.
 *   3. `TooltipProvider` inside both, since tooltips inherit theme tokens and occasionally
 *      read service data for hints.
 *
 * A top-level error boundary catches a render failure that escapes a route, because a blank
 * white screen in an application is a worse outcome than an explicit apology with a reload
 * control.
 */

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('The application root element is missing from index.html.');
}

interface ErrorBoundaryState {
  error: Error | null;
}

class ApplicationErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // No monitoring service is connected, so the console is the only place this can go.
    // `console.error` is deliberate rather than `console.log`: it should be visible.
    console.error('[crm] unhandled render error', error, info.componentStack);
  }

  override render(): React.ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas p-6">
        <div className="w-full max-w-md space-y-4 rounded-xl border border-danger/30 bg-surface p-6">
          <div className="space-y-1">
            <h1 className="text-md font-semibold text-fg">Something went wrong</h1>
            <p className="text-sm text-muted">
              The interface failed to render. This is a defect in the frontend build, not a
              problem with your account or your data.
            </p>
          </div>
          <pre className="max-h-40 overflow-auto rounded-lg border border-border-subtle bg-inset p-3 font-mono text-2xs text-danger-fg">
            {this.state.error.message}
          </pre>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-9 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-contrast hover:bg-brand-hover"
            >
              Reload the application
            </button>
            <button
              type="button"
              onClick={() => {
                // Clearing the mock database is the most common way to recover from a bad
                // local state, and it is safe because nothing here is real.
                try {
                  for (const key of Object.keys(localStorage)) {
                    if (key.startsWith('crm.mockdb.') || key.startsWith('crm.comments.')) localStorage.removeItem(key);
                  }
                } catch {
                  /* storage unavailable */
                }
                window.location.assign('/app/home');
              }}
              className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-fg hover:bg-hover"
            >
              Reset demo data and reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ApplicationErrorBoundary>
      <ThemeProvider persist>
        <ServiceProvider persist>
          <TooltipProvider>
            <RouterProvider router={router} />
            <Toaster />
          </TooltipProvider>
        </ServiceProvider>
      </ThemeProvider>
    </ApplicationErrorBoundary>
  </React.StrictMode>,
);
