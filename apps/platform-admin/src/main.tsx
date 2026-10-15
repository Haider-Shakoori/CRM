import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, Toaster } from '@crm/ui';
import { PlatformLanding } from './PlatformLanding';
import './styles.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('The application root element is missing from index.html.');
}

/**
 * Platform administration console entry point.
 *
 * The console itself is scheduled for its own batch. What ships here is the application
 * shell with an honest landing page, so the monorepo builds as a whole and the separation
 * between the three surfaces is real rather than a folder name.
 *
 * The theme provider reads the same preference key as the website and the CRM, so a person
 * who chose dark mode in one surface gets it in all three.
 */
createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider persist>
      <PlatformLanding />
      <Toaster />
    </ThemeProvider>
  </StrictMode>,
);
