import { tr } from '../../i18n/index.js';

export default function SupportChainEditor({ chain, onChange, organizations }: {
  chain: number[]; onChange: (chain: number[]) => void;
  organizations: { id: number; name: string; kind: string }[];
}) {
  const companies = organizations.filter(o => o.kind !== 'customer');
  const move = (index: number, offset: number) => {
    const next = [...chain];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange(next);
  };
  return <fieldset className="support-chain-editor">
    <legend>{tr('support_chain')}</legend>
    <p className="hint">{tr('support_chain_hint')}</p>
    {chain.map((id, index) => <div className="support-chain-row" key={index}>
      <label>{tr('support_chain_level', { level: index + 1 })}
        <select required value={id || ''} onChange={e => onChange(chain.map((value, i) => i === index ? Number(e.target.value) : value))}>
          <option value="">{tr('select_support_company')}</option>
          {companies.filter(o => o.id === id || !chain.includes(o.id)).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </label>
      <div className="support-chain-controls">
        <button type="button" className="secondary" disabled={index === 0} aria-label={tr('support_chain_move_up', { level: index + 1 })} onClick={() => move(index, -1)}>↑</button>
        <button type="button" className="secondary" disabled={index === chain.length - 1} aria-label={tr('support_chain_move_down', { level: index + 1 })} onClick={() => move(index, 1)}>↓</button>
        <button type="button" className="secondary" disabled={chain.length === 1} aria-label={tr('support_chain_remove', { level: index + 1 })} onClick={() => onChange(chain.filter((_, i) => i !== index))}>{tr('remove_support_company')}</button>
      </div>
    </div>)}
    <button type="button" className="secondary" disabled={chain.length >= companies.length || chain.includes(0)} onClick={() => onChange([...chain, 0])}>{tr('add_support_company')}</button>
  </fieldset>;
}
