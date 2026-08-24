import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { i18n, i18nInit, LANG_STORAGE_KEY } from '../i18n';
import { LanguageSwitcher } from './LanguageSwitcher';

describe('LanguageSwitcher', () => {
  beforeEach(async () => {
    await i18nInit;
    localStorage.removeItem(LANG_STORAGE_KEY);
    await i18n.changeLanguage('en');
  });

  afterEach(() => {
    void i18n.changeLanguage('en');
    localStorage.removeItem(LANG_STORAGE_KEY);
  });

  it('renders trigger with localized aria-label', () => {
    render(<LanguageSwitcher />);
    expect(screen.getByRole('button', { name: 'Change language' })).toBeTruthy();
  });

  it('opens menu with both languages and marks active one', () => {
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: 'Change language' }));
    const menu = screen.getByRole('menu', { name: 'Language' });
    expect(menu).toBeTruthy();
    const en = screen.getByRole('menuitemradio', { name: 'English' });
    const id = screen.getByRole('menuitemradio', { name: 'Bahasa Indonesia' });
    expect(en.getAttribute('aria-checked')).toBe('true');
    expect(id.getAttribute('aria-checked')).toBe('false');
  });

  it('switches to Indonesian, persists choice and updates html lang', async () => {
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: 'Change language' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Bahasa Indonesia' }));
    await Promise.resolve();
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe('id');
    expect(document.documentElement.lang).toBe('id');
  });

  it('shows localized trigger label after switching to id', async () => {
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: 'Change language' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Bahasa Indonesia' }));
    await Promise.resolve();
    expect(screen.getByRole('button', { name: 'Ganti bahasa' })).toBeTruthy();
  });
});
