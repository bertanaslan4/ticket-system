import {afterEach,it,expect} from 'vitest';
import {render,screen,cleanup,act} from '@testing-library/react';
import TicketTimeline from './TicketTimeline';
import {setLanguage} from '../../i18n/index.js';
afterEach(cleanup);
it('renders new structured events in both languages and preserves comments',()=>{
  setLanguage('tr');
  const keys=['event_ticket_created','event_severity_changed','event_assigned_to_person','event_returned_to_dealer','event_ticket_closed'];
  const events=keys.map((message_key,id)=>({id,kind:'system',message_key,message_params:{company:'Verimsoft',person:'Ayşe',from:'S2',to:'S3'},body:'Kayıtlı açıklama',created_at:'2026-10-08T11:49:00Z'}));
  events.push({...events[0],id:99,kind:'comment',body:'test edildi ve çözüldü'});
  const {container}=render(<TicketTimeline events={events}/>);
  expect(screen.getByText('Destek istemi oluşturuldu ve Verimsoft havuzuna iletildi.')).toBeTruthy();
  expect(screen.getByText('Öncelik seviyesi S2 → S3 olarak güncellendi.')).toBeTruthy();
  for(const key of keys)expect(container.textContent).not.toContain(key);
  act(()=>setLanguage('en'));
  expect(screen.getByText('Support request created and sent to the Verimsoft queue.')).toBeTruthy();
  expect(screen.getByText('test edildi ve çözüldü')).toBeTruthy();
  for(const key of keys)expect(container.textContent).not.toContain(key);
});
it('uses stored description when the client does not recognize an event key',()=>{
  render(<TicketTimeline events={[{id:1,kind:'system',message_key:'event_future_action',body:'Sunucuda kayıtlı açıklama',created_at:'2026-10-08T11:49:00Z'}]}/>);
  expect(screen.getByText('Sunucuda kayıtlı açıklama')).toBeTruthy();
  expect(screen.queryByText('event_future_action')).toBeNull();
});
