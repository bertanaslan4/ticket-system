import { hashPassword } from "./auth.js";
export async function seed(db) {
  if ((await db.query("SELECT id FROM users LIMIT 1")).rows.length) return;
  await db.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO organizations(id,name,kind,dealer_id,program,daily_limit) VALUES (1,'Bekatos','contractor',NULL,NULL,10),(2,'Verimsoft','dealer',NULL,NULL,10),(3,'Yargıcı','customer',2,'ushops',10),(4,'Diğer Bayi','dealer',NULL,NULL,10),(5,'Diğer Müşteri','customer',4,'ERP',10)`,
    );
    const accounts = [
      [1, 3, "Yargıcı Kullanıcısı", "musteri@yargici.demo", "member"],
      [2, 2, "Ayşe Demir", "bayi@verimsoft.demo", "member"],
      [3, 2, "Mehmet Kaya", "mehmet@verimsoft.demo", "member"],
      [4, 1, "Bertan Aslan", "bertan@bekatos.demo", "member"],
      [5, 1, "Selin Yılmaz", "selin@bekatos.demo", "member"],
      [6, 5, "Diğer Müşteri", "diger@musteri.demo", "member"],
      [7, 4, "Diğer Bayi", "diger@bayi.demo", "member"],
    ];
    for (const [id, org, name, email, role] of accounts)
      await tx.query(
        "INSERT INTO users(id,org_id,name,email,password_hash,system_role) VALUES ($1,$2,$3,$4,$5,$6)",
        [id, org, name, email, hashPassword("Demo2026!"), role],
      );
    await tx.query(
      `INSERT INTO tickets(customer_id,dealer_id,created_by,program,title,description,type,severity,owner_org_id) VALUES (3,2,1,'ushops','Sipariş ekranında stok bilgisi güncellenmiyor','Mağaza stokları güncellendiğinde sipariş ekranında eski stok miktarı görüntüleniyor. Sayfa yenilendiğinde sorun devam ediyor.','Hata','s1',2),(3,2,1,'ushops','Satış raporuna tarih filtresi eklenmesi','Satış raporunda başlangıç ve bitiş tarihine göre filtreleme yapabilmek istiyoruz.','İstek','s3',2),(3,2,1,'ushops','Ürün görselleri geç yükleniyor','Ürün listesinde görsellerin yüklenmesi uzun sürüyor.','Hata','s2',2)`,
    );
    await tx.query(
      `INSERT INTO events(ticket_id,actor_id,kind,visibility,body) SELECT id,1,'created','public','Bilet oluşturuldu ve Verimsoft havuzuna iletildi.' FROM tickets`,
    );
    await tx.query(
      `SELECT setval(pg_get_serial_sequence('organizations','id'),(SELECT max(id) FROM organizations));`,
    );
    await tx.query(
      `SELECT setval(pg_get_serial_sequence('users','id'),(SELECT max(id) FROM users));`,
    );
    await tx.query("INSERT INTO products(name) VALUES('ushops'),('ERP') ON CONFLICT DO NOTHING");
    await tx.query('UPDATE organizations o SET product_id=p.id FROM products p WHERE lower(o.program)=lower(p.name)');
    await tx.query('UPDATE tickets t SET product_id=p.id FROM products p WHERE lower(t.program)=lower(p.name)');
  });
}
