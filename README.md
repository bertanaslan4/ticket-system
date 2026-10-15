# Bekatos Destek Merkezi

React 19 + NestJS 11 / TypeScript + PostgreSQL. Arayüz Türkçe ve İngilizce destekler. NestJS, HTTP katmanında Express adaptörünü kullanır; route ve yetkilendirme yönetimi NestJS'e aittir.

## Yerelde çalıştırma

Bu makinede bağımlılıklar ve üretim derlemesi hazır. `start-local.cmd` dosyasına çift tıklayın; http://localhost:3000 adresine gidin. Sunucu zaten çalışıyorsa ikinci kez açmayın. Terminalden: `node server/index.js`. Durdurmak için sunucu terminalinde Ctrl+C kullanın.

Yeni makinede Node.js 24 ve pnpm 11 kurup:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Geliştirme için `pnpm dev` çalıştırın. Backend kaynak değişikliklerinde TypeScript yeniden derlenir ve sunucu yeniden başlar; React için Vite aynı portta çalışır. Üretim görünümü için `pnpm build` ardından `pnpm start` çalıştırın. Yalnızca backend derlemek için `pnpm build:server` kullanılabilir. Backend çıktısı `build/`, React çıktısı `dist/` dizinine yazılır.

## React ön yüz yapısı

Ön yüz React + TypeScript olarak özelliklere ayrılmıştır. `src/main.tsx` uygulamayı açar; `src/app/App.tsx` dil, oturum ve TanStack Query sağlayıcılarını kurar. `src/app/router.tsx` React Router route'larını ve rol kontrollerini tanımlar. `src/layouts/AppLayout.tsx` ortak menü, üst çubuk ve alt bilgiyi içerir.

| Adres | Ekran |
| --- | --- |
| `/login` | Giriş; başarılı girişten sonra istenen adrese dönüş |
| `/dashboard` | Genel bakış |
| `/tickets` | Bilet listesi; `q` ve `status` URL parametreleri |
| `/tickets/new` | Müşteri için yeni bilet |
| `/tickets/:id` | Doğrudan açılabilen bilet detayı |
| `/admin/users` | Kullanıcı yönetimi |
| `/admin/organizations` | Şirket yönetimi |
| `/admin/reports` | Raporlar; filtreler URL parametrelerinde |
| `/admin/audit` | Yönetim geçmişi |

`features/auth`, `tickets`, `users`, `organizations`, `reports`, `audit` ekran ve veri işlemlerini içerir. Kullanıcı/şirket formları ortak `features/administration` bileşenlerini paylaşır. Zaman çizelgesi `TicketTimeline.tsx`, durum etiketi ve dil seçici `components/` altındadır. `lib/api.ts` HTTP istemcisi, `lib/types.ts` temel veri tipleri, `lib/queryClient.ts` önbellek ayarlarıdır. Stiller `styles/global.css`, dil entegrasyonu `i18n/index.js` içindedir.

TanStack Query aynı sorguları paylaşır; kayıt sonrası ilgili veriler yenilenir. Yönetim ekranları yalnızca ihtiyaç duydukları verileri çeker; üst menüdeki toplam için ortak bilet sorgusu kullanılır. Çıkışta özel veri önbelleği temizlenir. Yönetim ve detay ekranları ayrı kod parçaları olarak yüklenir. Ön yüz rol kontrolüne ek olarak asıl yetkilendirme NestJS'te uygulanır. Filtrelenen bilet listesi halen istemci tarafındadır; sunucu sayfalaması bu düzenlemenin kapsamında değildir.

`pnpm typecheck:frontend` tipleri, `pnpm test:frontend` route/form/oturum testlerini kontrol eder. `pnpm test` tip kontrolü, 28 backend testi ve 7 ön yüz testini çalıştırır. `pnpm build` tüm uygulamayı derler.

## NestJS backend yapısı

`server/main.ts` ortam ayarlarını yükler, veritabanını açar ve NestJS'i başlatır. `server/app.module.ts` modülleri birleştirir. `server/bootstrap.ts` HTTP adaptörünü, güvenlik başlıklarını, dil yanıtlarını, giriş hız limitini ve React sunumunu yapılandırır.

