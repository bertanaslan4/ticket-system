import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { tr, useLanguage } from '../../i18n/index.js';
import Modal from '../../components/Modal';
import QueryState from '../../components/QueryState';
export default function ProductsPage() {
  useLanguage();
  const client=useQueryClient();
  const [editing,setEditing]=useState<{id?:number;name:string}|null>(null);
  const query=useQuery({queryKey:['admin','products'],queryFn:({signal})=>api<any[]>('/admin/products',undefined,signal)});
  const mutation=useMutation({mutationFn:(body:{name:string})=>api('/admin/products'+(editing?.id ? '/'+editing.id : ''),body),onSuccess:async()=>{
    setEditing(null);
    await client.invalidateQueries({queryKey:['admin']});
  }});
  return <>
    <div className="page-heading"><div><div className="eyebrow">{tr('system_administration')}</div><h1>{tr('products')}</h1><p>{tr('products_intro')}</p></div>
      <button className="primary" onClick={()=>{mutation.reset();setEditing({name:''});}}>{tr('add_product')}</button>
    </div>
    {editing && <Modal title={tr(editing.id ? 'edit_product' : 'add_product')} busy={mutation.isPending} onClose={()=>setEditing(null)}>
      <form className="admin-form" onSubmit={e=>{e.preventDefault();mutation.mutate({name:editing.name});}}>
        <label>{tr('product_name')}<input autoFocus required maxLength={180} value={editing.name} disabled={mutation.isPending} onChange={e=>setEditing({...editing,name:e.target.value})}/></label>
        <p className="hint">{tr('product_rename_hint')}</p>
        {mutation.error && <div className="error" role="alert">{tr(mutation.error)}</div>}
        <div className="form-bottom"><button type="button" className="secondary" disabled={mutation.isPending} onClick={()=>setEditing(null)}>{tr('cancel')}</button><button className="primary" disabled={mutation.isPending}>{tr(mutation.isPending?'saving':'save')}</button></div>
      </form>
    </Modal>}
    {query.isPending || query.isError ? <QueryState result={query}/> : <section className="panel"><div className="table-wrap"><table>
      <thead><tr><th>{tr('product_name')}</th><th>{tr('companies')}</th><th>{tr('total_tickets')}</th><th>{tr('take_action')}</th></tr></thead>
      <tbody>{query.data.map(p=><tr key={p.id}><td><strong>{p.name}</strong></td><td>{p.customer_count}</td><td>{p.ticket_count}</td><td><button className="secondary" aria-label={tr('edit',{name:p.name})} onClick={()=>{mutation.reset();setEditing(p);}}>{tr('edit_2')}</button>{' '}<Link to={'/admin/product-reports?product_id='+p.id}>{tr('product_reports')}</Link></td></tr>)}</tbody>
    </table></div>{!query.data.length && <div className="empty">{tr('no_products')}</div>}</section>}
  </>;
}
