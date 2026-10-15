import { it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import LoginForm from './LoginForm';
import { setLanguage } from '../../i18n/index.js';
afterEach(cleanup);
it.each(['tr', 'en'])('does not expose demo accounts or passwords in %s', language => {
  setLanguage(language); const { container } = render(<LoginForm onLogin={() => {}} busy={false} error={null} />);
  expect(container.querySelector('.demo')).toBeNull();
  expect(container.textContent).not.toContain('Demo2026!');
  expect(container.textContent).not.toContain('musteri@yargici.demo');
  expect(screen.getByRole('button', { name: language === 'tr' ? 'Giriş yap' : 'Sign in' })).toBeTruthy();
});
