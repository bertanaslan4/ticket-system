from pathlib import Path
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
import pypdfium2 as pdfium

root=Path(__file__).resolve().parent
out=root/'Takipsan_Destek_Merkezi_Genel_Ozet.pdf'
for name,file in [('Guide','arial.ttf'),('GuideBold','arialbd.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(Path('C:/Windows/Fonts')/file)))
pdfmetrics.registerFontFamily('Guide',normal='Guide',bold='GuideBold')
style=ParagraphStyle('body',fontName='Guide',fontSize=11,leading=15,textColor=colors.HexColor('#243b49'))
pages=[
('Destek Merkezi genel akışı','dashboard.png',
 '<b>Müşteri oluşturur → Bayi inceler → Gerekirse Takipsan çözer → Bayi test eder ve kapatır.</b><br/>Genel bakış ekranı açık ve kapanan istemleri özetler. Listeden durum, öncelik, ilgili ekip, açılış ve son güncelleme tarihleri takip edilir. Bayi kendi çözebildiği konuları Takipsan’a aktarmadan kapatabilir.'),
('Müşteri destek istemini oluşturur','new-request.png',
 '<b>Tür, öncelik, başlık ve açıklama girilir; gerekli dosyalar eklenir.</b><br/>Müşteri ve program bilgileri hesaptan otomatik alınır. S1 kritik, S2 orta, S3 düşük önceliktir. Günlük limit kontrolünden sonra istem sorumlu bayiye iletilir. Excel, Word, PDF, resim ve video eklenebilir; işlem başına en fazla 5 dosya, dosya başına 25 MB kabul edilir.'),
('Ekipler çalışır ve müşteri sonucu takip eder','detail.png',
 '<b>Bayi ile Takipsan istemi birbirine veya ilgili personele atayabilir.</b><br/>Karşı ekibe atama sonrası yorum alanı kapanır. Şirket içi yorumlar müşteriye gösterilmez; müşteri atama hareketlerini zaman çizelgesinde izler. Takipsan çözümü bayiye döner, bayi onaylayıp müşteriye açık çözümle kapatır. Resim ekleri tıklanınca modalda açılır.'),
('Süper admin sistemi yönetir','users.png',
 '<b>Şirketler, kullanıcılar ve erişim yetkileri tek merkezden yönetilir.</b><br/>Şirket ve kullanıcı ekleme formları modalda açılır. Müşterinin sorumlu bayisi, programı ve günlük limiti şirket tanımında belirlenir. Kullanıcı rolü şirketten alınır; süper admin yetkisi ayrıca seçilir. Depolama ayarlarından yerel disk veya Cloudflare R2 yönetilir.'),
('Raporlar ve bildirimler süreci tamamlar','reports.png',
 '<b>Raporlar tarih, müşteri, bayi, durum, öncelik ve istem türüne göre filtrelenir; CSV olarak alınabilir.</b><br/>Atamada ilgili kullanıcı veya ekip, kapanışta istemi oluşturan müşteri e-posta ile bilgilendirilir. Mail ulaşmazsa kayıtlı adres, spam klasörü ve sağlayıcının teslimat raporu kontrol edilir. API’nin başarılı yanıtı tek başına gelen kutusuna teslimatı doğrulamaz.'),
]
W,H=landscape(A4)
c=canvas.Canvas(str(out),pagesize=(W,H))
c.setTitle('Takipsan Destek Merkezi Genel Özet')
c.setAuthor('Takipsan')
for n,(title,img,text) in enumerate(pages,1):
    c.setFillColor(colors.HexColor('#147bb2'));c.rect(0,H-7,W,7,fill=1,stroke=0)
    c.setFillColor(colors.black);c.setFont('GuideBold',22);c.drawString(32,H-40,title)
    p=Paragraph(text,style);_,ph=p.wrap(W-64,200);p.drawOn(c,32,H-58-ph)
    iw,ih=Image.open(root/'screenshots'/img).size
    top=H-68-ph
    scale=min((W-64)/iw,(top-43)/ih)
    w,h=iw*scale,ih*scale
    c.drawImage(str(root/'screenshots'/img),(W-w)/2,top-h,width=w,height=h)
    c.setFont('Guide',8);c.setFillColor(colors.HexColor('#596b76'))
    c.drawString(32,20,'TAKİPSAN  •  Genel kullanım özeti  •  9 Ekim 2026')
    c.drawRightString(W-32,20,f'{n} / {len(pages)}')
    c.bookmarkPage(str(n));c.addOutlineEntry(title,str(n),level=0)
    c.showPage()
c.save()
qa=root/'qa';qa.mkdir(exist_ok=True)
pdf=pdfium.PdfDocument(str(out))
for i in range(len(pdf)):pdf[i].render(scale=1.6).to_pil().save(qa/f'page-{i+1}.png')
print(out)
