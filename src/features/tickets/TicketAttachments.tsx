import { useEffect, useState } from "react";
import { Paperclip, Download } from "lucide-react";
import { tr, useLanguage } from "../../i18n/index.js";
import type { Attachment } from "../../lib/types";
import Modal from "../../components/Modal";
export function formValues(form: HTMLFormElement): Record<string, any> {
  const data = new FormData(form);
  const files = data
    .getAll("files")
    .filter((f) => f instanceof File && f.size > 0);
  data.delete("files");
  return { ...Object.fromEntries(data), files };
}
export function AttachmentInput({ disabled = false }) {
  useLanguage();
  const [files, setFiles] = useState<File[]>([]);
  return (
    <label className="attachment-input">
      <span>
        <Paperclip size={15} /> {tr("attachments")}
      </span>
      <input
        name="files"
        type="file"
        multiple
        disabled={disabled}
        accept=".xls,.xlsx,.doc,.docx,.pdf,.png,.jpg,.jpeg,.gif,.webp,.mp4,.webm,.mov"
        onChange={(e) => {
          const selected = Array.from(e.target.files || []);
          const invalid =
            selected.length > 5 ||
            selected.some((f) => f.size > 25 * 1024 * 1024);
          e.target.setCustomValidity(invalid ? tr("attachment_limit") : "");
          setFiles(selected);
        }}
      />
      <small className="muted">{tr("attachment_hint")}</small>
      {files.map((f, i) => (
        <small key={i}>
          {f.name} ({(f.size / 1024 / 1024).toFixed(2)} MB)
        </small>
      ))}
    </label>
  );
}
export function AttachmentList({
  attachments = [],
}: {
  attachments?: Attachment[];
}) {
  useLanguage();
  const [selected, setSelected] = useState<Attachment | null>(null);
  if (!attachments.length) return null;
  return (
    <>
    <ul className="attachment-list" aria-label={tr("attachments")}>
      {attachments.map((a) => (
        <li key={a.id}>
          {imageType(a.name) ? <button type="button" className="attachment-preview-button" onClick={() => setSelected(a)}>
            <Paperclip size={15} /><span>{a.name}</span>
            <small>{(Number(a.size) / 1024 / 1024).toFixed(2)} MB</small>
          </button> : <a href={a.url} download>
            <Download size={15} />
            <span>{a.name}</span>
            <small>{(Number(a.size) / 1024 / 1024).toFixed(2)} MB</small>
          </a>}
        </li>
      ))}
    </ul>
    {selected && <ImagePreview key={selected.id} attachment={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function imageType(name: string) {
  return ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' } as Record<string, string>)[name.split('.').pop()?.toLowerCase() || ''];
}
function ImagePreview({ attachment, onClose }: { attachment: Attachment; onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = '';
    async function load() {
      try {
        const response = await fetch(attachment.url, { signal: controller.signal, credentials: 'same-origin' });
        if (!response.ok) throw new Error('preview_failed');
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(new Blob([blob], { type: imageType(attachment.name) }));
        setUrl(objectUrl);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    }
    void load();
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [attachment.url, attachment.name]);
  return <Modal title={attachment.name} eyebrow={tr('image_preview')} className="image-preview-modal" onClose={onClose}>
    <div className="image-preview-content">
      {failed ? <p role="alert">{tr('image_preview_failed')}</p> : <>
        {!loaded && <p role="status">{tr('loading')}</p>}
        {url && <img src={url} alt={attachment.name} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />}
      </>}
    </div>
    <div className="image-preview-footer"><a href={attachment.url} download><Download size={16} /> {tr('download_file')}</a></div>
  </Modal>;
}
