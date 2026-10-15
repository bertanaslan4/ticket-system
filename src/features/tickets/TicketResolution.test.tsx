import {it,expect,afterEach} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import TicketResolution from './TicketResolution';
import {setLanguage} from '../../i18n/index.js';
afterEach(cleanup);
it('shows the dealer closing resolution rather than an internal timeline note',()=>{
 setLanguage('tr');
 render(<TicketResolution ticket={{status:'closed',resolution:{body:'Test edildi ve çözüldü.',actor_name:'Ayşe',org_name:'Verimsoft',created_at:'2026-10-08T12:00:00Z'},events:[{body:'Gizli Takipsan çözümü',visibility:'internal'}]} as any}/>);
 expect(screen.getByRole('heading',{name:'Çözüldü · Çözüm açıklaması'})).toBeTruthy();
 expect(screen.getByText('Test edildi ve çözüldü.')).toBeTruthy();
 expect(screen.queryByText('Gizli Takipsan çözümü')).toBeNull();
});
it('does not label an unclosed ticket as resolved',()=>{
 const {container}=render(<TicketResolution ticket={{status:'review',resolution:null} as any}/>);
 expect(container.textContent).toBe('');
});
