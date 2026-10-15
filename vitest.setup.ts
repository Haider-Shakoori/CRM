/**
 * Shared setup for the `dom` test project.
 *
 * Adds jest-dom matchers and stubs the two browser APIs that jsdom does not implement but
 * which the design system genuinely uses: `matchMedia` (theme resolution) and
 * `ResizeObserver` (Radix primitives and the mega-menu width measurement).
 *
 * The stubs are minimal and explicit rather than a catch-all `window` mock, so a component
 * that starts relying on an unimplemented API fails loudly instead of silently passing.
 */
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from 'vitest-axe/matchers';

expect.extend(matchers as unknown as Parameters<typeof expect.extend>[0]);

afterEach(() => {
  cleanup();
});

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, 'ResizeObserver', { writable: true, value: ResizeObserverStub });
}

// jsdom does not implement scrollIntoView, which Radix uses to keep the active item visible.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}
