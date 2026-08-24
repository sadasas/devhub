import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { i18n, i18nInit } from '../i18n';

await i18nInit;

HTMLCanvasElement.prototype.getContext = () => null;

afterEach(() => {
  cleanup();
  if (i18n.resolvedLanguage !== 'en') void i18n.changeLanguage('en');
});