| Dizin | Sorumluluk |
| --- | --- |
| `server/auth/` | Giriş/çıkış, oturum bilgileri, global SessionGuard ve AdminGuard |
| `server/tickets/` | Bilet listeleme, detay, oluşturma, yorum ve atama işlemleri |
| `server/organizations/` | Süper admin şirket yönetimi |
| `server/users/` | Süper admin kullanıcı yönetimi |
| `server/reports/` | Bilet raporları |
| `server/audit/` | Yönetim işlem geçmişi |
| `server/database/` | Enjekte edilen DatabaseService ve bağlantı yaşam döngüsü |
| `server/common/` | Doğrulama yardımcıları ve ortak exception filter |

Her özellik kendi `*.module.ts`, `*.controller.ts` ve `*.service.ts` dosyalarını içerir. Controller HTTP verisini service'e iletir; service iş kurallarını ve transaction'ları uygular. Örnek: `GET /api/tickets` → `TicketsController.list` → `TicketsService.list` → `DatabaseService.query`. Tüm API adresleri ve mevcut oturum çerezleri korunmuştur. Public işaretli giriş ve sağlık adresleri dışındaki controller'larda SessionGuard devrededir; yönetim controller'ları ayrıca AdminGuard kullanır.

Bu geçiş bir ORM geçişi değildir: mevcut parametreli SQL sorguları, PostgreSQL/PGlite desteği ve `schema.sql` korunmuştur. NestJS bağımlılık enjeksiyonu ile tek DatabaseService paylaşılır; uygulama kapanırken bağlantı havuzu kapatılır. İleride TypeORM/Sequelize eklenirse bu ayrıca planlanmalıdır. `server/app.js` testler için uyumluluk girişidir; `server/index.js` derlenmiş NestJS uygulamasını başlatır.

## Demo hesapları

Tüm demo hesaplarının şifresi: `Demo2026!`. Giriş ekranındaki rol butonları bilgileri doldurur.

| Rol                     | E-posta               | Kurum              |
| ----------------------- | --------------------- | ------------------ |
| Müşteri                 | musteri@yargici.demo  | Yargıcı            |
| Bayi                    | bayi@verimsoft.demo   | Verimsoft / Ayşe   |
| Bayi personeli          | mehmet@verimsoft.demo | Verimsoft / Mehmet |
| Ana üstlenici           | bertan@bekatos.demo   | Bekatos / Bertan   |
| Ana üstlenici personeli | selin@bekatos.demo    | Bekatos / Selin    |

İzolasyon denemeleri için `diger@musteri.demo` ve `diger@bayi.demo` hesapları da bulunur. Demo verisi yalnızca boş veritabanına eklenir, her açılışta sıfırlanmaz.

## Süper admin

İlk yönetici hesabı: `admin@bekatos.local`. Bu hesabın şifresi demo şifresinden farklıdır; kurulum sırasında ayrıca verilir. Süper admin rolü `users.system_role='super_admin'` alanında tutulur, şirket türünden bağımsızdır. Normal hesaplar `member` olarak kalır.

- **Şirketler:** müşteri, bayi ve ana üstlenici ekleme; şirket adını, müşteri programını, sorumlu bayiyi ve günlük limiti düzenleme. Şirket türü değiştirilemez. Bayi/program değişiklikleri yeni biletlere uygulanır; mevcut bilet ilişkileri korunur.
- **Kullanıcılar:** hesap oluşturma, ad/e-posta ve sistem yetkisi düzenleme, şifre yenileme, hesabı pasifleştirme/aktifleştirme. Yeni şifre en az 12 karakter olmalıdır. Şifre veya yetki değişikliği oturumları iptal eder. Kullanıcı şirketi geçmiş kayıtlarını korumak için değiştirilemez. Kendi yönetici yetkisini kaldırma veya hesabını pasifleştirme engellenir.
- **Biletler:** bütün şirketlerin bilet ve şirket içi geçmişini görme, şirket içi yönetici notu ekleme. Bayi üzerinden kapatma ve Bekatos çözüm iadesi iş akışı korunur; admin bu akışı atlayarak bilet kapatmaz.
- **Raporlar:** İstanbul saat diliminde oluşturulma tarih aralığı; müşteri, bayi, durum, ciddiyet ve bilet tipi filtreleri. Toplam/açık/kapalı sayıları, durum/ciddiyet/bayi dağılımları, kapanış olayından hesaplanan ortalama çözüm süresi ve CSV indirme. Çözüm süresi takvim saatidir, çalışma saati/SLA değildir.
- **Yönetim geçmişi:** son 100 kullanıcı ve şirket değişikliği, işlemi yapan yönetici ve zamanı. Şifreler denetim kaydına yazılmaz. Geçmiş ilişkileri korumak için kullanıcı silmek yerine pasifleştirme kullanılır.

