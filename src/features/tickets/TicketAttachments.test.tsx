import { it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AttachmentList } from './TicketAttachments';
import { setLanguage } from '../../i18n/index.js';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const attachments = [
  { id: '1', name: 'photo.PNG', size: 123, url: '/api/tickets/1/attachments/1' },
  { id: '2', name: 'report.pdf', size: 123, url: '/api/tickets/1/attachments/2' },
];
it('opens images in a modal, preserves downloads, and cleans up on close', async () => {
  setLanguage('tr');
  const revoke = vi.fn();
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:preview', revokeObjectURL: revoke });
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['image']) });
  vi.stubGlobal('fetch', fetchMock);
  render(<AttachmentList attachments={attachments} />);
  expect(screen.getByRole('link', { name: /report.pdf/ }).hasAttribute('download')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: /photo.PNG/ }));
  expect(screen.getByRole('dialog')).toBeTruthy();
  const img = await screen.findByRole('img');
  expect(img.getAttribute('src')).toBe('blob:preview');
  expect(fetchMock).toHaveBeenCalledWith(attachments[0].url, expect.objectContaining({ credentials: 'same-origin' }));
  fireEvent.load(img);
  expect(screen.queryByRole('status')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Kapat' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(revoke).toHaveBeenCalledWith('blob:preview');
});
it('shows a failed preview without bypassing attachment access controls', async () => {
  setLanguage('tr');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
  render(<AttachmentList attachments={attachments} />);
  fireEvent.click(screen.getByRole('button', { name: /photo.PNG/ }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByRole('img')).toBeNull();
  expect(screen.getByRole('link', { name: 'Dosyayı indir' })).toBeTruthy();
});
