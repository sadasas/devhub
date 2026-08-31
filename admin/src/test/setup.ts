import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { i18n, i18nInit } from '../i18n';

await i18nInit;

HTMLCanvasElement.prototype.getContext = () => null;

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

afterEach(() => {
  cleanup();
  if (i18n.resolvedLanguage !== 'en') void i18n.changeLanguage('en');
});
