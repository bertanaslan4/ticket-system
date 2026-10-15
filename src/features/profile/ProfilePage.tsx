import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { api } from '../../lib/api';
import { roles } from '../../lib/constants';
import { tr, useLanguage } from '../../i18n/index.js';

export default function ProfilePage() {
  useLanguage();
  const { user } = useAuth();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirmPassword, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState(false);
  if (!user) return null;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null); setSuccess(false);
    if (newPassword !== confirmPassword) { setError('password_confirmation_mismatch'); return; }
    setBusy(true);
    try {
      await api('/me/password', { currentPassword, newPassword, confirmPassword });
      setCurrent(''); setNew(''); setConfirm(''); setSuccess(true);
    } catch (e) { setError(e); }
    finally { setBusy(false); }
  }
  return <div className="profile-page">
    <div className="page-heading"><h1>{tr('my_profile')}</h1><p>{tr('profile_description')}</p></div>
    <div className="profile-grid">
      <section className="panel detail-section"><h2>{tr('profile_information')}</h2>
        <dl className="profile-facts">
          <div><dt>{tr('profile_full_name')}</dt><dd>{user.name}</dd></div>
          <div><dt>{tr('email_address')}</dt><dd>{user.email}</dd></div>
          <div><dt>{tr('profile_company')}</dt><dd>{user.org_name}</dd></div>
          <div><dt>{tr('profile_role')}</dt><dd>{tr(roles[user.role])}</dd></div>
        </dl>
      </section>
      <section className="panel detail-section"><h2>{tr('change_password')}</h2>
        <p>{tr('password_change_hint')}</p>
        <form onSubmit={submit} className="profile-password-form">
          <label>{tr('current_password')}<input type="password" autoComplete="current-password" required maxLength={200} value={currentPassword} onChange={e => { setCurrent(e.target.value); setSuccess(false); }} disabled={busy} /></label>
          <label>{tr('new_password')}<input type="password" autoComplete="new-password" required minLength={8} maxLength={200} value={newPassword} onChange={e => { setNew(e.target.value); setSuccess(false); }} disabled={busy} /></label>
          <label>{tr('confirm_new_password')}<input type="password" autoComplete="new-password" required minLength={8} maxLength={200} value={confirmPassword} onChange={e => { setConfirm(e.target.value); setSuccess(false); }} disabled={busy} /></label>
          {Boolean(error) && <div role="alert" className="error">{tr(error)}</div>}
          {success && <div role="status" className="profile-success">{tr('password_changed_success')}</div>}
          <button className="primary" disabled={busy}>{tr(busy ? 'password_saving' : 'change_password')}</button>
        </form>
      </section>
    </div>
  </div>;
}
