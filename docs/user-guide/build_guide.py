from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from PIL import Image
import pypdfium2 as pdfium

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'Takipsan_Destek_Merkezi_Kullanim_Kilavuzu.pdf'
for name,file in [('Guide','arial.ttf'),('GuideBold','arialbd.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(Path('C:/Windows/Fonts')/file)))
pdfmetrics.registerFontFamily('Guide',normal='Guide',bold='GuideBold',italic='Guide',boldItalic='GuideBold')
W,H=landscape(A4)
c=canvas.Canvas(str(OUT),pagesize=(W,H))
c.setTitle('Takipsan Destek Merkezi Kullanım Kılavuzu')
c.setAuthor('Takipsan')
body=ParagraphStyle('body',fontName='Guide',fontSize=11.2,leading=16,textColor=colors.HexColor('#243b49'),spaceAfter=9)
small=ParagraphStyle('small',parent=body,fontSize=9,leading=12)

def para(text,x,y,width,style=body):
    p=Paragraph(text,style); _,height=p.wrap(width,1000)
    if y-height<42: raise ValueError('Page content overflow: '+text[:65])
    p.drawOn(c,x,y-height)
    return y-height-10

page=0
def start(title,subtitle):
    global page
    page+=1
    c.setFillColor(colors.HexColor('#147bb2')); c.rect(0,H-9,W,9,fill=1,stroke=0)
    c.setFillColor(colors.black); c.setFont('GuideBold',23); c.drawString(38,H-47,title)
    c.setFont('Guide',10); c.setFillColor(colors.HexColor('#596b76')); c.drawString(38,H-69,subtitle)
    c.setFont('Guide',8.5); c.drawString(38,23,'TAKİPSAN  •  Destek Merkezi  •  Kullanım kılavuzu  •  9 Ekim 2026')
    c.drawRightString(W-38,23,str(page))
    c.bookmarkPage('page'+str(page)); c.addOutlineEntry(title,'page'+str(page),level=0)

def screen(name,caption):
    file=ROOT/'screenshots'/name
    iw,ih=Image.open(file).size
    maxw,maxh=337,405
    scale=min(maxw/iw,maxh/ih)
    w,h=iw*scale,ih*scale
    x=38+(maxw-w)/2; top=H-94
    c.drawImage(str(file),x,top-h,width=w,height=h)
    para(caption,38,top-h-12,maxw,small)

def content(items,x=402,width=400):
    y=H-99
    for text in items: y=para(text,x,y,width)

start('Takipsan Destek Merkezi Kullanım Kılavuzu','Müşteri, bayi, Takipsan ve süper admin için genel kullanım')
y=para('Bu kılavuz, destek isteminin oluşturulmasından çözüme kadar izlenecek adımları açıklar. Amaç; doğru ekibe atama yapmak, müşteriyle paylaşılacak bilgiyi ayırmak ve her işlemi zaman çizelgesinden takip etmektir.',38,H-103,W-76)
y=para('<b>Temel akış</b>  Müşteri oluşturur → Bayi inceler → Gerekirse Takipsan çözer → Bayi test eder → Müşteriye açık çözüm ile kapatılır.',38,y,W-76)
roles=[
('Müşteri','Destek istemi açar, kendi şirketinin istemlerini ve müşteriye açık yanıtları takip eder.'),
('Bayi','İlk incelemeyi yapar, ciddiyeti düzenler, atama yapar ve müşteriye son çözümü iletir.'),
('Takipsan','Teknik inceleme ve geliştirmeyi yapar. Çözümü müşteriye değil, test için bayiye iletir.'),
('Süper admin','Şirketleri, kullanıcıları, raporları ve dosya depolama ayarlarını yönetir.'),
]
for role,desc in roles: y=para('<b>'+role+'</b>  '+desc,38,y,W-76)
y=para('<b>Kısa yol</b>  Giriş ve takip 2 • Yeni istem 3 • Ekipler arası süreç 4 • Çözüm 5 • Ekler 6 • Şirketler 7 • Kullanıcılar 8 • Raporlar 9 • Depolama 10 • Bildirimler ve yardım 11',38,y,W-76)
para('Menüler ve işlem düğmeleri hesabınızın rolüne ve istemin o anda hangi ekipte olduğuna göre değişir. Ekranlardaki kayıt sayıları ve örnek içerikler zaman içinde farklılaşabilir.',38,y,W-76,small)
c.showPage()

start('Giriş ve destek istemlerini takip etme','Tüm kullanıcılar')
screen('dashboard.png','Şekil 1  Genel bakış durum kartları')
content([
'<b>1  Giriş yapın</b><br/>Sistem yöneticinizin verdiği uygulama adresini açın. Kendi e-posta adresiniz ve şifrenizle giriş yapın. Hesabınızın aktif olması gerekir.',
'<b>2  Dili seçin</b><br/>Üst bölümdeki Dil alanından Türkçe veya English seçin. Arayüz dili değişir; kullanıcıların yazdığı açıklama ve yorumlar otomatik çevrilmez.',
'<b>3  Genel bakışı inceleyin</b><br/>Toplam, devam eden, bayi onayındaki ve çözülen istem kartlarından durumu izleyin. Listeyi arama alanı ve durum filtreleriyle daraltın.',
'<b>4  Detayı açın</b><br/>Destek İstemleri listesindeki konu başlığına tıklayın. Durum, ciddiyet, ilgili ekip ve atanan kişiyi kontrol edin. Açılış ve son güncelleme tarihleri listede bulunur.',
'<b>Oturum güvenliği</b><br/>Ortak bilgisayarda işiniz bittiğinde Çıkış yap seçeneğini kullanın. localhost adresi yalnızca uygulamanın çalıştığı bilgisayarda kullanılabilir.'
]); c.showPage()

start('Yeni destek istemi oluşturma','Müşteri')
screen('new-request.png','Şekil 2  Kaydedilmemiş örnek istem formu')
content([
'<b>1  Yeni destek istemi oluştur seçeneğini açın</b><br/>Müşteri ve program bilgileri hesabınızdan otomatik alınır; formda ayrıca girilmez.',
'<b>2  Tür ve ciddiyeti seçin</b><br/>Hata: çalışmayan veya yanlış sonuç veren işlem.<br/>İstek: yeni ihtiyaç veya geliştirme talebi.<br/>S1: iş akışı durdu. S2: iş akışı etkileniyor. S3: genel talep.',
'<b>3  Başlık ve açıklamayı yazın</b><br/>Başlıkta konuyu özetleyin. Açıklamada hangi ekranda, hangi adımlarda sorun oluştuğunu; beklenen ve gerçekleşen sonucu belirtin. Gerekirse kayıt numarası ve hata zamanını ekleyin.',
'<b>4  Ekleri seçip oluşturun</b><br/>Dosya ekleri alanına ilgili görüntü veya belgeleri ekleyin. Sayfanın altındaki Destek istemini oluştur düğmesini kullanın.',
'<b>Günlük limit</b><br/>Kalan hakkınız formun altında gösterilir. Limit dolduğunda yeni istem oluşturulamaz. Oluşan istem, şirketinizin sorumlu bayisinin havuzuna düşer.'
]); c.showPage()

start('Bayi ve Takipsan arasında çalışma','İnceleme, yorum ve çift yönlü atama')
screen('resolution.png','Şekil 3  Ekip hareketleri zaman çizelgesinde kayıtlıdır\nSüper admin görünümü')
content([
'<b>Bayi ilk incelemeyi yapar</b><br/>Açıklamayı ve ekleri inceleyin. İstem sizdeyken İşlem yap alanından Yorum, Ata ve Ciddiyet işlemlerini kullanın. Gerekirse ciddiyeti gerçek etkiye göre düzeltin.',
'<b>Doğru görünürlüğü seçin</b><br/>Bayi yorumunda Müşteriye Açık veya Şirket İçi seçimini kontrol edin. Takipsan teknik yorumları şirket içidir. Müşteri bu yazışmaları ve eklerini göremez.',
'<b>Atama yapın</b><br/>Ata bölümünde hedef ekibi seçin. Belirli personeli seçebilir veya ekip havuzuna bırakabilirsiniz. Teknik konu bayiyi aşıyorsa Takipsan ekibine yönlendirin.',
'<b>Eksik bilgi için geri yönlendirin</b><br/>Takipsan gerekli log veya yeniden üretme adımlarını şirket içi yorumla belirtip bayiye atayabilir. Bayi bilgileri ekleyerek tekrar Takipsan’a yönlendirir.',
'<b>Önce yorum sonra atama</b><br/>İstem karşı ekibe geçince bayi veya Takipsan tarafındaki yorum alanı kapanır. İşlem yapmadan önce İlgili ekip ve Atanan kişi alanlarını kontrol edin.'
]); c.showPage()

start('Çözüm ve kapatma','Müşteriye son yanıtı bayi verir')
screen('customer-resolution.png','Şekil 4  Müşteri görünümünde bayinin çözümü')
content([
'<b>Bayi doğrudan çözebiliyorsa</b><br/>Sorunu giderin. Kapat bölümüne müşterinin anlayacağı bir çözüm açıklaması yazın; gerekiyorsa dosya ekleyin ve bilgilendirerek kapatın.',
'<b>Takipsan çözdüyse</b><br/>Çözüm bölümüne yapılan işlemi ve bayi için kontrol adımlarını yazın. Çözümü bayiye iade edin. İstem Bayi onayında durumuna geçer.',
'<b>Bayi kontrolü tamamlar</b><br/>Gelen çözümü test edin. Sorun sürüyorsa bulguları şirket içi yorumla ekleyip Takipsan’a yeniden atayın. Çözüm uygunsa Kapat bölümünde test ve onay kutusunu işaretleyin.',
'<b>Müşteriye açık çözüm</b><br/>Son metin; yapılan işlemi, sonucu ve müşterinin varsa yapması gereken adımı içermelidir. Müşteri detayda Çözüldü · Bayi çözümü bölümünü görür; Takipsan’ın iç çözüm notunu görmez.',
'<b>Kapalı istemler</b><br/>Süreç tamamlandıktan sonra istem üzerinde işlem yapılamaz. Yeni bir konu için yeni destek istemi oluşturun.'
]); c.showPage()

start('Dosya ekleri ve resim önizleme','Müşteri, bayi ve Takipsan')
screen('image-preview.png','Şekil 5  Resim eki modal içinde açılır')
content([
'<b>Nerelerde dosya eklenebilir</b><br/>Yeni istem açıklamasında, yorumda, Takipsan çözümünde ve bayinin kapatma açıklamasında dosya seçebilirsiniz.',
'<b>Desteklenen dosyalar</b><br/>Excel, Word, PDF, PNG/JPEG/GIF/WebP resimleri ve MP4/WebM/MOV videoları desteklenir. Tek işlemde en fazla 5 dosya seçin; her dosya en fazla 25 MB olabilir.',
'<b>Resmi açın</b><br/>Ek listesindeki resim adına tıklayın. Resim indirilmek yerine modalda gösterilir. Kapat düğmesi veya Esc tuşuyla listeye dönün.',
'<b>Dosyayı indirin</b><br/>Resim modalındaki Dosyayı indir bağlantısını kullanabilirsiniz; dar ekranda aşağı kaydırmanız gerekebilir. Diğer dosya türlerinde dosya adına tıklamak indirme işlemini başlatır.',
'<b>Eklerin görünürlüğü</b><br/>Dosya, eklendiği metnin görünürlüğünü paylaşır. Şirket içi yoruma eklenen belge müşteriye açılmaz. Önizleme yüklenmiyorsa dosyayı indirmeyi deneyin veya yetkinizi kontrol ettirin.'
]); c.showPage()

start('Şirket tanımlama','Süper admin')
screen('organization-form.png','Şekil 6  Şirket ekleme modalı')
content([
'<b>1  Şirketler bölümünü açın</b><br/>Şirket ekle düğmesine tıklayın. Form modal olarak açılır.',
'<b>2  Şirket adını ve türünü girin</b><br/>Müşteri, Bayi veya Ana üstlenici türlerinden uygun olanı seçin. Kullanıcıların şirket rolü bu tanıma göre belirlenir.',
'<b>3  Müşteri bağlantılarını tanımlayın</b><br/>Müşteri şirketinde Sorumlu bayi, Kullanılan program ve Günlük destek istemi limiti alanlarını doldurun. Bayiyi önce oluşturmak, müşteri tanımını kolaylaştırır.',
'<b>4  Kaydedin ve kontrol edin</b><br/>Şirket listesinde bayi/program ve limit bilgilerini kontrol edin. Değişiklik için ilgili satırdaki Düzenle düğmesini kullanın.',
'<b>Kurulum sırası</b><br/>Önce ana üstlenici ve bayi şirketlerini, ardından müşterileri, son olarak kullanıcıları tanımlayın. Kaydetmeden çıkmak için Vazgeç veya Kapat kullanın.'
]); c.showPage()

start('Kullanıcı ve erişim yönetimi','Süper admin')
screen('user-form.png','Şekil 7  Kullanıcı ekleme modalı')
content([
'<b>1  Kullanıcılar bölümünden Kullanıcı ekle seçin</b><br/>Ad soyad, e-posta adresi, şirket ve şifreyi girin.',
'<b>2  Sistem yetkisini seçin</b><br/>Standart · Şirket rolü, kullanıcının müşteri/bayi/ana üstlenici yetkisini şirketten alır. Süper admin · Tüm sistem seçimi yönetim alanlarına erişim verir.',
'<b>3  Hesabın durumunu belirleyin</b><br/>Hesap aktif işaretliyse kullanıcı giriş yapabilir. Pasif hesaplar giriş yapamaz.',
'<b>4  E-posta adresini doğrulayın</b><br/>Atama ve çözüm bildirimleri kayıtlı e-posta adresine gönderilir. Gerçek kullanımda erişilebilir adres yazın; örnek/demo adresler teslimat için kullanılmaz.',
'<b>Mevcut kullanıcıyı düzenleme</b><br/>Listeden Düzenle seçin. Şifre veya yetki değişikliği mevcut oturumları sonlandırabilir; kullanıcı yeniden giriş yapmalıdır. Süper admin yetkisini yalnızca sistem yönetimi yapacak kişilere verin.'
]); c.showPage()

start('Raporlama ve dışa aktarma','Süper admin')
screen('reports.png','Şekil 8  Destek istemi rapor filtreleri')
content([
'<b>1  Raporlar bölümünü açın</b><br/>Başlangıç ve bitiş tarihini seçin. Gerekirse müşteri, bayi, durum, ciddiyet ve istem türü filtrelerini belirleyin.',
'<b>2  Raporu getir düğmesine basın</b><br/>Tarih aralığı, istemin oluşturulma tarihine göre İstanbul saat diliminde uygulanır. Sıfırla seçimiyle filtreleri temizleyebilirsiniz.',
'<b>3  Göstergeleri değerlendirin</b><br/>Toplam, açık ve kapatılan istem sayıları ile ortalama çözüm süresini inceleyin. Ortalama çözüm süresi kapanmış istemler için takvim saati üzerinden hesaplanır.',
'<b>4  Ayrıntıya gidin veya dışa aktarın</b><br/>Sonuç listesindeki konu üzerinden istem detayını açın. CSV indir düğmesiyle rapor sonuçlarını dışa aktarabilirsiniz.',
'<b>Yönetim geçmişi</b><br/>Şirket, kullanıcı ve yönetim işlemlerini izlemek için Yönetim geçmişi bölümünü kullanın. İsteme ait işlem geçmişi ise istem detayındaki zaman çizelgesindedir.'
]); c.showPage()

start('Dosya depolama ayarları','Süper admin')
screen('storage.png','Şekil 9  Bulut depolama ayarları')
content([
'<b>Yerel disk</b><br/>Aktif depolama alanında Yerel disk seçilebilir. Dosyalar proje içindeki storage klasöründe excel, word, pdf, video ve resim alt klasörlerine ayrılır.',
'<b>Dosya adları</b><br/>Tarih öneki kullanılır. Örnek: 09102026-ekran.png. Aynı adlı dosya bulunduğunda çakışmayı önlemek için ek numara kullanılabilir.',
'<b>Cloudflare R2</b><br/>Account ID, Bucket, Access Key ID ve Secret Access Key alanlarını yetkili yöneticinizden alın. Bucket özel tutulmalıdır.',
'<b>Bağlantıyı doğrulayın</b><br/>Bağlantıyı test et ile kontrol yapın. Test et ve kaydet işlemi, yazma/okuma/silme kontrolünün ardından ayarı kaydeder. Sağlayıcı değişikliği mevcut dosyaları otomatik taşımaz.',
'<b>Durumu izleyin</b><br/>Sayfanın aşağısında uygulama, veritabanı ve son başarılı bağlantı testi bulunur. Yenile güncel durumu getirir. Dosya sayıları yalnızca bu uygulamanın kayıtlarıdır; bulut kotası veya fatura bilgisi değildir.'
]); c.showPage()

start('Bildirimler ve sık karşılaşılan durumlar','Günlük kullanım için hızlı başvuru')
y=H-102
left=[
'<b>Hangi durumda mail gelir</b><br/>Belirli kullanıcıya atamada o kullanıcı; ekip havuzuna atamada ilgili ekibin aktif standart kullanıcıları bilgilendirilir. Bayi istemi kapattığında istemi oluşturan müşteri kullanıcısına çözüm bildirimi gönderilir.',
'<b>Mail ulaşmadıysa</b><br/>Kayıtlı e-posta adresini ve Spam/Gereksiz klasörünü kontrol edin. Yöneticinize istem numarasını, işlem saatini ve alıcı adresini iletin. API’nin başarılı yanıtı, gelen kutusuna teslimatın kanıtı değildir; sağlayıcı teslimat raporu ayrıca incelenmelidir.',
'<b>Yeni istem açılamıyorsa</b><br/>Zorunlu alanları, dosya sayısını/boyutunu ve günlük limiti kontrol edin. Yeni istem oluşturma yetkisi müşteri rolündedir.',
]
for t in left:y=para(t,38,y,363)
y=H-102
right=[
'<b>Yorum alanı görünmüyorsa</b><br/>İstem kapalı olabilir veya başka ekibe atanmış olabilir. Bayi ve Takipsan, istem kendi ekiplerindeyken işlem yapar. İlgili ekip alanını kontrol edin.',
'<b>Bir yorum veya ek görünmüyorsa</b><br/>Müşteri hesabında şirket içi yazışmaların gizlenmesi normaldir. Kullanıcı yalnızca yetkili olduğu istemleri ve ekleri görebilir.',
'<b>Ekran güncel değilse</b><br/>Liste üzerindeki Yenile seçeneğini kullanın. Uygulama güncellemesinden sonra sayfa açılmıyorsa tarayıcıyı yenileyin. Sorun sürerse ekrandaki hata ve işlem adımlarını yöneticinize bildirin.',
'<b>Göndermeden önce son kontrol</b><br/>Doğru istem mi? Doğru görünürlük mü? Doğru ekip ve kişi mi? Ekler uygun mu? Bayi kapanışında müşteriye açık çözüm anlaşılır mı?',
]
for t in right:y=para(t,440,y,363)
c.showPage();c.save()
qa=ROOT/'qa';qa.mkdir(exist_ok=True)
pdf=pdfium.PdfDocument(str(OUT))
for i in range(len(pdf)):
    pdf[i].render(scale=1.4).to_pil().save(qa/f'page-{i+1}.png')
print(f'{len(pdf)} pages: {OUT}')

