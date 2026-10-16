# Bekatos Destek Merkezi — Mobil Uygulama (React Native + Expo)

Bu klasör, Bekatos B2B SaaS Destek Yönetim Sistemi'nin Android ve iOS ortak kod tabanlı **React Native + Expo** mobil uygulamasını içerir.

## Kapsam (MVP)
- **Güvenli Mobil Oturum (`expo-secure-store`):** `POST /api/login` (`mobile: true`) üzerinden alınan oturum anahtarı cihazda şifreli saklanır ve `Authorization: Bearer <token>` başlığıyla gönderilir.
- **Destek İstemi Oluşturma & Kamera/Medya (`expo-image-picker`):** Müşteri kullanıcıları doğrudan kameradan fotoğraf/video çekerek veya galeriden dosya seçerek talep açabilir.
- **Bana Atananlar & Ekip Havuzu:** Bayi ve ana destek personeli kendi üzerindeki işleri ve ekip havuzundaki bekleyen talepleri tek ekrandan filtreleyebilir, SLA durumlarını görebilir.
- **Zaman Çizelgesi, Yorum, Atama ve Çözüm:** İsteme şirket içi/genel yorum yazma, kameradan kanıt fotoğrafı ekleme, farklı destek kademesine devretme ve çözümü onaylayarak kapatma.
- **Anlık Bildirimler (`expo-notifications`) & Deep Link (`bekatos://tickets/:id`):** Cihazın Expo Push Token'ı `/api/me/push-token` uç noktasına kaydedilir. Yeni atama, yorum ve çözüm bildirimlerine dokunulduğunda ilgili destek isteminin detay ekranı doğrudan açılır.

## Çalıştırma
```bash
cd mobile
npm install
npx expo start
```