Yeni bir ortamda ilk yöneticiyi oluşturmak için `NEW_ADMIN_PASSWORD` ortam değişkenini belirleyip `node scripts/bootstrap-admin.js` çalıştırın. Varsayılan adresi değiştirmek için `NEW_ADMIN_EMAIL` verilebilir. Aktif süper admin varsa bu betik ikinci kez hesap oluşturmaz; sonraki yönetici hesapları kullanıcı ekranından eklenir.

Şema ek alanları mevcut verileri silmeden ekler. Kurulum öncesi PostgreSQL yedeği: `backups/pre-admin-1791442269822.dump`. Testler: `pnpm test`. PostgreSQL doğrulaması izole `ticket_test_<rakamlar>` veritabanlarında yapılır; her test dosyası ayrı veritabanıyla çalıştırılmalıdır.

## Bilet iş akışı

- Müşteri adı, program ve bayi ilişkisi sunucudan alınır; istemci bu alanları değiştiremez.
- Müşteri başına günlük limit varsayılan 10'dur. İstanbul takvim gününe göre sayılır. Kurum satırı transaction içinde kilitlenerek eşzamanlı taleplerde de korunur. Kapatılan biletler de o günün limitine dahildir.
- Müşteri kendi kurumunun; bayi kendi müşterilerinin biletlerini görür. Bekatos yalnızca kendisine iletilmiş biletleri görür.
- Personel işlemlerini biletin o an bulunduğu kurum yapar. O kurumdaki yetkililer havuzdan veya başka ekip arkadaşından atama yapabilir. Atama yalnızca ilgili bayi ve Bekatos arasında mümkündür.
- Bayi ciddiyeti değiştirir, kendi içinde atar veya Bekatos'a iletir. Bekatos kendi personeline veya ilgili bayiye geri atar.
- Şirket içi yorumları sadece ilgili bayi ve erişimi olan Bekatos görebilir; müşteri API çıktısından çıkarılır. Atama ve ciddiyet olayları müşteriye görünür. Personel adları zaman çizelgesinde görünür.
- Bekatos müşteriye açık yorum yazamaz ve bilet kapatamaz. Çözümü şirket içi açıklamayla bayiye iade eder. Bayi test onayı ve müşteriye açık açıklamayla kapatır. Bayi erken çözüm de yapabilir.
- Kapatılan bilete işlem veya yorum eklenemez. Yeniden açma bu kapsamda yoktur.
- Oturumlar 8 saatlik HttpOnly, SameSite=Strict çerez kullanır. Parolalar salt+scrypt ile saklanır; oturum token'ları veritabanında hash olarak tutulur. Giriş denemeleri sınırlandırılır, origin kontrolü yapılır.

## Veritabanı tercihi

**8 Ekim 2026 itibarıyla bu makine PostgreSQL 18 kullanıyor.** Bağlantı `127.0.0.1:5432`, veritabanı `tickets`, uygulama kullanıcısı `ticket_app`. Bağlantı parolası Git dışında tutulan `.env` dosyasındadır. Uygulama PostgreSQL yönetici hesabını kullanmaz.

PGlite'taki 5 kurum, 7 kullanıcı, 4 bilet ve 8 geçmiş kaydı taşındı; içerikler birebir karşılaştırılarak doğrulandı. Önceki `data/` dizini korunur; taşıma öncesi yedek ve doğrulama raporu `backups/pre-postgres-2026-10-08T06-29-06.472Z/` içindedir. Eski oturumlar taşınmadığı için yeniden giriş gerekir. Bundan sonraki kayıtlar PostgreSQL'dedir; `data/` güncel yedek değildir.

