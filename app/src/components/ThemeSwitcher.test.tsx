import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { i18n, i18nInit } from '../i18n';
import type { ThemePref } from '../lib/theme';
import { ThemeSwitcher } from './ThemeSwitcher';

const { useThemeMock } = vi.hoisted(() => ({ useThemeMock: vi.fn() }));

vi.mock('../state/theme-context', () => ({
  useTheme: () => useThemeMock(),
}));

function renderSwitcher(pref: ThemePref = 'system') {
  const setTheme = vi.fn();
  useThemeMock.mockReturnValue({ pref, resolved: 'light', setTheme });
  render(<ThemeSwitcher />);
  return { setTheme };
}

describe('ThemeSwitcher', () => {
  beforeEach(async () => {
    await i18nInit;
    await i18n.changeLanguage('en');
  });

  afterEach(() => {
    void i18n.changeLanguage('en');
    vi.clearAllMocks();
  });

  it('renders trigger with localized aria-label', () => {
    renderSwitcher();
    expect(screen.getByRole('button', { name: 'Switch theme' })).toBeTruthy();
  });

  it('opens menu with all three prefs and marks the active one', () => {
    renderSwitcher('light');
    fireEvent.click(screen.getByRole('button', { name: 'Switch theme' }));
    expect(screen.getByRole('menu', { name: 'Theme' })).toBeTruthy();
    const system = screen.getByRole('menuitemradio', { name: 'System' });
    const light = screen.getByRole('menuitemradio', { name: 'Light' });
    const dark = screen.getByRole('menuitemradio', { name: 'Dark' });
    expect(system.getAttribute('aria-checked')).toBe('false');
    expect(light.getAttribute('aria-checked')).toBe('true');
    expect(dark.getAttribute('aria-checked')).toBe('false');
  });

  it('selecting Dark calls setTheme and closes the menu', () => {
    const { setTheme } = renderSwitcher('system');
    fireEvent.click(screen.getByRole('button', { name: 'Switch theme' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Dark' }));
    expect(setTheme).toHaveBeenCalledWith('dark');
    expect(screen.queryByRole('menu', { name: 'Theme' })).toBeNull();
  });
});
