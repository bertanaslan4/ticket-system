import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import ProfilePage from './ProfilePage';
import { api } from '../../lib/api';
import { setLanguage } from '../../i18n/index.js';
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ user: { name: 'Test User', email: 'test@example.com', org_name: 'Takipsan', role: 'contractor' } }) }));
vi.mock('../../lib/api', () => ({ api: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('shows account details, validates confirmation and clears passwords after saving', async () => {
  setLanguage('tr'); render(<ProfilePage />);
  expect(screen.getByText('test@example.com')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Mevcut şifre'), { target: { value: 'CurrentPassword!' } });
  fireEvent.change(screen.getByLabelText('Yeni şifre'), { target: { value: 'New2026!' } });
  fireEvent.change(screen.getByLabelText('Yeni şifre (tekrar)'), { target: { value: 'NotMatching2026!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Şifreyi değiştir' }));
  expect(screen.getByRole('alert').textContent).toContain('eşleşmiyor');
  expect(api).not.toHaveBeenCalled();
  vi.mocked(api).mockResolvedValue({ ok: true });
  fireEvent.change(screen.getByLabelText('Yeni şifre (tekrar)'), { target: { value: 'New2026!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Şifreyi değiştir' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Şifreniz değiştirildi'));
  expect(api).toHaveBeenCalledWith('/me/password', { currentPassword: 'CurrentPassword!', newPassword: 'New2026!', confirmPassword: 'New2026!' });
  expect((screen.getByLabelText('Mevcut şifre') as HTMLInputElement).value).toBe('');
  expect((screen.getByLabelText('Yeni şifre') as HTMLInputElement).value).toBe('');
});
it('renders the English profile and reports server validation errors', async () => {
  setLanguage('en'); render(<ProfilePage />);
  expect(screen.getByRole('heading', { name: 'My profile' })).toBeTruthy();
  for (const [label, value] of [['Current password','WrongPassword!'], ['New password','New2026!'], ['Confirm new password','New2026!']])
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  vi.mocked(api).mockRejectedValue(new Error('current_password_incorrect'));
  fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('current password is incorrect'));
});
