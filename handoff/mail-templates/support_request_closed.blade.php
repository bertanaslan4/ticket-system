{{-- Laravel Blade örneği. View'e ['data' => $payload['data']] aktarılmalıdır. --}}
@php
    $candidateUrl = (string) ($data['ticket_url'] ?? '');
    $urlParts = parse_url($candidateUrl);
    $safeTicketUrl = filter_var($candidateUrl, FILTER_VALIDATE_URL)
        && is_array($urlParts)
        && in_array(strtolower($urlParts['scheme'] ?? ''), ['http', 'https'], true)
        && !isset($urlParts['user']) && !isset($urlParts['pass'])
        ? $candidateUrl : '';
@endphp
<!doctype html>
<html lang="tr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Destek isteminiz çözümlendi</title></head>
<body style="margin:0;padding:0;background:#f1f6fa;font-family:Arial,Helvetica,sans-serif;color:#173b50">
<div style="display:none;max-height:0;overflow:hidden">Destek isteminiz çözümlendi · {{ $data['ticket_number'] ?? '' }}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f6fa"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #dce7ef;border-radius:12px">
<tr><td style="padding:28px 32px;background:#00496b;color:#ffffff;border-radius:12px 12px 0 0"><div style="font-size:24px;font-weight:bold">TAKİPSAN</div><div style="font-size:14px;color:#82d3fb;margin-top:6px">Destek Merkezi</div></td></tr>
<tr><td style="padding:32px">
<div style="font-size:13px;font-weight:bold;letter-spacing:1px;color:#177db2">{{ $data['ticket_number'] ?? '' }} · {{ $data['date'] ?? '' }}</div>
<h1 style="margin:12px 0 24px;font-size:26px;line-height:1.3;color:#00496b">Destek isteminiz çözümlendi</h1>
<p style="font-size:16px;line-height:1.7">Sayın {{ $data['recipient_name'] ?? '' }},</p>
<p style="font-size:16px;line-height:1.7">Destek isteminiz bayi tarafından çözümlenerek kapatılmıştır. Bayinizin paylaştığı çözüm açıklamasını aşağıda bulabilirsiniz.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="12" style="background:#f1f7fb;border:1px solid #dce7ef;border-radius:8px;font-size:15px;line-height:1.6">
<tr><td style="color:#536c7a;width:90px">Konu</td><td style="font-weight:bold;overflow-wrap:anywhere">{{ $data['ticket_title'] ?? '' }}</td></tr>
<tr><td style="color:#536c7a">Firma</td><td>{{ $data['customer_name'] ?? '' }}</td></tr>
<tr><td style="color:#536c7a">Öncelik</td><td>{{ $data['severity'] ?? '' }}</td></tr>
</table>
<h2 style="font-size:18px;margin:28px 0 12px;color:#00496b">Çözüm açıklaması</h2>
<div style="border-left:4px solid #43a3db;padding:16px;background:#f1f7fb;font-size:16px;line-height:1.7;overflow-wrap:anywhere">{!! nl2br(e($data['resolution'] ?? '')) !!}</div>
@if($safeTicketUrl !== '')
<p style="margin:28px 0"><a href="{{ $safeTicketUrl }}" style="display:inline-block;padding:14px 22px;background:#147bb2;color:#ffffff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:bold">Destek istemini görüntüle</a></p>
@endif
<p style="margin:28px 0 0;font-size:14px;line-height:1.6;color:#647e8d">Takipsan Destek Merkezi</p>
</td></tr></table>
<p style="font-size:12px;color:#647e8d">Bu bildirim destek isteminizin işlem geçmişi doğrultusunda oluşturulmuştur.</p>
</td></tr></table>
</body></html>
