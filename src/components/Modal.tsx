import {useEffect,useId,useRef,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
import {tr,useLanguage} from '../i18n/index.js';

export default function Modal({title,busy=false,onClose,children,eyebrow=tr("system_administration"),className=""}:{title:string;eyebrow?:string;className?:string;busy?:boolean;onClose:()=>void;children:ReactNode}) {
 useLanguage();const ref=useRef<HTMLDialogElement>(null),titleId=useId();
 useEffect(()=>{
  const dialog=ref.current!,previous=document.activeElement as HTMLElement;
  const overflow=document.body.style.overflow;
  dialog.showModal();document.body.style.overflow='hidden';
  dialog.querySelector<HTMLElement>('input:not([disabled]),select:not([disabled])')?.focus();
  return ()=>{dialog.close();document.body.style.overflow=overflow;previous?.focus();};
 },[]);
 return createPortal(<dialog ref={ref} className={`modal ${className}`} aria-labelledby={titleId} aria-modal="true" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
  <div className="modal-heading"><div><div className="eyebrow">{eyebrow}</div><h2 id={titleId}>{title}</h2></div><button type="button" className="modal-close" disabled={busy} aria-label={tr('close')} onClick={onClose}><X size={20}/></button></div>
  <div className="modal-body">{children}</div>
 </dialog>,document.body);
}

