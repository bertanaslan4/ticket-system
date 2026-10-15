import {it,expect,afterEach} from 'vitest';
import {render,screen,cleanup,fireEvent} from '@testing-library/react';
import Detail from './TicketDetail';
import NewTicket from './NewTicketForm';
import {setLanguage,tr} from '../../i18n/index.js';
afterEach(cleanup);
it('lets the current support company close or return a solution one level without granting customer replies',()=>{
 setLanguage('tr');
 const t={id:10,support_chain:[2,1,7],support_companies:[{id:2,name:'A'},{id:1,name:'B'},{id:7,name:'C'}],created_at:'2026-10-12T06:00:00Z',updated_at:'2026-10-12T06:00:00Z',title:'Chain',description:'Description',type:'Hata',status:'in_progress',owner_org_id:7,severity:'s2',events:[],orgs:[{id:1,name:'B'},{id:7,name:'C'}],targets:[]};
 const {rerender}=render(<Detail ticket={t} user={{id:8,role:'support',org_id:7}}/>);
 expect(screen.getByText('A → B → C')).toBeTruthy();
 expect(screen.getByRole('button',{name:tr('close')})).toBeTruthy();
 expect(screen.queryByLabelText(tr('visibility'))).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:tr('resolution')}));
 expect(screen.getByLabelText(tr('resolution_for_support_company',{company:'B'}))).toBeTruthy();
 expect(screen.getByRole('button',{name:tr('send_resolution_to_support_company',{company:'B'})})).toBeTruthy();
 rerender(<Detail ticket={{...t,owner_org_id:1}} user={{id:8,role:'support',org_id:7}}/>);
 expect(screen.queryByRole('button',{name:tr('close')})).toBeNull();
});
it('shows Takipsan customer replies and closure in the direct workflow',()=>{
 setLanguage('tr'); const t={id:9,support_flow:'contractor_only',created_at:'2026-10-12T06:00:00Z',updated_at:'2026-10-12T06:00:00Z',title:'Direct',description:'Description',type:'Hata',status:'open',owner_org_id:1,severity:'s2',events:[],orgs:[{id:1,name:'Takipsan'}],targets:[]};
 render(<Detail ticket={t} user={{role:'contractor',org_id:1}}/>);
 expect(screen.getByLabelText(tr('visibility'))).toBeTruthy();
 expect(screen.getByRole('button',{name:tr('close')})).toBeTruthy();
 expect(screen.queryByRole('button',{name:tr('resolution')})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:tr('assign')}));
 expect(screen.getByLabelText(tr('target_team')).querySelectorAll('option')).toHaveLength(1);
});
it('limits assisting dealer to internal comments and returning its solution to Takipsan',()=>{
 setLanguage('tr'); const t={id:10,support_flow:'contractor_first',created_at:'2026-10-12T06:00:00Z',updated_at:'2026-10-12T06:00:00Z',title:'Reverse',description:'Description',type:'Hata',status:'in_progress',owner_org_id:2,severity:'s2',events:[],orgs:[],targets:[]};
 render(<Detail ticket={t} user={{role:'dealer',org_id:2}}/>);
 expect(screen.queryByLabelText(tr('visibility'))).toBeNull();
 expect(screen.queryByRole('button',{name:tr('close')})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:tr('resolution')}));
 expect(screen.getByLabelText(tr('resolution_details_for_contractor'))).toBeTruthy();
 expect(screen.getByRole('button',{name:tr('send_resolution_to_contractor')})).toBeTruthy();
});
it('hides company and application inputs on creation',()=>{
 setLanguage('tr');render(<NewTicket user={{org_name:'Yargıcı',program:'ushops',used:0,daily_limit:10}}/>);
 expect(screen.queryByDisplayValue('Yargıcı')).toBeNull();expect(screen.queryByDisplayValue('ushops')).toBeNull();
 expect(screen.getByLabelText('Başlık')).toBeTruthy();
});
it('removes the action form after assigning to another company and restores it on return',()=>{
 setLanguage('tr');const ticket={id:1,created_at:'2026-10-09T06:00:00Z',updated_at:'2026-10-09T07:00:00Z',title:'Deneme',description:'Açıklama',type:'Hata',status:'open',owner_org_id:2,severity:'s2',events:[],orgs:[],targets:[]};
 const user={role:'dealer',org_id:2};
 const {rerender}=render(<Detail ticket={ticket} user={user}/>);
 expect(screen.getByLabelText('Yorumunuz')).toBeTruthy();
 rerender(<Detail ticket={{...ticket,owner_org_id:1}} user={user}/>);
 expect(screen.queryByLabelText('Yorumunuz')).toBeNull();expect(screen.queryByRole('button',{name:'Kaydet'})).toBeNull();
 rerender(<Detail ticket={ticket} user={user}/>);expect(screen.getByLabelText('Yorumunuz')).toBeTruthy();
});


it('shows the assignee and removes reassignment until the request returns to the queue',()=>{
 setLanguage('tr');
 const ticket={id:1,created_at:'2026-10-09T06:00:00Z',updated_at:'2026-10-09T07:00:00Z',title:'Deneme',description:'Aciklama',type:'Hata',status:'open',owner_org_id:2,severity:'s2',events:[],orgs:[],targets:[]};
 const user={id:2,role:'dealer',org_id:2};
 const {rerender}=render(<Detail ticket={ticket} user={user}/>);
 fireEvent.click(screen.getByRole('button',{name:tr('assign')}));
 rerender(<Detail ticket={{...ticket,assignee_id:3,assignee_name:'Zeynep'}} user={user}/>);
 expect(screen.getByText('Zeynep')).toBeTruthy();
 expect(screen.queryByRole('button',{name:tr('assign')})).toBeNull();
 expect(screen.queryByLabelText(tr('target_team'))).toBeNull();
 rerender(<Detail ticket={{...ticket,assignee_id:2}} user={user}/>);
 expect(screen.getByRole('button',{name:tr('assign')})).toBeTruthy();
 rerender(<Detail ticket={ticket} user={user}/>);
 expect(screen.getByRole('button',{name:tr('assign')})).toBeTruthy();
});
