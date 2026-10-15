import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const root = 'handoff/mail-templates';
mkdirSync(root, { recursive: true });
for (const kind of ['assigned', 'closed']) {
  const heading = kind === 'closed' ? 'Destek isteminiz çözümlendi' : 'Yeni destek istemi ataması';
  let html = readFileSync(`server/mail/templates/support-request-${kind}.html`, 'utf8');
  html = html.replaceAll('{{heading}}', heading);
  html = html.replace('{{resolution}}', "{!! nl2br(e($data['resolution'] ?? '')) !!}");
  html = html.replace('{{action}}', `@if($safeTicketUrl !== '')
<p style="margin:28px 0"><a href="{{ $safeTicketUrl }}" style="display:inline-block;padding:14px 22px;background:#147bb2;color:#ffffff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:bold">Destek istemini görüntüle</a></p>
@endif`);
  html = html.replace(/{{([a-z_]+)}}/g, (_, field) => `{{ $data['${field}'] ?? '' }}`);
  html = `{{-- Laravel Blade örneği. View'e ['data' => $payload['data']] aktarılmalıdır. --}}
@php
    $candidateUrl = (string) ($data['ticket_url'] ?? '');
    $urlParts = parse_url($candidateUrl);
    $safeTicketUrl = filter_var($candidateUrl, FILTER_VALIDATE_URL)
        && is_array($urlParts)
        && in_array(strtolower($urlParts['scheme'] ?? ''), ['http', 'https'], true)
        && !isset($urlParts['user']) && !isset($urlParts['pass'])
        ? $candidateUrl : '';
@endphp
` + html;
  writeFileSync(`${root}/support_request_${kind}.blade.php`, html);
  const payload = {
    title: `${kind === 'closed' ? 'Destek isteminiz çözümlendi' : 'Destek istemi ataması'} · TK-0005`,
    template: `support_request_${kind}`, source: 'ushops', lang: 'tr',
    reply_to: 'destek@bekatos.com', to: ['recipient@example.com'],
    data: {
      notification_type: kind, recipient_name: kind === 'closed' ? 'Müşteri Kullanıcısı' : 'Ayşe Demir',
      ticket_id: 5, ticket_number: 'TK-0005', ticket_title: 'Sipariş ekranında kayıt güncelleme',
      customer_name: 'Yargıcı', severity: 's2',
      resolution: kind === 'closed' ? 'Güncelleme tamamlandı.\nBayi tarafından test edilerek sorunun çözüldüğü doğrulandı.' : '',
      ticket_url: '', date: '09.10.2026',
    },
  };
  writeFileSync(`${root}/support_request_${kind}.example.json`, JSON.stringify(payload, null, 2) + '\n');
}
