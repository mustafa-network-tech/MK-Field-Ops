export const SITE_URL = 'https://mk-ops.tr';
export const contact = {
  demo: 'https://mkops-demo.vercel.app/login',
  phone: (import.meta.env.VITE_LANDING_WHATSAPP_E164 as string | undefined)?.trim().replace(/^\+/, '') || '905456597551',
};
export const contactUrl = `https://wa.me/${contact.phone}?text=${encodeURIComponent('MK OPS hakkında bilgi almak istiyorum.')}`;
export interface Solution {
  slug: string; title: string; description: string; intro: string;
  problem: string; sections: { title: string; text: string }[];
  steps: string[]; audience: string; faq: { question: string; answer: string }[]; related: string[];
}
export const solutions: Solution[] = [
  {
    slug: 'telekom-saha-takibi', title: 'Telekom ve Fiber Saha Takip Yazılımı',
    description: 'Telekom ve fiber saha çalışmalarını proje, ekip, iş kalemi ve malzeme kayıtlarıyla takip edin. MK OPS ile sahadan onaya uzanan akışı inceleyin.',
    intro: 'MK OPS, telekom ve fiber altyapı ekiplerinin yaptığı işleri proje ve ekip bazında kaydetmesini sağlayan bir saha operasyon yazılımıdır. Günlük üretim, kullanılan malzeme ve onay durumu aynı iş akışında buluşur.',
    problem: 'Bir fiber projesinde işin hangi projeye ait olduğu, hangi ekibin ne kadar üretim yaptığı ve hangi malzemenin kullanıldığı ayrı listelerde kalabilir. Proje numarası ile günlük saha kayıtları arasındaki bağ kaybolduğunda dönem sonunda yapılan işi açıklamak zorlaşır.',
    sections: [
      { title: 'Proje kimliğini günlük çalışmaya taşıyın', text: 'Projeler kampanya, proje yılı ve dış proje numarasıyla tanımlanır. Aktif, tamamlanmış ve arşivlenmiş proje durumları izlenir. Günlük iş girişinde aktif proje seçimi, saha kaydının hangi çalışma kapsamında yapıldığını belirginleştirir.' },
      { title: 'Fiber malzemesini birimiyle takip edin', text: 'İç, yeraltı ve havai kablo türleri; makara bilgisi, metre miktarı ve kalan uzunlukla takip edilebilir. Boru, fiber bina kutusu ve sonlandırma paneli gibi malzemeler de stok yapısında yer alır. Ekip zimmeti ile işte kullanılan miktar arasında ilişki kurulur.' },
      { title: 'Ekip ve iş kalemlerini ortak bir düzende yönetin', text: 'Ekip lideri, ekip üyeleri, araç ve ekip payı bilgileri operasyon kaydına bağlanır. İş kalemi kataloğundaki birim ve fiyat bilgileri yapılan işin hesabında kullanılır. Böylece proje takibi, malzeme hareketi ve hakediş değerlendirmesi ortak kayıtlara dayanır.' },
    ],
    steps: ['Kampanya ve projeyi tanımlayın; iş kalemlerini ve ekipleri hazırlayın.', 'Sahada yapılan işi aktif projeye bağlayarak miktarı ve malzeme kullanımını kaydedin.', 'Gönderilen işleri inceleyin; onaylı üretimi dönem raporlarında değerlendirin.'],
    audience: 'Telekom ve fiber altyapı çalışmalarını yöneten şirket yöneticileri, proje yöneticileri ve saha ekip liderleri için uygundur. Ekip lideri kendisine bağlı ekipler kapsamında çalışır.',
    faq: [{ question: 'MK OPS fiber ağ tasarımı yapar mı?', answer: 'Bu çözüm proje, iş ve malzeme kayıtlarını takip eder. Fiber ağ tasarımı, harita üzerinde ek noktası yönetimi veya ölçüm cihazı entegrasyonu sunulduğu iddia edilmez.' }, { question: 'Araç bilgisi ne için kullanılır?', answer: 'Araç kataloğundaki araç ekiple ilişkilendirilebilir. Bu özellik canlı GPS konum takibi anlamına gelmez.' }],
    related: ['gunluk-is-takibi', 'irsaliye-malzeme-takibi', 'hakedis-takibi'],
  },
  {
    slug: 'gunluk-is-takibi', title: 'Günlük Saha İşi Takip Sistemi',
    description: 'Saha işlerini tarih, proje, ekip, iş kalemi ve miktarla kaydedin. Taslak, not, fotoğraf ve onaya gönderme akışını MK OPS ile inceleyin.',
    intro: 'Günlük iş takibi, sahada yapılan üretimin tarih, proje, ekip ve miktar bilgisiyle kayda alınmasıdır. MK OPS bu kaydı malzeme kullanımı, ekipman, not ve isteğe bağlı fotoğraflarla birlikte tutar.',
    problem: 'Mesaj grubunda paylaşılan bir miktar, sonradan düzenlenen bir Excel satırı ve telefonda kalan fotoğraf aynı işi anlatıyor olabilir. Kayıtlar ayrı kaldığında işi inceleyen yönetici eksik bilgiyi tekrar istemek zorunda kalır.',
    sections: [
      { title: 'İşin bağlamını giriş sırasında belirleyin', text: 'Tarih, aktif proje, onaylı ekip, iş kalemi ve miktar günlük kaydın temelini oluşturur. Ekip lideri kendi ekipleri için giriş yapar. İş kalemi seçimi, miktarın hangi birim ve çalışma türüne ait olduğunu anlaşılır kılar.' },
      { title: 'Malzeme ve saha açıklamasını ekleyin', text: 'Kullanılan malzeme ekip zimmetinden seçilebilir; harici malzeme kullanımı açıklamasıyla belirtilebilir. Ekipman ve not alanları işi tamamlar. Bir iş kaydına isteğe bağlı en fazla üç fotoğraf eklenebilir; fotoğraflar herkese açık ürün sayfalarında gösterilmez.' },
      { title: 'Taslağı incelemeye hazır kayda dönüştürün', text: 'Yeni iş taslak olarak oluşur. Onaya gönderilen kayıtlar yöneticinin inceleme listesine geçer. İşler ekranında durumları izlemek, henüz taslak olan bir işi onaylanmış üretimle karıştırmayı önler. Finansal toplamlar onaylı işler üzerinden hesaplanır.' },
    ],
    steps: ['Proje, ekip, iş kalemi ve yapılan miktarı girin.', 'Malzeme kullanımını, notları ve gerekiyorsa fotoğrafları ekleyin.', 'Taslağı kontrol edip onaya gönderin; işin durumunu işler listesinden izleyin.'],
    audience: 'Sahadan kayıt oluşturan ekip liderleri ile şirket ve proje yöneticileri kullanır. Kayıtlar kullanıcının şirket ve ekip kapsamıyla ilişkilidir.',
    faq: [{ question: 'Günlük iş kaydı hakedişe hemen dahil olur mu?', answer: 'Taslak veya gönderilmiş olması yeterli değildir. Hakediş hesapları onaylı iş kayıtlarını esas alır.' }, { question: 'Bu özellik puantaj tutar mı?', answer: 'Burada takip edilen bilgi yapılan iş ve miktarıdır. Mesai, vardiya veya personel puantajı bu çözümün kapsamı değildir.' }],
    related: ['saha-onay-surecleri', 'hakedis-takibi', 'telekom-saha-takibi'],
  },
  {
    slug: 'saha-onay-surecleri', title: 'Saha İşleri Onay Süreçleri',
    description: 'Gönderilen saha işlerini inceleyin, onaylayın veya reddedin. MK OPS iş durumlarını malzeme zimmeti ve hakediş hesaplarıyla ilişkilendirir.',
    intro: 'MK OPS onay süreci, sahadan gönderilen iş kaydının şirket veya proje yöneticisi tarafından değerlendirilmesidir. İşin durumu, stok kullanımı ve hesaplamaya dahil olması bu akışla ilişkilidir.',
    problem: 'Bir işin mesajla tamamlandığının bildirilmesi ile yöneticinin o işi kabul etmesi farklı aşamalardır. Bu ayrım kayıt altına alınmadığında bekleyen işler ile kabul edilmiş üretim aynı toplamda değerlendirilebilir.',
    sections: [
      { title: 'Bekleyen işleri tek listede inceleyin', text: 'Onaylar ekranı gönderildi durumundaki işleri listeler. Şirket yöneticisi ve proje yöneticisi bu kayıtları inceleyerek onay veya ret işlemi yapabilir. Taslaklar bu listeye gönderilmeden önce hazırlık aşamasında kalır.' },
      { title: 'Malzeme kontrolünü işin kabulüne bağlayın', text: 'İşte ekip zimmetinden malzeme kullanılmışsa onay sırasında yeterli miktar kontrol edilir. Yetersiz zimmet onayı engelleyebilir. Başarılı onayda ilgili kullanım düşülür; kayıttaki stok düşüm işareti aynı işlemde tekrar düşümü önlemek için kullanılır.' },
      { title: 'Sonucu rapor ve geçmişte izleyin', text: 'Onaylanmış işler iş değeri ve ekip kazancı hesaplarına girer. Oluşturma, gönderme, onaylama ve reddetme işlemleri için denetim olayları üretilir. Proje yöneticisinin iş onayı şirket yöneticisine yönelik bildirim akışına da bağlanır.' },
    ],
    steps: ['Ekip günlük iş kaydını onaya gönderir.', 'Yetkili yönetici gönderilen işi ve malzeme kullanımını inceler.', 'Onaylanan iş hesaplamalarda değerlendirilir; reddedilen iş ayrı durumuyla izlenir.'],
    audience: 'İş kabulünü yapan şirket ve proje yöneticileri için tasarlanmıştır. Ekip lideri kayıt gönderir ve kendi kapsamındaki işlerin durumunu takip eder.',
    faq: [{ question: 'Her kullanıcı iş onaylayabilir mi?', answer: 'Onaylar ekranındaki iş onay yetkisi şirket yöneticisi ve proje yöneticisi rollerindedir.' }, { question: 'Birden fazla zorunlu onay kademesi var mı?', answer: 'Bu akış işin yetkili yönetici tarafından onaylanmasını veya reddedilmesini kapsar. Özelleştirilebilir çok kademeli onay motoru vaat edilmez.' }],
    related: ['gunluk-is-takibi', 'irsaliye-malzeme-takibi', 'denetim-gunlugu'],
  },
  {
    slug: 'hakedis-takibi', title: 'Saha Hakediş Takip Sistemi',
    description: 'Onaylı saha işlerinden toplam iş değeri, ekip kazancı ve şirket payını hesaplayın. MK OPS hakediş dönemlerini ve dönem raporlarını keşfedin.',
    intro: 'MK OPS hakediş takibi, onaylanmış iş miktarlarını iş kalemi birim fiyatıyla hesaplar; ekip yüzdesine göre ekip kazancı ve şirket payını ayırır. Bu çalışma, yapılan saha üretiminin dönem bazında değerlendirilmesini sağlar.',
    problem: 'Dönem sonunda ayrı dosyalardaki miktarları, iş kalemi fiyatlarını ve ekip paylarını birleştirmek gerekir. Onay durumu belirgin değilse henüz kabul edilmemiş işlerin hesaba katılması veya dönem sınırının karışması mümkündür.',
    sections: [
      { title: 'Hesabın hangi kayıttan geldiğini bilin', text: 'Toplam iş değeri miktar ile iş kalemi birim fiyatının çarpımından oluşur. Ekip kazancı bu değere ekip yüzdesi uygulanarak hesaplanır; kalan tutar şirket payıdır. Kaydın ekip ve iş kalemi bilgileri hesaplamanın temelidir.' },
      { title: 'Takvim ayı yerine çalışma döneminizi kullanın', text: 'Şirket için hakediş dönemi başlangıç günü tanımlanabilir. Dönem aralığına giren onaylı işler raporlarda birlikte değerlendirilir. Dönem yönetimi ve kapalı dönem kontrolü, geçmiş dönem işlerine ilişkin işlemleri sınırlandıran mekanizmalar içerir.' },
      { title: 'Şirket ve ekip bakışını ayırın', text: 'Yöneticiler toplam iş değeri ile şirket ve ekip paylarını dönem üzerinden inceler. Ekip liderinin görünümü kendi ekip kapsamına ve fiyat görünürlüğü yetkisine bağlıdır. Excel ve PDF raporları dönem değerlendirmesini paylaşılabilir hale getirir.' },
    ],
    steps: ['İş kalemi fiyatlarını, ekip paylarını ve dönem başlangıcını hazırlayın.', 'Saha işlerini kaydedip yönetici onayını tamamlayın.', 'İlgili dönemin şirket ve ekip toplamlarını raporlardan inceleyin.'],
    audience: 'Şirket ve proje yöneticileri dönemleri yönetir. Ekip liderleri yetkileri dahilindeki ekip sonuçlarını görür. Kullanıcı ve ekip kapasitesi şirket planına bağlıdır.',
    faq: [{ question: 'MK OPS maaş bordrosu veya ödeme işlemi yapar mı?', answer: 'Buradaki hakediş iş üretimi ve ekip payı hesabıdır. Maaş bordrosu, banka ödemesi veya muhasebe entegrasyonu olarak sunulmaz.' }, { question: 'Taslak işler toplam değere dahil midir?', answer: 'Hakediş ve onaylı iş toplamları onaylanmış kayıtları esas alır. Taslak ve bekleyen işler ayrı değerlendirilir.' }],
    related: ['operasyon-raporlama', 'gunluk-is-takibi', 'saha-onay-surecleri'],
  },
  {
    slug: 'irsaliye-malzeme-takibi', title: 'İrsaliye ve Saha Malzeme Takibi',
    description: 'Malzeme kabulünden ekip zimmetine ve saha kullanımına uzanan akışı izleyin. MK OPS ile irsaliye, stok, iade ve ekipler arası transferi inceleyin.',
    intro: 'MK OPS, teslim alınan malzemeyi irsaliye kaydıyla stoğa bağlar; merkezdeki miktarı ve ekiplere dağıtılan zimmeti ayrı takip eder. İş onayı sırasında kullanılan zimmet miktarı da bu akışa dahil olur.',
    problem: 'Depoya gelen malzeme ile ekibe verilen malzeme aynı listede tutulduğunda gerçekte merkezde ne kaldığını görmek zorlaşır. Ekipler arası aktarım ve sahadaki tüketim de kaydedilmezse miktar farklarının nedenini açıklamak güçleşir.',
    sections: [
      { title: 'Teslim almayı belge bilgisiyle kaydedin', text: 'İrsaliye ekranında tedarikçi, teslim tarihi, irsaliye numarası ve malzeme satırları girilir. Teslim alma işlemi stok kalemini bulur veya oluşturur ve miktarı ekler. Teslim alınmış irsaliye sonradan satır düzenleme akışı sunmaz; bu nedenle kabul öncesi satırlar kontrol edilmelidir.' },
      { title: 'Merkez stok ve ekip zimmetini ayırın', text: 'Ekibe dağıtılan miktar merkez stoktan düşülerek ekip zimmetine eklenir. Malzeme merkeze iade edilebilir veya bir ekipten diğerine aktarılabilir. Dağıtım ve iade işlemlerinde mevcut miktar sınırı kontrol edilir.' },
      { title: 'Kabloyu ve saha tüketimini izleyin', text: 'Kablo türleri için makara ve metre bilgileri kullanılabilir. İş kaydında zimmetten kullanılan malzeme ile harici malzeme ayrılır. Zimmetten tüketim iş onayına bağlanır. Stok ekleme, dağıtım, iade ve transfer gibi hareketler için denetim kayıtları oluşturulur.' },
    ],
    steps: ['Teslim alınan malzemeyi irsaliye satırlarıyla stoğa ekleyin.', 'İhtiyaç duyulan miktarı ilgili ekibe zimmetleyin.', 'İşte kullanılan miktarı kaydedin; kullanılmayan miktarı iade veya transferle yönetin.'],
    audience: 'Stok ve irsaliye işlemlerini şirket ve proje yöneticileri yürütür. Ekip lideri günlük işinde kendi ekibinin malzeme kullanımını belirtir.',
    faq: [{ question: 'Bu bir e-İrsaliye entegrasyonu mu?', answer: 'Hayır. MK OPS içindeki teslim alma ve stok kayıt akışıdır; GİB veya özel entegratör bağlantısı sunulduğu iddia edilmez.' }, { question: 'Malzeme kaydı iş taslağında tüketilir mi?', answer: 'Ekip zimmetinden iş tüketimi onay aşamasında kontrol edilip düşülür. Ekibe ilk dağıtım ise merkez stok ile zimmet arasında ayrı bir harekettir.' }],
    related: ['telekom-saha-takibi', 'saha-onay-surecleri', 'denetim-gunlugu'],
  },
  {
    slug: 'operasyon-raporlama', title: 'Saha Operasyon ve Hakediş Raporlama',
    description: 'Onaylı saha işlerini dönem ve ekip bazında değerlendirin. MK OPS şirket ve ekip raporlarını Excel ve PDF olarak dışa aktarın.',
    intro: 'MK OPS raporları, onaylı saha işlerini dönem ve ekip bazında bir araya getirir. Toplam iş değeri, şirket payı ve ekip kazancı aynı kayıtlar üzerinden değerlendirilir; sonuçlar Excel veya PDF olarak dışa aktarılabilir.',
    problem: 'Bir yönetici şirketin dönem toplamını görmek isterken ekip lideri kendi ekibinin sonucunu arar. Tek bir dosyanın herkese gönderilmesi hem gereksiz bilgi paylaşımına hem de farklı kapsamların birbirine karışmasına neden olabilir.',
    sections: [
      { title: 'Şirket raporunda kapsamı seçin', text: 'Şirket ve proje yöneticileri dönem raporunda bütün ekipleri veya seçili ekipleri değerlendirebilir. Şirket raporu dışa aktarımında tam dağılım ya da yalnız şirket payı görünümü seçilebilir. Raporun amacı kullanılan dönem ve ekip kapsamıyla birlikte belirginleşir.' },
      { title: 'Ekip sonuçlarına odaklanın', text: 'Ekip raporları ilgili ekibin dönem içindeki onaylı işlerini ve hesaplanan paylarını temel alır. Ekip liderinin rapor erişimi ekip kapsamıyla sınırlandırılır; fiyat görünürlüğü ayrıca dikkate alınır. Böylece aynı üretim kaydı farklı yetkilerde uygun kapsamla değerlendirilir.' },
      { title: 'Günlük görünümden dönem değerlendirmesine geçin', text: 'Dashboard gün, hafta ve dönem toplamlarını izlemeye yardımcı olur. Ayrıntılı dönem değerlendirmesi rapor ekranında yapılır. Excel ve PDF çıktıları mevcut kayıtları dışa taşır; dışa aktarma işlemleri için denetim olayı da oluşturulur.' },
    ],
    steps: ['Değerlendirilecek hakediş dönemini seçin.', 'Şirket veya ekip raporunu ve gerekiyorsa ekip filtresini belirleyin.', 'Sonuçları inceleyip Excel ya da PDF çıktısını alın.'],
    audience: 'Şirket yöneticisi ve proje yöneticisi şirket kapsamını değerlendirir; ekip lideri kendi kapsamındaki ekip raporlarını kullanır.',
    faq: [{ question: 'Hangi dosya biçimleri desteklenir?', answer: 'Hakediş raporları Excel ve PDF biçiminde dışa aktarılabilir.' }, { question: 'Raporlar bekleyen işleri de kazanç olarak sayar mı?', answer: 'Hakediş raporunun hesaplama temeli onaylanmış işlerdir. Bekleyen onaylar operasyon takibinde ayrı bir durumdur.' }],
    related: ['hakedis-takibi', 'denetim-gunlugu', 'gunluk-is-takibi'],
  },
  {
    slug: 'denetim-gunlugu', title: 'Saha Operasyonları Denetim Günlüğü',
    description: 'İş kayıtları, onaylar ve malzeme hareketleriyle ilgili işlem geçmişini inceleyin. MK OPS denetim günlüğünün kapsamını ve kullanımını keşfedin.',
    intro: 'MK OPS denetim günlüğü, desteklenen operasyon işlemlerinin ne zaman ve hangi kullanıcı tarafından yapıldığını incelemeye yarar. İş kaydı, onay ve malzeme hareketleri gibi olaylar ilgili kayıt bağlamıyla tutulur.',
    problem: 'Bir işin onay durumu veya ekibin malzeme miktarı değiştiğinde yalnız son değer yeterli olmayabilir. İşlemi yapan kişiyi, zamanı ve ilgili kaydı birlikte görmek operasyonel soruların geçmiş kayıtlar üzerinden değerlendirilmesini sağlar.',
    sections: [
      { title: 'İşlem, aktör ve zamanı birlikte görün', text: 'Denetim ekranında tarih, işlemi yapan kullanıcı, rol, işlem türü ve ilgili nesne bilgileri gösterilir. Kayıtlar en yeni olaydan başlayarak sayfalanır. Ayrıntı alanı, olayın içerdiği ek bağlamı incelemeye yardımcı olur.' },
      { title: 'Günlük iş ve malzeme akışını ilişkilendirin', text: 'İş oluşturma, güncelleme, gönderme, onaylama ve reddetme olayları kaydedilen işlemler arasındadır. Malzeme dağıtımı, merkeze iade ve ekipler arası transfer de olay üretir. İlgili ekip veya proje bilgisi olayın hangi operasyonla bağlantılı olduğunu açıklamaya yardımcı olur.' },
      { title: 'Yönetim incelemesini destekleyin', text: 'Denetim günlüğü ekranı şirket yöneticisine açıktır. Rapor dışa aktarma gibi desteklenen diğer işlemler de olay kaydı üretir. Günlük, operasyon geçmişi için yardımcı bir kaynaktır; bütün sistem olaylarının eksiksiz veya değiştirilemez arşivi olarak değerlendirilmemelidir.' },
    ],
    steps: ['Şirket yöneticisi denetim günlüğünü açar.', 'Olayın tarihini, aktörünü ve işlem türünü inceler.', 'Gerektiğinde ayrıntıyı açarak ilgili iş, ekip veya dönem bağlamını değerlendirir.'],
    audience: 'Şirket içindeki operasyon geçmişini inceleyen şirket yöneticisi kullanır. Herkese açık ürün sayfaları gerçek denetim kayıtlarını veya kullanıcı bilgilerini göstermez.',
    faq: [{ question: 'Denetim günlüğünü ekip lideri açabilir mi?', answer: 'Mevcut Denetim Günlüğü ekranı şirket yöneticisi rolüyle sınırlandırılmıştır.' }, { question: 'Bu kayıtlar yasal uyumluluk sertifikası sağlar mı?', answer: 'Hayır. Özellik operasyonel işlem geçmişi sunar; sertifika, hukuki delil garantisi veya değiştirilemez arşiv taahhüdü içermez.' }],
    related: ['saha-onay-surecleri', 'irsaliye-malzeme-takibi', 'operasyon-raporlama'],
  },
];
export const solutionPath = (slug: string) => `/cozumler/${slug}`;
export const homeMeta = { title: 'Saha Operasyon Yönetim Sistemi | MK OPS', description: 'MK OPS ile telekom ve fiber saha işlerini, ekipleri, onayları, malzeme hareketlerini ve hakediş dönemlerini tek sistemde takip edin.' };
export const supportingPages = [
  { path: '/kullanim-kilavuzu', title: 'Kullanım Kılavuzu | MK OPS', description: 'MK OPS giriş, roller, günlük saha işleri ve operasyon yönetimi kullanım kılavuzu.' },
  { path: '/gizlilik-politikasi', title: 'Gizlilik Politikası | MK OPS', description: 'MK OPS gizlilik politikası ve kişisel verilerin işlenmesine ilişkin bilgiler.' },
  { path: '/kullanim-sartlari', title: 'Kullanım Şartları | MK OPS', description: 'MK OPS hizmetinin kullanımına ilişkin şartlar ve kullanıcı sorumlulukları.' },
  { path: '/geri-odeme-politikasi', title: 'Geri Ödeme Politikası | MK OPS', description: 'MK OPS abonelik, iptal ve geri ödeme koşulları hakkında bilgi.' },
];
export function pageMeta(path: string) {
  if (path === '/' || path === '/pricing') return { ...homeMeta, path: '/', index: true };
  const solution = solutions.find(s => solutionPath(s.slug) === path);
  if (solution) return { title: `${solution.title} | MK OPS`, description: solution.description, path, index: true };
  const support = supportingPages.find(p => p.path === path);
  if (support) return { ...support, index: true };
  return { title: 'MK OPS', description: 'MK OPS kullanıcı uygulaması.', path, index: false };
}
export function structuredData(path: string) {
  if (path === '/') return [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: 'MK OPS', url: SITE_URL, inLanguage: 'tr' },
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'MK OPS', url: SITE_URL, applicationCategory: 'BusinessApplication', operatingSystem: 'Web', description: homeMeta.description },
  ];
  const s = solutions.find(s => solutionPath(s.slug) === path);
  return s ? [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'MK OPS', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: s.title, item: SITE_URL + path },
  ] }] : [];
}