pgAdmin'de mevcut sunucuya sağ tıklayıp **Refresh** seçin. **Databases → tickets → Schemas → public → Tables** altında tablolar görünür. Tabloya sağ tıklayıp **View/Edit Data → All Rows** ile kayıtları görüntüleyebilirsiniz.

`DATABASE_URL` olmayan yeni kurulumlarda diskte kalıcı **PGlite** kullanılır. Bu modda veriler `data/` klasöründedir; aynı dizini kullanan birden fazla sunucu çalıştırmayın.

`DATABASE_URL` tanımlandığında uygulama normal PostgreSQL'e geçer. Şema `server/schema.sql` içinde bulunur. Şema ilk açılışta oluşturulur. Sonraki şema değişiklikleri için sürümlü migration eklenmelidir.

Kaynaklar: [PostgreSQL satır kilitleme](https://www.postgresql.org/docs/17/explicit-locking.html), [PGlite](https://github.com/electric-sql/pglite).

## Linux ve PostgreSQL

`compose.yaml` PostgreSQL 17 ve uygulamayı içerir. `.env.example` dosyasını `.env` olarak kopyalayın. Compose için güçlü ve URL açısından güvenli `POSTGRES_PASSWORD` ve gerçek HTTPS adresinizi `APP_ORIGIN` olarak tanımlayın. `SEED_DEMO=false` kullanın.

```sh
docker compose up -d --build
```

Uygulama 127.0.0.1:3000 üzerinden yayın yapar; önüne HTTPS sağlayan Nginx/Caddy koyun. Üretimde Secure çerez etkin olduğu için kullanıcı girişi HTTPS üzerinden yapılmalıdır. PostgreSQL dış dünyaya port açmaz. Otomatik demo hesapları üretimde oluşturulmaz.

Yeni boş üretim veritabanına önce kurumları oluşturun: bir `contractor`, gerekli `dealer` kayıtları, `dealer_id` ve `program` tanımlı `customer` kayıtları. Örnek:

```sql
INSERT INTO organizations(name,kind) VALUES ('Bekatos','contractor');
INSERT INTO organizations(name,kind) VALUES ('Verimsoft','dealer');
-- Aşağıdaki bayi kimliğini gerçek kayda göre düzenleyin.
INSERT INTO organizations(name,kind,dealer_id,program,daily_limit)
VALUES ('Yargıcı','customer',2,'ushops',10);
```

Standart kullanıcıyı komut satırından eklemek için `NEW_USER_PASSWORD` ortam değişkenine en az 12 karakterlik parola verin, ardından `node scripts/create-user.js 3 "Ad Soyad" kullanici@firma.com` çalıştırın. Docker içinde aynı script `docker compose exec -e NEW_USER_PASSWORD app node scripts/create-user.js ...` ile çalıştırılabilir. Standart kullanıcının rolü kurum türünden gelir. Kullanıcı ve şifre yönetimi süper admin ekranında da yapılabilir. E-posta bildirimi, kullanıcı tarafından e-posta ile şifre sıfırlama ve dosya eki bu sürümün kapsamında değildir.

## Yerel veriyi PostgreSQL'e taşıma

1. Yerel uygulamayı durdurun. Aynı `data/` dizinini ikinci işlemle açmayın.
2. `node scripts/export-db.js` çalıştırın. `backups/export-....sql` oluşturulur. Dosya kullanıcı parolalarının hash'lerini ve şirket içi yazışmaları da içerir; güvenli saklayın. Aktif oturumlar dışa aktarılmaz.
3. **Boş** hedef PostgreSQL veritabanına sırasıyla `server/schema.sql` ve export dosyasını `psql -v ON_ERROR_STOP=1 -d "$DATABASE_URL" -f DOSYA` ile yükleyin.
4. `DATABASE_URL` ayarlayarak uygulamayı başlatın. Kayıtları ve akışı doğrulayın. Demo hesaplarını canlı kullanımdan önce kaldırın veya parolalarını değiştirin.

PGlite yedeği için uygulama kapalıyken `data/` klasörünün tamamını kopyalayabilirsiniz. Üretimde düzenli `pg_dump` yedeği ve geri yükleme denemesi planlayın.

## Dil desteği

Giriş ekranında ve uygulamanın üst çubuğunda Türkçe / English seçilebilir. Tercih tarayıcıda saklanır; dil değişimi sayfayı yenilemez ve açık formdaki bilgileri korur. İlk kullanımda tarayıcı dili seçilir, desteklenmeyen diller Türkçeye döner. Yönetim, raporlar, CSV başlıkları, hata mesajları ve sistem zaman çizelgesi olayları çevrilir. Bilet başlıkları, açıklamalar, yorumlar, kişi ve şirket adları özgün halleriyle kalır. Tarih/sayı biçimleri dile göre değişir; iş günü ve saat dilimi Europe/Istanbul olarak korunur.

Sabit çeviri anahtarlarının Türkçe karşılıkları `shared/tr.js`, İngilizce karşılıkları `shared/en.js` içindedir. Örneğin her iki dosyada da `ticket_report` anahtarı bulunur: Türkçe değeri `Bilet raporları`, İngilizce değeri `Ticket reports`. Ekranda `tr("ticket_report")` kullanılır. Metin değiştiğinde anahtar değiştirilmez. `{count}` gibi dinamik değerler ikinci argümanla verilir. Dil kaydı ve çeviri yardımcıları `shared/i18n.js`, React entegrasyonu `src/i18n/index.js` içindedir. Yeni dil için aynı anahtarları içeren sözlüğü ekleyip `languages` ve `catalogs` kayıtlarına tanımlayın. API `Accept-Language` başlığını okur; hatalarda çevrilmiş `error` yanında sabit `errorKey` ve `errorParams` döner. Yeni olaylar sabit `message_key` / `message_params` alanlarını saklar. Önceden Türkçe anahtarlarla kaydedilmiş olaylar yalnızca geriye dönük uyumluluk için `shared/legacy-event-keys.js` üzerinden okunur.

## Doğrulama

`npm test` tüm iş akışı, yönetim ve dil testlerini çalıştırır.

`pnpm test` ön yüz tip kontrolünü, 7 ön yüz testini ve aşağıdaki alanlarda 28 backend testini çalıştırır: oturum, kurum izolasyonu, yorum gizliliği, atama, kapatma, günlük limit, admin yönetimi, dil desteği ve NestJS HTTP davranışları. `pnpm build` hem backend hem arayüzü derler. NestJS geçişinde 24 iş akışı/yönetim/dil testi ayrıca ayrı PostgreSQL 18 veritabanlarında geçti; yerel API ve React sayfası doğrulandı. Docker tanımı güncellendi, bu ortamda Docker çalıştırması doğrulanmadı.

8 Ekim 2026'da aynı 10 test, ayrı ve geçici bir PostgreSQL 18 veritabanında da başarılı oldu. PostgreSQL testleri için `TEST_DATABASE_URL` yalnızca `ticket_test_<rakamlar>` isimli ayrı bir veritabanını gösterebilir; gerçek `tickets` veritabanı test hedefi olarak reddedilir. Linux Docker çalıştırması bu Windows ortamında Docker servisi bulunmadığı için doğrulanmamıştır.

## Dosya ekleri ve Cloudflare R2

Bilet oluşturma, yorum, Bekatos çözümü ve bayi kapanışı en fazla 5 dosya kabul eder; her dosya en fazla 25 MiB olabilir. Desteklenen uzantılar: pdf, doc/docx, xls/xlsx, png/jpg/jpeg/gif/webp, mp4/webm/mov. Sunucu uzantı ve dosya imzasını kontrol eder; bu kontrol antivirüs taraması değildir. Ekler bağlı oldukları kaydın erişim kurallarını paylaşır. İndirme oturum doğrulamalı API üzerinden yapılır; bucket veya dosya yolu API yanıtında paylaşılmaz.

Varsayılan geliştirme depolaması `storage` dizinidir. PostgreSQL yalnızca dosya metadata ve ilişkilerini tutar. Linux taşınmasında yerel ekler kullanıldıysa bu dizini de veritabanıyla birlikte taşıyın. R2 etkinleşince yeni dosyalar R2'ye gider; önceki yerel dosyalar otomatik taşınmaz ve bu dizin korunmalıdır.

R2 bağlantısı:
1. Cloudflare hesabında R2 Object Storage aboneliğini etkinleştirin. Ücretsiz kota üstü kullanım ücretlidir; hesap açma, ödeme bilgileri ve koşul onayını hesap sahibi tamamlar.
2. Özel bir bucket oluşturun; public access/r2.dev erişimini açmayın. Sunucu üzerinden aktarım yapıldığı için CORS ayarı gerekmez.
3. Yalnızca bu bucket için Object Read & Write izinli R2 API anahtarı oluşturun.
4. Yerel `.env` dosyasına `ATTACHMENT_STORAGE=r2`, `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` değerlerini yazın. Gizli anahtarı sohbet, kaynak kodu veya frontend VITE değişkenlerine koymayın.
5. Sunucuyu yeniden başlatın. Bir deneme ekini yükleyip indirin ve bucket üzerinden oluştuğunu doğrulayın. Eksik R2 ayarı sunucunun başlamasını engeller; sessizce yerel depolamaya dönülmez.

Limitler toplam hesap kotasının aşılmasını engellemez. Cloudflare kullanımını takip edin. Resmi fiyatlandırma: https://developers.cloudflare.com/r2/pricing/

Dosyalar geçici diske akışla alınır ve gönderim sonunda temizlenir. İşlem başarısız olursa yüklenmiş nesneler silinir. Sunucunun aniden kapanması nadiren sahipsiz nesne bırakabilir; üretimde veritabanıyla karşılaştırmalı düzenli temizlik/yedekleme planlanmalıdır. Yükleme sırasında en fazla yaklaşık 125 MiB geçici disk alanı gerekir (eşzamanlı istek başına). Ters proxy kullanıyorsanız istek boyutu sınırını bu toplamı karşılayacak şekilde ayarlayın.

### Süper admin üzerinden depolama yönetimi

`/admin/storage` ekranı yalnızca süper admin içindir. Panelden kaydedilen ayarlar `.env` varsayılanlarının önüne geçer ve yeniden başlatmadan yeni yüklemelerde uygulanır. Boş bırakılan anahtar alanları mevcut değerlerini korur. Yerel depolamaya dönmek eski R2 dosyalarını silmez; kayıtlı R2 bağlantısı onların indirilmesi için korunur. Kaydedilmiş hesap/bucket değişimi mevcut dosyalar için ayrı taşıma işlemi gerektirir.

Ayarlar AES-256-GCM ile şifrelenir. Şifreleme anahtarı varsayılan olarak `data/storage-master.key` dosyasındadır. Linux geçişi ve yedek geri yüklemede bu dosyayı veritabanından ayrı, güvenli şekilde koruyun ve yeni sunucuya taşıyın; olmadan kayıtlı erişim anahtarları çözülemez. Üretimde bunun yerine 64 hex karakterli `STORAGE_MASTER_KEY` ortam değişkeni veya `STORAGE_KEY_FILE` yolu kullanılabilir. Mevcut anahtarı plansız değiştirmeyin.

Paneldeki dosya istatistikleri uygulamanın metadata kayıtlarından hesaplanır; Cloudflare faturalandırma/kota ölçümü değildir. Bulutun güncel erişimi test düğmesiyle ölçülür. R2 testi rastgele isimli küçük bir nesne yazar, okur ve siler; gerçek bulut testi için hesap ve bucket bilgileri gerekir.

Yerel ekler `storage/excel`, `storage/word`, `storage/pdf`, `storage/video`, `storage/resim` altında İstanbul tarihine göre `08102026-test123.png` biçiminde kaydedilir. Aynı isimde dosya varsa `-1`, `-2` eki eklenir; mevcut dosya ezilmez. Eski UUID dosyaları `LEGACY_ATTACHMENT_DIR` (varsayılan `data/attachments`) üzerinden okunmaya devam eder. Bu eski dizini mevcut ekler için koruyun.

## E-posta bildirimleri

Kullanıcıların zorunlu `users.email` alanı hem oturum hem bildirim adresidir. Kapatma bildirimi istemi açan aktif müşteriye yalnızca bayinin müşteriye açık çözümünü gönderir. Kişi ataması seçilen personele; havuz ataması/çözüm iadesi hedef şirketteki aktif standart personele ayrı ayrı bildirim oluşturur. Müşteri diğer alıcıların adreslerini ve şirket içi yorumları almaz. Yeni istem oluşturma ve yorum ekleme için ayrı mail gönderilmez.

Entegrasyon U-Shops-Web master `SendLicensePastDueAdminReminders` formatını kullanır: JSON `title`, `template`, `source`, `lang`, `reply_to`, `to`, `data`; `X-Mail-Timestamp` Unix saniyesi ve `X-Mail-Signature=HMAC-SHA256(timestamp,secret)`.

Mail şablon taslakları ve data alanları `server/mail/templates.json` içindedir. Şablon anahtarlarının Bekatos mail API'sinin kabul ettiği şablonlara eklenmesi ve içeriklerinin API'nin kullandığı şablon motorunda tanımlanması gerekir; yalnızca Jetmail panelinde kampanya şablonu oluşturmak yeterli değildir. Şablon motorunun değişken sözdizimine uyarlayın; kullanıcı metinlerini HTML escape ile yazdırın. Yerel `.env` içinde `MAIL_TEMPLATE_CLOSED`, `MAIL_TEMPLATE_ASSIGNED`, API bilgileri ve dışarıdan erişilebilir `MAIL_APP_URL` ayarlanıp `MAIL_ENABLED=true` yapıldıktan sonra sunucu yeniden başlatılmalıdır. Boş uygulama adresi bağlantısız payload üretir. Örnek `.env.example` hiçbir gizli anahtar içermez.

`mail_outbox` kayıtları istem işlemiyle aynı veritabanı transaction'ında oluşturulur. Gönderici 15 saniyede bir çalışır; 30 saniye timeout ve en fazla 5 deneme uygular. Hata maili işlem kaydını geri almaz. `.demo`, `.local`, `.test`, `.invalid`, `.example` uzantılı demo adresleri atlanır. Gönderim kapalıysa gerçek adreslerin bildirimleri kuyrukta bekler; etkinleştirmede bunlar da işlenir. Önceden kapanmış istemlere otomatik geriye dönük mail oluşturulmaz.

Durumlar: pending, sending, sent (API kabul etti; teslim garantisi değildir), failed, skipped. Kayıtlar pgAdmin üzerinden incelenebilir. Hata alanına servis yanıt gövdesi veya sırlar yazılmaz. Her olay/alıcı/tür için tek kayıt ve işleme kilidi kullanılır. API'ye Idempotency-Key gönderilir; API bu başlığı desteklemiyorsa ağ yanıtının kaybolduğu veya sunucunun gönderim sonrası kapandığı durumda yinelenen mail ihtimali vardır.

### Yerel HTML mail şablonları

Atama ve çözüm tasarımları `server/mail/templates/support-request-assigned.html` ve `server/mail/templates/support-request-closed.html` dosyalarındadır. `server/mail/render-mail.ts` içindeki `renderMail(kind, data)` fonksiyonu `subject`, `html` ve düz metin `text` üretir. Kullanıcı alanları HTML escape işleminden geçer; çözüm yalnızca closed şablonunda kullanılır. `resolution` alanına yalnızca bayinin müşteriye açık çözümü verilmelidir. Boş veya uygun olmayan `ticket_url` için bağlantı gösterilmez.

Önizleme: `npm run build:server` ardından `node scripts/preview-mail.js`. Örnek çıktılar `build/mail-previews/` altında oluşturulur; bu işlem mail göndermez.

Bu yerel renderer henüz uzak API gönderimine bağlanmamıştır: mevcut Bekatos API sözleşmesi `template` anahtarı bekler. Yerel HTML'i göndermek için API'nin HTML kabul eden sözleşmesi doğrulanmalı veya SMTP taşıyıcısı yapılandırılmalıdır. Şablon üretmek tek başına gerçek gönderimi etkinleştirmez.

### Müşteriye özel destek şirketleri

Şirket yönetiminde yeni şirketler `Müşteri` veya `Destek şirketi` olarak tanımlanır. Eski bayi ve ana üstlenici kayıtları korunur ve arayüzde destek şirketi olarak gösterilir. Bir müşteri düzenlenirken bir veya daha fazla destek şirketi seçilir; yukarı/aşağı düğmeleriyle öncelik sırası belirlenir. Aynı şirket farklı müşterilerde farklı seviyelerde bulunabilir.

Yeni istem ilk şirketin ekip havuzuna düşer. A → B → C zincirinde şirket kendi içinde veya bir önceki/sonraki şirkete atayabilir; A doğrudan C'ye atayamaz. Üst seviye, istem kendisine yönlendirilmeden listeyi, detayı veya dosyaları göremez. Daha önce işlem yapan şirket geçmişi görebilir; istem başka şirketteyken işlem yapamaz. Kişiye atanmış istemde yeniden atama ve çözümü geri iletme yalnızca atanan kişi tarafından yapılır.

Çözümü geri iletme C → B → A sırasını izler. İstemi o anda elinde bulunduran herhangi bir destek şirketi müşteriye açık bir çözüm metniyle istemi kapatabilir. Şirket içi yazışmalar ve ekleri müşteriden gizlenir. Normal müşteriye açık yorum ve öncelik değişikliği ilk destek şirketinin yetkisindedir. Kapanış bildirimi istemi oluşturan müşteriye gönderilir.

Destek sırası istem üzerinde kopya olarak saklanır. Şirket ayarlarını değiştirmek mevcut istemin erişimlerini veya sırasını değiştirmez. Başlangıçtaki eklemeli şema geçişi eski müşteri ayarlarını mümkün olduğunda destek sırasına çevirir; mevcut istemler eski akışlarını korur. Destek şirketinin belirsiz olduğu eski kayıtlarda yönetici sıralamayı açıkça seçmelidir. Yeni müşteri ayarlarında sabit Bekatos zorunluluğu yoktur.

Canlı geçiş öncesinde veritabanı yedeği alın. `npm run build` sonrasında servisin yeniden başlaması şema geçişini uygular. Uzak mail API'sindeki kapanış şablonunda sabit “bayi” ifadesi varsa “ilgili destek şirketi” olarak ayrıca güncellenmelidir; bu depodaki HTML taslağı uzak API şablonunu otomatik değiştirmez.

### Ürün kataloğu ve ürün raporları

Süper admin `Ürünler` ekranında ürün ekleyebilir ve adını düzenleyebilir. Aynı adın büyük/küçük harf veya baş/son boşluk farkıyla yeniden eklenmesi engellenir. Müşteri şirketi formundaki `Kullanılan program` alanı ürün listesinden seçilir; bu seçim yeni isteme sunucu tarafından aktarılır. Normal kullanıcılar ürün yönetimi API'sine erişemez.

İlk başlangıçta mevcut şirket ve istemlerdeki program adları ürün kataloğuna aktarılır ve kimlikleri bağlanır. Müşterinin ürünü veya ürün adı değiştiğinde geçmiş istemin ürün kimliği ve açılış anındaki ad kaydı korunur. Ürün adı değişse de raporlar aynı ürün kimliğini toplar.

`Ürün raporları` ekranında ürün başına toplam, açık ve kapalı istem sayıları; tarih, şirket, öncelik ve durum filtreleriyle incelenebilir. Sıfır istemi olan ürünler de gösterilir. Ürün satırına tıklamak ayrıntılı istem listesini filtreler. Genel raporda da ürün filtresi ve ürün dağılımı bulunur; CSV çıktısı ürün adını içerir. Ürün ekleme ve düzenleme işlemleri yönetim geçmişine kaydedilir. Şema güncellemesi servis başlangıcında otomatik uygulanır; canlı geçişten önce veri tabanı yedeği alınmalıdır.
