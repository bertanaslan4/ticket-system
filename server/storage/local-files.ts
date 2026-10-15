import {constants} from 'node:fs';
import {mkdir,copyFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';

export const localRoot=()=>resolve(process.env.ATTACHMENT_DIR||'storage');
export function localPath(key:string) {
 // Old UUID keys remain readable in their original directory.
 const root=key.includes('/')?localRoot():resolve(process.env.LEGACY_ATTACHMENT_DIR||process.env.ATTACHMENT_DIR||'data/attachments');
 if(key.includes('..')||key.includes('\\')||key.startsWith('/'))throw Error('Invalid attachment path');
 return resolve(root,key);
}
export function localName(name:string,now=new Date()) {
 const ext=extname(name).toLowerCase();
 const folder=['.xls','.xlsx'].includes(ext)?'excel':['.doc','.docx'].includes(ext)?'word':ext==='.pdf'?'pdf':['.mp4','.mov','.webm'].includes(ext)?'video':'resim';
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Istanbul',day:'2-digit',month:'2-digit',year:'numeric'}).formatToParts(now);
 const date=['day','month','year'].map(type=>parts.find(p=>p.type===type)!.value).join('');
 const stem=name.slice(0,-ext.length).normalize('NFC').replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g,'_').replace(/\.{2,}/g,'_').replace(/[. ]+$/g,'').slice(0,100)||'dosya';
 return {folder,stem:`${date}-${stem}`,ext};
}
export async function saveLocal(source:string,name:string,now=new Date()) {
 const {folder,stem,ext}=localName(name,now);
 await mkdir(resolve(localRoot(),folder),{recursive:true});
 for(let i=0;i<100000;i++) {
  const key=`${folder}/${stem}${i?'-'+i:''}${ext}`;
  try {await copyFile(source,localPath(key),constants.COPYFILE_EXCL);return key;}
  catch(error:any){if(error.code!=='EEXIST')throw error;}
 }
 throw Error('Attachment filename limit reached');
}
