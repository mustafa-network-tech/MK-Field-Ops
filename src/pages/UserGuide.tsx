import { useState, useMemo } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { PublicPageHeader } from '../components/PublicPageHeader';
import styles from './UserGuide.module.css';

const SECTION_TITLE_KEYS = ['userGuide.s1Title', 'userGuide.s2Title', 'userGuide.s3Title', 'userGuide.s4Title', 'userGuide.s5Title'] as const;
const SECTION_SEARCH_KEYS = ['userGuide.s1Search', 'userGuide.s2Search', 'userGuide.s3Search', 'userGuide.s4Search', 'userGuide.s5Search'] as const;

const sectionsData: Array<{ id: string; content: React.ReactNode }> = [
  {
    id: 'giris-ve-uyelik',
    content: (
      <>
        <p className={styles.sectionIntro}>
          Bu bölüm, MKfieldOPS uygulamasına giriş yapma ve yeni kullanıcı kaydı oluşturma süreçlerini ve bu süreçlerde geçerli olan tüm kuralları açıklamaktadır.
        </p>

        <h3 className={styles.h3}>Giriş Yapma (Login)</h3>
        <p>Kullanıcılar sisteme giriş yapmak için e-posta adresi ve şifre bilgilerini kullanırlar.</p>

        <h4 className={styles.h4}>Giriş Formu Alanları</h4>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Alan</th><th>Zorunluluk</th><th>Açıklama</th></tr>
            </thead>
            <tbody>
              <tr><td>E-posta</td><td>Zorunlu</td><td>Geçerli bir e-posta formatında olmalıdır.</td></tr>
              <tr><td>Şifre</td><td>Zorunlu</td><td>Boş bırakılamaz.</td></tr>
            </tbody>
          </table>
        </div>

        <h4 className={styles.h4}>Giriş Kuralları</h4>
        <p>Giriş işlemi sırasında aşağıdaki kontroller yapılır:</p>
        <ul className={styles.list}>
          <li>Girilen e-posta ve şifre doğrulanır.</li>
          <li>Bilgiler eşleşmezse kullanıcıya şu hata gösterilir: <strong>Geçersiz e-posta veya şifre.</strong></li>
          <li>Kullanıcının rol onayı yapılmış olmalıdır. Onaylanmamış kullanıcılar giriş yapamaz.</li>
          <li>Bu durumda kullanıcıya şu mesaj gösterilir: <strong>Hesabınız oluşturuldu ancak henüz onaylanmadı. Şirket yöneticisi sizi onaylayana kadar giriş yapamazsınız.</strong></li>
        </ul>

        <h4 className={styles.h4}>Giriş Sonrası Yönlendirme</h4>
        <p>Giriş başarılı olduğunda sistem kullanıcıyı şu şekilde yönlendirir:</p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Kullanıcı durumu</th><th>Yönlendirme</th></tr>
            </thead>
            <tbody>
              <tr><td>Şirkete bağlı kullanıcı</td><td>Ana sayfa</td></tr>
              <tr><td>Şirket katılımı bekleyen kullanıcı</td><td>Katılım bekleme sayfası</td></tr>
            </tbody>
          </table>
        </div>

        <h4 className={styles.h4}>Şifremi Unuttum</h4>
        <p>Şifresini unutan kullanıcılar <strong>Şifremi Unuttum</strong> sayfasını kullanabilir.</p>
        <ul className={styles.list}>
          <li>Sistem kullanıcının e-posta adresine şifre sıfırlama bağlantısı gönderir.</li>
          <li>Eğer şifre sıfırlama sistemi aktif değilse kullanıcıya şu mesaj gösterilir: <strong>Şifre sıfırlama bu ortamda etkin değil.</strong></li>
        </ul>

        <h3 className={styles.h3}>Üyelik Oluşturma (Register)</h3>
        <p>MKfieldOPS'ta kullanıcı kaydı iki aşamada tamamlanır.</p>
        <ul className={styles.list}>
          <li><strong>Aşama 1:</strong> Kullanıcı bilgileri girilir.</li>
          <li><strong>Aşama 2:</strong> Kullanıcı <strong>yeni bir şirket oluşturur</strong> veya <strong>mevcut bir şirkete katılır.</strong></li>
        </ul>

        <h3 className={styles.h3}>Kayıt Adımı 1 – Kullanıcı Bilgileri</h3>
        <p>Bu aşamada kullanıcının temel bilgileri alınır.</p>
        <h4 className={styles.h4}>Form Alanları</h4>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Alan</th><th>Zorunluluk</th><th>Açıklama</th></tr>
            </thead>
            <tbody>
              <tr><td>Ad</td><td>Zorunlu</td><td>Boş bırakılamaz.</td></tr>
              <tr><td>Soyad</td><td>Zorunlu</td><td>Boş bırakılamaz.</td></tr>
              <tr><td>E-posta</td><td>Zorunlu</td><td>Geçerli e-posta formatında olmalıdır.</td></tr>
              <tr><td>Şifre</td><td>Zorunlu</td><td>Boş bırakılamaz.</td></tr>
            </tbody>
          </table>
        </div>
        <h4 className={styles.h4}>Kurallar</h4>
        <ul className={styles.list}>
          <li>Ad ve soyad alanları boş bırakılamaz.</li>
          <li>E-posta adresi geçerli formatta olmalıdır.</li>
          <li>Şifre alanı boş olamaz.</li>
          <li>Bu aşamada bilgiler henüz veritabanına kaydedilmez; bilgiler bir sonraki adım olan <strong>Workspace (Şirket Ayarı)</strong> ekranına aktarılır.</li>
        </ul>

        <h3 className={styles.h3}>Yeni Şirket Oluşturma</h3>
        <p>Kullanıcı yeni bir şirket oluşturmak isterse aşağıdaki bilgiler girilir.</p>
        <h4 className={styles.h4}>Form Alanları</h4>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Alan</th><th>Zorunluluk</th><th>Açıklama</th></tr>
            </thead>
            <tbody>
              <tr><td>Şirket Adı</td><td>Zorunlu</td><td>Boş bırakılamaz.</td></tr>
              <tr><td>Katılım Kodu</td><td>Zorunlu</td><td>4 rakamdan oluşmalıdır.</td></tr>
              <tr><td>Plan</td><td>Zorunlu</td><td>Starter / Professional / Enterprise.</td></tr>
              <tr><td>Fatura Dönemi</td><td>Opsiyonel</td><td>Aylık veya Yıllık.</td></tr>
            </tbody>
          </table>
        </div>
        <h4 className={styles.h4}>Katılım Kodu Kuralı</h4>
        <ul className={styles.list}>
          <li>Katılım kodu <strong>tam 4 rakam</strong> olmalıdır ve sadece sayısal değer içerir (örnek: 1234).</li>
          <li>Hatalı kod girilirse kullanıcıya şu mesaj gösterilir: <strong>Katılım kodu tam 4 rakam olmalıdır.</strong></li>
        </ul>
        <h4 className={styles.h4}>Şirket Adı Kuralları</h4>
        <ul className={styles.list}>
          <li>Aynı isimde ikinci bir şirket oluşturulamaz. Sistem şirket isimlerini normalize ederek kontrol eder.</li>
          <li>Bu durumda kullanıcıya şu mesaj gösterilir: <strong>Bu şirket adı zaten kullanılıyor.</strong></li>
        </ul>
        <h4 className={styles.h4}>Başarılı Şirket Oluşturma</h4>
        <p>Şirket başarıyla oluşturulduğunda:</p>
        <ul className={styles.list}>
          <li>Kullanıcı <strong>Company Manager</strong> olarak atanır ve rolü <strong>onaylı</strong> olarak belirlenir.</li>
          <li>Seçilen plana göre sistem hazırlanır.</li>
          <li><strong>Starter plan</strong> seçildiğinde <strong>varsayılan bir kampanya</strong> ve <strong>varsayılan bir proje</strong> otomatik oluşturulur.</li>
          <li>Ardından kullanıcı <strong>Plan ve Ödeme</strong> sayfasına yönlendirilir.</li>
        </ul>

        <h3 className={styles.h3}>Mevcut Şirkete Katılma</h3>
        <p>Kullanıcı mevcut bir şirkete katılmak isterse aşağıdaki bilgileri girmelidir.</p>
        <h4 className={styles.h4}>Form Alanları</h4>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Alan</th><th>Zorunluluk</th><th>Açıklama</th></tr>
            </thead>
            <tbody>
              <tr><td>Şirket Adı</td><td>Zorunlu</td><td>Boş bırakılamaz.</td></tr>
              <tr><td>Katılım Kodu</td><td>Zorunlu</td><td>4 rakam.</td></tr>
            </tbody>
          </table>
        </div>
        <h4 className={styles.h4}>Kurallar</h4>
        <ul className={styles.list}>
          <li>Girilen şirket adı ve katılım kodu eşleşmelidir.</li>
          <li>Sistem eşleşme bulamazsa kullanıcıya şu mesaj gösterilir: <strong>Bu şirket bulunamadı.</strong></li>
        </ul>
        <h4 className={styles.h4}>Kullanıcı Limiti Kontrolü</h4>
        <ul className={styles.list}>
          <li>Şirket planına göre kullanıcı sayısı sınırlıdır.</li>
          <li>Limit doluysa kullanıcıya şu mesaj gösterilir: <strong>Kullanıcı limiti doldu. Plan yükseltmek için şirket yöneticinizle iletişime geçin.</strong></li>
        </ul>
        <h4 className={styles.h4}>Katılım Sonrası Süreç</h4>
        <ul className={styles.list}>
          <li>Mevcut şirkete katılan kullanıcılar <strong>onay bekleyen</strong> kullanıcı olarak oluşturulur; şirket yöneticisi onay verene kadar giriş yapamaz.</li>
          <li>Kullanıcıya şu mesaj gösterilir: <strong>Hesabınız oluşturuldu. Şirket yöneticisi sizi onaylayana kadar giriş yapamazsınız.</strong></li>
          <li>Daha sonra kullanıcı giriş sayfasına yönlendirilir.</li>
        </ul>

        <h3 className={styles.h3}>Sistem Kurallarının Özeti</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Konu</th><th>Kural</th></tr>
            </thead>
            <tbody>
              <tr><td>Giriş</td><td>Onaylı kullanıcılar giriş yapabilir.</td></tr>
              <tr><td>E-posta</td><td>Her kullanıcı için benzersiz olmalıdır.</td></tr>
              <tr><td>Şirket adı</td><td>Aynı isimde ikinci şirket oluşturulamaz.</td></tr>
              <tr><td>Katılım kodu</td><td>4 rakam olmalıdır.</td></tr>
              <tr><td>Yeni şirket</td><td>Kullanıcı Company Manager olur.</td></tr>
              <tr><td>Mevcut şirkete katılım</td><td>Yönetici onayı gerekir.</td></tr>
              <tr><td>Kullanıcı limiti</td><td>Plan limitine göre kontrol edilir.</td></tr>
            </tbody>
          </table>
        </div>

        <h3 className={styles.h3}>Teknik Notlar</h3>
        <ul className={styles.list}>
          <li>Katılım kodu her zaman 4 haneli sayıdır.</li>
          <li>Şirket isimleri karşılaştırılırken Türkçe karakterler normalize edilir.</li>
          <li>Bir şirkette sadece bir Company Manager olabilir.</li>
          <li>Starter plan oluşturulduğunda sistem otomatik olarak bir kampanya ve bir proje oluşturur.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'roller-ve-yetkiler',
    content: (
      <>
        <p className={styles.sectionIntro}>
          MKfieldOPS uygulamasında kullanıcıların sistem içerisindeki yetkileri roller aracılığıyla belirlenir. Her rolün erişebileceği veriler ve yapabileceği işlemler farklıdır.
        </p>

        <h3 className={styles.h3}>Sistem Rol Yapısı</h3>
        <p>Sistemde üç temel kullanıcı rolü bulunmaktadır:</p>
        <ul className={styles.list}>
          <li>Şirket Yöneticisi (Company Manager – CM)</li>
          <li>Proje Yöneticisi (Project Manager – PM)</li>
          <li>Ekip Lideri (Team Leader – TL)</li>
        </ul>
        <p>Her kullanıcı yalnızca bir rol ile çalışır.</p>
        <h4 className={styles.h4}>Rol ataması</h4>
        <ul className={styles.list}>
          <li>Kullanıcı sisteme kayıt olduktan sonra yapılır.</li>
          <li>Onay bekleyen kullanıcıların henüz rolü yoktur.</li>
          <li>Roller veritabanında <span className={styles.inlineCode}>profiles</span> tablosunda tutulur.</li>
        </ul>

        <h3 className={styles.h3}>Şirket Yöneticisi (Company Manager)</h3>
        <p>Şirket yöneticisi sistemde en yüksek yetkiye sahip kullanıcıdır.</p>
        <h4 className={styles.h4}>Yetkiler</h4>
        <p>Şirket yöneticisi aşağıdaki işlemleri gerçekleştirebilir:</p>
        <ul className={styles.list}>
          <li>Şirkete ait tüm verileri görüntüleme</li>
          <li>Veri oluşturma</li>
          <li>Veri güncelleme</li>
          <li>Veri silme</li>
          <li>İş onaylarını gerçekleştirme</li>
        </ul>
        <h4 className={styles.h4}>Yönetebildiği Alanlar</h4>
        <p>Şirket yöneticisi aşağıdaki sistem ayarlarını değiştirebilir:</p>
        <ul className={styles.list}>
          <li>Şirket adı</li>
          <li>Sistem dili</li>
          <li>Şirket logosu</li>
          <li>Katılım kodu</li>
          <li>Plan ve ödeme ayarları</li>
        </ul>
        <h4 className={styles.h4}>Erişim Yetkileri</h4>
        <p>Şirket yöneticisi aşağıdaki sayfalara erişebilir:</p>
        <ul className={styles.list}>
          <li>Plan ve Ödeme sayfası</li>
          <li>Denetim kayıtları (Audit Log)</li>
          <li>Ayarlar sayfası</li>
          <li>Kullanıcı yönetimi</li>
          <li>Katılım talepleri</li>
        </ul>
        <h4 className={styles.h4}>Kullanıcı Yönetimi</h4>
        <p>Şirket yöneticisi:</p>
        <ul className={styles.list}>
          <li>Bekleyen kullanıcıları görür</li>
          <li>Kullanıcılara rol atar</li>
          <li>Kullanıcıyı onaylar veya reddeder</li>
        </ul>
        <p>Bir şirkette yalnızca bir adet Company Manager bulunabilir.</p>
        <p><strong>Önemli kural:</strong> Company Manager ekip lideri olarak atanamaz.</p>

        <h3 className={styles.h3}>Proje Yöneticisi (Project Manager)</h3>
        <p>Proje yöneticisi iş süreçlerini yönetmekten sorumludur. İş verisi açısından Company Manager ile aynı yetkilere sahiptir.</p>
        <h4 className={styles.h4}>Yönetebildiği Alanlar</h4>
        <p>Proje yöneticisi aşağıdaki verileri yönetebilir:</p>
        <ul className={styles.list}>
          <li>Kampanyalar</li>
          <li>Projeler</li>
          <li>Ekipler</li>
          <li>İş kayıtları</li>
          <li>Malzemeler</li>
          <li>Araçlar</li>
          <li>Ekipmanlar</li>
          <li>Teslimat irsaliyeleri</li>
        </ul>
        <h4 className={styles.h4}>İş Onayları</h4>
        <p>Gönderilen işlerin onaylanması ve reddedilmesi hem CM hem PM tarafından yapılabilir.</p>
        <h4 className={styles.h4}>Kullanıcı Yönetimi</h4>
        <p>Proje yöneticisi bekleyen kullanıcılara rol atayabilir ve kullanıcıları onaylayabilir. Ancak katılım kodu ile gelen yeni kullanıcı taleplerini sadece CM görür.</p>
        <h4 className={styles.h4}>Fiyat Görünürlüğü Yetkisi</h4>
        <p>Proje yöneticisi ekip liderlerine fiyat görünürlüğü verebilir veya kaldırabilir.</p>
        <h4 className={styles.h4}>Erişim Yetkileri</h4>
        <p>Proje yöneticisi Ayarlar, Bordro dönemleri ve Yönetim paneli sayfalarına erişebilir. Ancak Plan sayfası ve Denetim kayıtlarına erişemez.</p>
        <p><strong>Ekip Liderliği:</strong> Proje yöneticisi gerektiğinde ekip lideri olarak atanabilir.</p>

        <h3 className={styles.h3}>Ekip Lideri (Team Leader)</h3>
        <p>Ekip lideri yalnızca kendi ekibi ile ilgili işlemleri yönetir.</p>
        <h4 className={styles.h4}>Görülebilen Veriler</h4>
        <p>Ekip lideri yalnızca kendi ekibi, kendi ekibine ait işler ve kendi ekibine ait görevlere erişebilir. Erişim kuralı: <span className={styles.inlineCode}>leader_id = kullanıcı kimliği</span>. Başka ekiplerin verilerine erişemez.</p>
        <h4 className={styles.h4}>İş Yönetimi</h4>
        <p>Ekip lideri iş oluşturabilir, güncelleyebilir ve görüntüleyebilir; ancak yalnızca kendi ekibine ait işler için.</p>
        <h4 className={styles.h4}>Fiyat Görünürlüğü</h4>
        <p>Varsayılan olarak ekip lideri birim fiyat, toplam iş değeri ve kazanç bilgisini göremez. Bu alanlar ekranda <span className={styles.inlineCode}>----</span> olarak gösterilir.</p>
        <p>CM veya PM ekip liderine fiyat görünürlüğü verirse: Ekip lideri sadece kendi ekibine ait kazanç bilgisini görebilir. Şirket payı veya toplam iş değeri ekip liderine hiçbir zaman gösterilmez.</p>
        <h4 className={styles.h4}>Erişemediği Sayfalar</h4>
        <p>Ekip lideri Ayarlar, Bordro dönemleri, Denetim kayıtları ve Plan sayfasına erişemez.</p>
        <p>Denetim kayıtlarında ekip lideri sadece kendi yaptığı işlemleri görebilir.</p>

        <h3 className={styles.h3}>Veritabanı Erişim Kuralları</h3>
        <p>Sistemde tüm veriler şirket bazlı erişim ile korunur.</p>
        <p><strong>Temel kural:</strong> Kullanıcı sadece kendi şirketine ait verileri görebilir. Şirket kontrolü <span className={styles.inlineCode}>company_id</span> alanı ile yapılır.</p>
        <h4 className={styles.h4}>Tam Erişim (CM ve PM)</h4>
        <p>Aşağıdaki tablolar için CM ve PM tam erişime sahiptir: kampanyalar, araçlar, ekipmanlar, iş kalemleri, malzemeler, projeler, malzeme stoku, teslimat irsaliyeleri, bordro dönemleri.</p>
        <h4 className={styles.h4}>Ekip Kısıtı</h4>
        <p>Ekip lideri yalnızca kendi ekiplerine erişebilir.</p>
        <h4 className={styles.h4}>İş Kısıtı</h4>
        <p>Ekip lideri yalnızca kendi ekiplerinin işlerini görebilir.</p>
        <h4 className={styles.h4}>Malzeme Tahsisi</h4>
        <p>CM ve PM tüm malzeme tahsislerini görür; TL yalnızca kendi ekiplerine ait tahsisleri görür.</p>
        <h4 className={styles.h4}>Profil Yönetimi</h4>
        <p>Kullanıcı kendi profilini düzenleyebilir. CM ve PM aynı şirketteki tüm profilleri düzenleyebilir.</p>
        <h4 className={styles.h4}>Denetim Kayıtları</h4>
        <p>CM ve PM tüm kayıtları görebilir; TL sadece kendi kayıtlarını görebilir. Denetim kayıtları değiştirilemez, silinemez; sadece yeni kayıt eklenebilir.</p>

        <h3 className={styles.h3}>Plan Limitleri</h3>
        <p>Her şirket bir abonelik planına bağlıdır.</p>
        <ul className={styles.list}>
          <li><strong>Starter Plan:</strong> En fazla 4 kullanıcı, 3 ekip. Projeler, malzemeler ve teslimat irsaliyeleri kapalı.</li>
          <li><strong>Professional Plan:</strong> En fazla 7 kullanıcı, 6 ekip. Tüm iş yönetimi özellikleri aktif.</li>
          <li><strong>Enterprise Plan:</strong> En fazla 15 kullanıcı, 14 ekip. Tüm özellikler aktif.</li>
        </ul>

        <h3 className={styles.h3}>Kullanıcı Onay Süreci</h3>
        <p>Yeni kullanıcılar sisteme kayıt olduklarında <span className={styles.inlineCode}>pending (beklemede)</span> durumunda oluşturulurlar. Bu kullanıcılar sisteme giriş yapamaz ve rol atanmaz.</p>
        <h4 className={styles.h4}>Onay Yetkisi</h4>
        <p>Bekleyen kullanıcıyı onaylayabilecek roller: Company Manager ve Project Manager. Katılım kodu ile gelen yeni kullanıcı taleplerini yalnızca Company Manager görür ve onaylar.</p>
        <h4 className={styles.h4}>Rol Atama Kuralları</h4>
        <ul className={styles.list}>
          <li>Şirkette henüz Company Manager yoksa atanabilir roller: Company Manager, Project Manager, Team Leader.</li>
          <li>Şirkette zaten Company Manager varsa atanabilecek roller: Project Manager, Team Leader.</li>
        </ul>

        <h3 className={styles.h3}>Fiyat Görünürlüğü (canSeePrices)</h3>
        <p>Bu özellik yalnızca Team Leader rolü için geçerlidir. Varsayılan durumda fiyat bilgileri gizlidir. CM veya PM bu yetkiyi açarsa ekip lideri yalnızca ekip kazancını görebilir; şirket payı veya toplam iş değeri gösterilmez.</p>

        <h3 className={styles.h3}>Arayüz Erişim Özeti</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Sayfa</th><th>CM</th><th>PM</th><th>TL</th></tr>
            </thead>
            <tbody>
              <tr><td>Dashboard</td><td>✓</td><td>✓</td><td>✓</td></tr>
              <tr><td>İş Girişi</td><td>✓</td><td>✓</td><td>✓</td></tr>
              <tr><td>İşlerim</td><td>✓</td><td>✓</td><td>✓</td></tr>
              <tr><td>Yönetim Paneli</td><td>✓</td><td>✓</td><td>✓</td></tr>
              <tr><td>Onaylar</td><td>✓</td><td>✓</td><td>✓</td></tr>
              <tr><td>Raporlar</td><td>✓</td><td>✓</td><td>✓</td></tr>
              <tr><td>Teslimat İrsaliyeleri</td><td>✓</td><td>✓</td><td>✗</td></tr>
              <tr><td>Ayarlar</td><td>✓</td><td>✓</td><td>✗</td></tr>
              <tr><td>Bordro Dönemleri</td><td>✓</td><td>✓</td><td>✗</td></tr>
              <tr><td>Denetim Kayıtları</td><td>✓</td><td>✗</td><td>✗</td></tr>
              <tr><td>Plan Sayfası</td><td>✓</td><td>✗</td><td>✗</td></tr>
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: 'is-akisi-ve-fiyatlandirma',
    content: (
      <>
        <p className={styles.sectionIntro}>
          Bu bölüm, MKfieldOPS sisteminde iş kayıtlarının oluşturulması, iş akışının ilerlemesi, fiyat hesaplama mantığı ve hakediş dönemleri hakkında bilgi verir.
        </p>

        <h3 className={styles.h3}>İş (Job) Kavramı ve İş Kaydı</h3>
        <p>MKfieldOPS'ta her kayıt tek bir işi temsil eder.</p>
        <p>Bir iş kaydı aşağıdaki bilgileri içerir:</p>
        <ul className={styles.list}>
          <li>İş tarihi</li>
          <li>Proje (Starter planında varsayılan proje kullanılır)</li>
          <li>Ekip</li>
          <li>İş kalemi (work item)</li>
          <li>Miktar</li>
          <li>Kullanılan malzemeler</li>
          <li>Kullanılan ekipmanlar</li>
          <li>Notlar</li>
        </ul>
        <p>İş kaydı oluşturulduğunda sistemi kullanan kişi <span className={styles.inlineCode}>createdBy</span> alanında saklanır.</p>
        <h4 className={styles.h4}>İş Girişi Yetkisi</h4>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Rol</th><th>Yetki</th></tr>
            </thead>
            <tbody>
              <tr><td>Şirket Yöneticisi (CM)</td><td>Tüm ekipler için iş girişi yapabilir</td></tr>
              <tr><td>Proje Yöneticisi (PM)</td><td>Tüm ekipler için iş girişi yapabilir</td></tr>
              <tr><td>Ekip Lideri (TL)</td><td>Sadece kendi ekipleri için iş girişi yapabilir</td></tr>
            </tbody>
          </table>
        </div>

        <h3 className={styles.h3}>İş Durumları ve İş Akışı</h3>
        <p>Sistemde her iş kaydı belirli durumlar arasında ilerler.</p>
        <h4 className={styles.h4}>İş Durumları</h4>
        <ul className={styles.list}>
          <li>Taslak (Draft)</li>
          <li>Gönderildi (Submitted)</li>
          <li>Onaylandı (Approved)</li>
          <li>Reddedildi (Rejected)</li>
        </ul>
        <h4 className={styles.h4}>İş Akışı</h4>
        <p>Yeni oluşturulan iş her zaman Taslak durumunda başlar.</p>
        <p>Taslak durumdaki iş: Kullanıcı tarafından <strong>Onaya Gönder</strong> butonu ile gönderilir. Bu işlem yalnızca işi oluşturan kullanıcı tarafından yapılabilir.</p>
        <p>Gönderilen işler Onaylar sayfasında listelenir.</p>
        <h4 className={styles.h4}>Onay Yetkisi</h4>
        <p>İşleri onaylama veya reddetme yetkisi Şirket Yöneticisi (CM) ve Proje Yöneticisi (PM) rollerine aittir.</p>
        <h4 className={styles.h4}>Onay Sonrası</h4>
        <p>Onaylanan işlerde: İş durumu Onaylandı olur; onaylayan kullanıcı kaydedilir; onay tarihi sisteme yazılır.</p>
        <h4 className={styles.h4}>Reddedilen İşler</h4>
        <p>Reddedilen işlerde: İş durumu Reddedildi olur; reddeden kullanıcı kaydedilir.</p>
        <p><strong>Önemli kural:</strong> Onaylanan veya reddedilen işler geri alınamaz. Ancak sistem şu denetim kayıtlarını tutar: <span className={styles.inlineCode}>JOB_SUBMITTED</span>, <span className={styles.inlineCode}>JOB_APPROVED</span>, <span className={styles.inlineCode}>JOB_REJECTED</span>, <span className={styles.inlineCode}>JOB_UPDATED</span>.</p>

        <h3 className={styles.h3}>İş Takibi</h3>
        <h4 className={styles.h4}>İşlerim Sayfası</h4>
        <p>Kullanıcılar İşlerim sayfasında yalnızca kendi oluşturdukları işleri görür. Liste en yeni iş kaydı üstte olacak şekilde sıralanır.</p>
        <p>Her iş satırında: İş tarihi, proje, ekip, iş kalemi, miktar, kullanılan malzemeler, iş durumu, toplam iş değeri, ekip kazancı (yetkiye bağlı olarak) yer alır. Taslak işler için Onaya Gönder butonu görünür.</p>
        <h4 className={styles.h4}>Onaylar Sayfası</h4>
        <p>Onaylar sayfasında gönderilmiş (submitted) işler listelenir. CM ve PM işleri onaylayabilir veya reddedebilir.</p>
        <h4 className={styles.h4}>Ekip ve Proje Detayları</h4>
        <p>Ekip veya proje detay sayfalarında ilgili işler listelenir. CM ve PM tüm işleri; TL sadece kendi ekiplerinin işlerini görür.</p>

        <h3 className={styles.h3}>Fiyatlandırma ve Hesaplama</h3>
        <p>Her iş kaydı bir iş kalemi üzerinden hesaplanır. Bir iş kalemi: Kod, birim tipi, birim fiyat (unitPrice), açıklama içerir.</p>
        <h4 className={styles.h4}>Toplam İş Değeri</h4>
        <p>Bir işin toplam değeri: <span className={styles.inlineCode}>Toplam İş Değeri = Miktar × Birim Fiyat</span>. Tüm para değerleri iki ondalık basamak ile hesaplanır.</p>
        <h4 className={styles.h4}>Ekip Kazancı</h4>
        <p>Her ekip için bir kazanç yüzdesi tanımlanır. Ekip kazancı: <span className={styles.inlineCode}>Ekip Kazancı = Toplam İş Değeri × (Ekip Yüzdesi / 100)</span>. Şirket payı: <span className={styles.inlineCode}>Şirket Payı = Toplam İş Değeri − Ekip Kazancı</span>.</p>
        <h4 className={styles.h4}>Fiyat Görünürlüğü</h4>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Rol</th><th>Görülen fiyat bilgileri</th></tr>
            </thead>
            <tbody>
              <tr><td>CM</td><td>Tüm fiyat bilgileri</td></tr>
              <tr><td>PM</td><td>Tüm fiyat bilgileri</td></tr>
              <tr><td>TL</td><td>Varsayılan olarak hiçbir fiyat bilgisi gösterilmez (----)</td></tr>
            </tbody>
          </table>
        </div>
        <p>CM veya PM isterse bir ekip liderine fiyat görünürlüğü verebilir. Bu durumda TL yalnızca kendi ekibinin kazancını görebilir. Toplam iş değeri ve şirket payı TL'ye hiçbir zaman gösterilmez.</p>

        <h3 className={styles.h3}>Onay Sonrası Malzeme Düşümü</h3>
        <p>Bir iş onaylandığında, kullanılan malzemeler otomatik olarak ekip zimmetinden düşülür.</p>
        <p>Kablo türü malzemelerde ölçüm metre; diğer malzemelerde adet kullanılır. Malzeme düşümü yalnızca bir kez yapılır; sistem <span className={styles.inlineCode}>stockDeducted</span> kontrolü kullanır.</p>
        <p>Eğer ekip zimmetinde yeterli malzeme yoksa iş onayı tamamlanmaz ve kullanıcıya hata mesajı gösterilir.</p>
        <p>Harici malzeme kullanımları stoktan ve zimmetten düşülmez.</p>

        <h3 className={styles.h3}>Hakediş (Bordro) Dönemi</h3>
        <p>Her şirket için bir hakediş dönemi tanımlanabilir. Örnek: dönem başlangıç günü <span className={styles.inlineCode}>20</span> ise dönem 20'si ile ertesi ayın 19'u arasında çalışır (örn. 20 Mart → 19 Nisan). Bu ayar Ayarlar sayfasında Şirket yöneticisi tarafından yapılır.</p>
        <h4 className={styles.h4}>Bordro Dönemi Ataması</h4>
        <p>Her iş kaydı bir iş tarihi içerir. Sistem iş kaydı oluşturulduğunda iş tarihine göre otomatik olarak ilgili bordro dönemini atar.</p>
        <h4 className={styles.h4}>Bordro Kilidi</h4>
        <p>Bir bordro dönemi kilitli ise yeni iş eklenemez ve mevcut iş güncellenemez. Kullanıcıya "Bu bordro dönemi kapatılmıştır." mesajı gösterilir. Sistemde aynı anda yalnızca bir aktif dönem bulunur.</p>

        <h3 className={styles.h3}>Dashboard Özeti</h3>
        <p>Dashboard&apos;da haftalık ve aylık (veya hakediş dönemi) özet kartları, bekleyen onaylar ve ekip kazanç özeti gösterilir. Ayarlarda hakediş başlangıç günü tanımlıysa, üstte <strong>Hakediş dönemi</strong> ve <strong>Genel dönem</strong> seçimi bulunur: Hakediş döneminde tüm bu göstergeler yalnızca aktif dönemdeki onaylı işlere göredir; dönem bittiğinde (ör. ayın 19&apos;u sonunda) panel otomatik olarak yeni döneme göre sıfırlanmış gibi görünür — eski işler veritabanında kalır. Genel dönemde üst toplamlar ve ekip özeti tüm onaylı işleri kapsar; haftalık/aylık kartlar ise içinde bulunulan takvim haftası ve ayına göre tüm geçmişten hesaplanır.</p>
        <p>CM ve PM toplam iş değeri, ekip toplamı ve şirket payını görür; TL sadece kendi ekiplerinin kazancını görür. Ekip bazlı özette CM/PM tüm ekiplerin toplam değerlerini, TL sadece kendi ekiplerini görür.</p>

        <h3 className={styles.h3}>Raporlar ve Bordro Sayfası</h3>
        <p>Raporlar sayfasına yalnızca Company Manager ve Project Manager erişebilir. Bordro dönemine göre rapor alınabilir; raporlara sadece onaylanan işler dahil edilir. Tamamlanma tarihi olarak onay tarihi veya iş tarihi kullanılır.</p>
        <p>Rapor içeriği: Tamamlanma tarihi, proje, ekip, iş kalemi, miktar, birim fiyat, satır toplamı. Raporlar Excel (xlsx) ve PDF formatında dışa aktarılabilir.</p>

        <h3 className={styles.h3}>İş Girişi Formu</h3>
        <p>İş girişi sayfasında kullanıcı tarih, kampanya, proje, ekip, iş kalemi, miktar, malzeme kullanımı, ekipmanlar ve not girer.</p>
        <p><strong>Kurallar:</strong> Miktar 0'dan büyük olmalıdır. Starter planda proje otomatik seçilebilir. Zimmet malzemeleri ekip zimmetinden seçilir. Kablo türlerinde miktar metre, diğerlerinde adet olarak girilir. Harici malzeme seçilirse açıklama zorunludur. Yeni oluşturulan iş taslak olarak kaydedilir; kullanıcı İşlerim sayfasından Onaya Gönder ile işi gönderebilir.</p>

        <h3 className={styles.h3}>İş Akışı ve Fiyatlandırma Özeti</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Konu</th><th>Açıklama</th></tr>
            </thead>
            <tbody>
              <tr><td>İş Durumu</td><td>Taslak → Gönderildi → Onaylandı / Reddedildi</td></tr>
              <tr><td>Onaya Gönderen</td><td>İşi oluşturan kullanıcı</td></tr>
              <tr><td>Onaylayan</td><td>CM veya PM</td></tr>
              <tr><td>Toplam İş Değeri</td><td>Miktar × Birim fiyat</td></tr>
              <tr><td>Ekip Kazancı</td><td>Toplam değer × ekip yüzdesi</td></tr>
              <tr><td>Fiyat Görünürlüğü</td><td>TL için varsayılan kapalı</td></tr>
              <tr><td>Onay Sonrası</td><td>Malzeme zimmetten düşülür</td></tr>
              <tr><td>Bordro Dönemi</td><td>İş tarihine göre atanır</td></tr>
              <tr><td>Raporlar</td><td>Sadece onaylanan işler</td></tr>
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: 'irsaliye-ve-malzeme-stoku',
    content: (
      <>
        <p className={styles.sectionIntro}>
          Bu bölüm, MKfieldOPS sisteminde irsaliye oluşturma, malzeme stok takibi, ekip zimmeti ve malzeme hareketleri ile ilgili işleyişi açıklar.
        </p>

        <h3 className={styles.h3}>Genel Yapı</h3>
        <p>MKfieldOPS'ta malzeme yönetimi, sahaya çıkan işlerin düzenli ve kontrol edilebilir şekilde yürütülmesi için kullanılır.</p>
        <p>Sistemde malzeme akışı şu şekilde ilerler:</p>
        <ul className={styles.list}>
          <li>Tedarikçiden malzeme teslim alınır</li>
          <li>Teslim alınan malzeme için irsaliye oluşturulur</li>
          <li>İrsaliye kaydedildiğinde malzeme stoklara eklenir</li>
          <li>Gerekirse stoktaki malzeme ekiplere zimmet olarak dağıtılır</li>
          <li>İş onaylandığında kullanılan malzemeler ekip zimmetinden düşülür</li>
        </ul>
        <p>Bu modül Starter planda kapalıdır; Professional ve Enterprise planlarında aktiftir. Erişim yetkisi yalnızca Şirket Yöneticisi ve Proje Yöneticisi rollerine aittir. Ekip Lideri bu alanlara erişemez.</p>

        <h3 className={styles.h3}>İrsaliye Nedir?</h3>
        <p>İrsaliye, tedarikçiden malzeme teslim alındığında oluşturulan kayıt belgesidir. Her irsaliye iki bölümden oluşur: başlık bilgileri ve malzeme satırları. İrsaliye sisteme kaydedildiğinde ilgili malzemeler stoklara eklenir veya mevcut stoklara işlenir.</p>
        <p><strong>Önemli kural:</strong> Teslim alınmış bir irsaliye sonradan değiştirilemez. Yani irsaliye kaydedildikten sonra düzenleme yapılamaz, satır eklenemez, satır silinemez.</p>

        <h3 className={styles.h3}>İrsaliye Oluşturma</h3>
        <p>Teslimat İrsaliyeleri sayfasında Yeni İrsaliye butonu ile irsaliye formu açılır.</p>
        <h4 className={styles.h4}>İrsaliye Başlık Bilgileri</h4>
        <p>İrsaliye oluşturulurken girilen bilgiler: İrsaliye numarası, tedarikçi, teslim alınan tarih, teslim alan kullanıcı. İrsaliye numarası ve teslim alınan tarih zorunludur. Tedarikçi bilgisi boş bırakılabilir.</p>
        <h4 className={styles.h4}>İrsaliye Satırları</h4>
        <p>Her irsaliyede bir veya daha fazla malzeme satırı bulunabilir. Her satırda: malzeme adı, malzeme cinsi, malzeme ebatı, malzeme kimliği (örn. makara veya seri numarası), birim, miktar yer alır.</p>
        <p>Bir malzeme satırının geçerli sayılabilmesi için: malzeme adı girilmiş olmalı, birim seçilmiş olmalı, miktar sıfırdan büyük olmalı. En az bir geçerli satır olmadan irsaliye teslim alınamaz.</p>

        <h3 className={styles.h3}>İrsaliye Teslim Alındığında Ne Olur?</h3>
        <p>İrsaliye "Teslim Al" ile kaydedildiğinde sistem stokları otomatik olarak günceller. Sistem, girilen malzemenin daha önce stokta bulunup bulunmadığını kontrol eder.</p>
        <p>Eğer aynı özelliklerde malzeme zaten varsa miktar mevcut stoğa eklenir. Eğer aynı özelliklerde malzeme yoksa yeni stok kaydı oluşturulur.</p>
        <p>Bu işlem malzemenin birimine göre değişir: metre ile tutulan malzemelerde uzunluk artar; adet, kilo veya metreküp ile tutulan malzemelerde stok miktarı artar. Malzeme kimliği bilgisi girilmişse bu bilgi kayıt altına alınır, ancak mevcut stok yapısını bölmez.</p>

        <h3 className={styles.h3}>İrsaliye Listesi ve Detayı</h3>
        <p>Teslimat İrsaliyeleri sayfasında oluşturulmuş tüm irsaliyeler listelenir. Listede: irsaliye numarası, tedarikçi, teslim tarihi, teslim alan kullanıcı gösterilir. Her irsaliyenin detay ekranında başlık bilgileri, malzeme satırları, miktarlar ve birimler salt okunur biçimde görüntülenir.</p>

        <h3 className={styles.h3}>Malzeme Stoku</h3>
        <p>Malzeme stoku, şirkete ait tüm kullanılabilir malzemelerin tutulduğu alandır. Her stok kaleminde: malzeme adı, türü, ebat/kapasite bilgisi, birimi, toplam stok miktarı, kalan miktar, varsa makara veya detay kimliği bulunabilir.</p>
        <p>Malzemeler adet, metre, kilo, metreküp birimleriyle tutulabilir. Bazı malzemeler metre ile, bazıları adet ile takip edilir.</p>

        <h3 className={styles.h3}>Stok Listesi</h3>
        <p>Yönetim panelindeki Malzemeler bölümünde tüm stok kalemleri listelenir. Listede: malzeme adı, malzeme türü, ebat bilgisi, mevcut stok miktarı, varsa makara veya detay bilgileri görülebilir. Stok listesinde arama yapılabilir; arama malzeme adı, malzeme türü, makara veya detay bilgisi, kapasite bilgisine göre çalışır.</p>

        <h3 className={styles.h3}>Ekip Zimmeti</h3>
        <p>Merkez stoktan ekiplerin kullanımına verilen malzemeler ekip zimmeti olarak tutulur. Bu yapı sayesinde hangi ekibe hangi malzemenin verildiği takip edilir. Bir ekip zimmeti ekip, malzeme ve miktar bilgilerini içerir. Malzeme ekip zimmeti olarak verildiğinde merkez stok azalır, ekibin zimmet listesi artar.</p>

        <h3 className={styles.h3}>Ekibe Malzeme Dağıtımı</h3>
        <p>Malzeme dağıtımı yalnızca Şirket Yöneticisi ve Proje Yöneticisi tarafından yapılabilir. Malzemeler sekmesindeki Ekibe Dağıt alanında ekip seçilir, malzeme seçilir, miktar girilir. Dağıtılacak miktar stokta mevcut miktardan fazla olamaz. Eğer ilgili ekipte aynı malzemeden daha önce zimmet varsa miktar mevcut zimmete eklenir; yoksa yeni bir zimmet kaydı oluşturulur.</p>

        <h3 className={styles.h3}>Stoka İade</h3>
        <p>Ekipte bulunan bir malzeme tekrar merkeze döndürülmek istenirse stoka iade işlemi yapılır. Bu işlem de yalnızca Şirket Yöneticisi ve Proje Yöneticisi tarafından yapılabilir. İade miktarı ekip zimmetindeki miktarı aşamaz. İade yapıldığında ekip zimmeti azalır, merkez stok artar. Eğer zimmette hiç miktar kalmazsa ilgili zimmet kaydı kapanır.</p>

        <h3 className={styles.h3}>Ekipler Arası Malzeme Transferi</h3>
        <p>Bir ekipteki malzeme başka bir ekibe aktarılabilir. Kaynak ekip, hedef ekip ve aktarılacak miktar belirlenir. Kurallar: aynı ekipten aynı ekibe transfer yapılamaz; aktarım miktarı mevcut zimmet miktarını aşamaz. Hedef ekipte aynı malzeme zaten varsa miktar eklenir; yoksa yeni zimmet kaydı açılır. Kaynak ekipteki zimmet azalır.</p>

        <h3 className={styles.h3}>Stok ve Zimmet Kuralları</h3>
        <p>Stok ekleme, düzenleme ve silme işlemlerini yalnızca CM ve PM yapabilir. Ekip Lideri stok üzerinde değişiklik yapamaz. Her malzeme hareketi sistem tarafından kayıt altına alınır; malzeme akışları geriye dönük takip edilebilir.</p>
        <p>Bazı malzeme türlerinde sistem farklı davranır: Kablo – her makara ayrı kayıt olarak tutulur. Boru – aynı özellikteki borular aynı stokta birleştirilebilir. Diğer malzemeler – aynı ad, tür ve kapasitedeki malzemeler aynı kalemde toplanabilir.</p>

        <h3 className={styles.h3}>Malzeme Hareketlerinin Takibi</h3>
        <p>Sistemde yapılan tüm malzeme hareketleri kayıt altına alınır: yeni stok ekleme, stok güncelleme, stok silme, ekibe dağıtım, stoka iade, ekipler arası transfer, stok düzeltme. Her hareket için işlemi yapan kullanıcı, işlem türü, ilgili malzeme, varsa ekip bilgileri, miktar, işlem zamanı ve not saklanır. Bu kayıtlar sayesinde malzeme hareketleri sonradan izlenebilir.</p>

        <h3 className={styles.h3}>Erişim Özeti</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Alan</th><th>Erişim</th></tr>
            </thead>
            <tbody>
              <tr><td>Teslimat İrsaliyeleri</td><td>Sadece CM ve PM</td></tr>
              <tr><td>Malzeme Stoku</td><td>Sadece CM ve PM</td></tr>
              <tr><td>Ekibe Malzeme Dağıtımı</td><td>Sadece CM ve PM</td></tr>
              <tr><td>Stoka İade</td><td>Sadece CM ve PM</td></tr>
              <tr><td>Ekipler Arası Transfer</td><td>Sadece CM ve PM</td></tr>
              <tr><td>Ekip Lideri</td><td>Bu alanlara erişemez</td></tr>
            </tbody>
          </table>
        </div>

        <h3 className={styles.h3}>Özet</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Konu</th><th>Açıklama</th></tr>
            </thead>
            <tbody>
              <tr><td>İrsaliye</td><td>Tedarikçiden malzeme teslim alındığında oluşturulur</td></tr>
              <tr><td>Stok güncelleme</td><td>İrsaliye teslim alınca otomatik yapılır</td></tr>
              <tr><td>Stok kaynağı</td><td>İrsaliye</td></tr>
              <tr><td>Ekibe dağıtım</td><td>Merkez stoktan ekibe zimmet verilir</td></tr>
              <tr><td>Stoka iade</td><td>Ekipten merkeze geri dönüş yapılır</td></tr>
              <tr><td>Transfer</td><td>Bir ekipten diğer ekibe malzeme aktarılır</td></tr>
              <tr><td>Erişim</td><td>Yalnızca CM ve PM</td></tr>
              <tr><td>Starter plan</td><td>Bu modül kapalıdır</td></tr>
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: 'denetim-fiyat-bildirim',
    content: (
      <>
        <h3 className={styles.h3}>Denetim Günlüğü (Audit Log)</h3>
        <h4 className={styles.h4}>Ne işe yarar?</h4>
        <p>Sistemdeki önemli işlemler "kim, ne zaman, ne yaptı" şeklinde kaydedilir. Kayıtlar sonradan değiştirilemez veya silinemez; yalnızca yeni kayıt eklenir.</p>
        <h4 className={styles.h4}>Kim erişir?</h4>
        <p><strong>Denetim Kayıtları sayfası</strong> (sol menüde "Denetim Kayıtları"): Sadece Şirket Yöneticisi açabilir. Proje Yöneticisi ve Ekip Lideri bu sayfayı göremez; erişmeye çalışırsa "yetkisiz" uyarısı görür.</p>
        <p>Veritabanı tarafında Şirket Yöneticisi ve Proje Yöneticisi şirketteki tüm denetim kayıtlarını görebilir; Ekip Lideri yalnızca kendi yaptığı işlemlere ait kayıtları görebilir. Uygulamada denetim sayfası sadece Şirket Yöneticisine açık olduğu için, pratikte bu kayıtları sayfadan yalnızca CM kullanır.</p>
        <h4 className={styles.h4}>Sayfada neler görünür?</h4>
        <p>Tarih, işlemi yapan kullanıcı (e-posta veya kullanıcı bilgisi), rol, işlem adı, ilgili varlık (örneğin iş, ekip), ekip kodu, dönem bilgisi. İsteğe bağlı olarak ek detay (meta) açılıp incelenebilir. Kayıtlar sayfalı listelenir; önceki / sonraki sayfa ile gezinilir.</p>
        <h4 className={styles.h4}>Hangi işlemler kaydedilir?</h4>
        <ul className={styles.list}>
          <li>İş oluşturma</li>
          <li>İş onaya gönderme, onaylama, reddetme, iş güncelleme</li>
          <li>Ekip oluşturma, ekip güncelleme, ekip onaylama, ekip reddetme</li>
          <li>Malzeme ekibe dağıtma, stoka iade, ekipler arası malzeme transferi</li>
          <li>Bordro ayarı değişikliği</li>
          <li>Şirket adı veya şirket logosu değişikliği</li>
          <li>Bordro raporu PDF dışa aktarma</li>
        </ul>
        <h4 className={styles.h4}>Malzeme hareketleri denetimi (Yönetim paneli)</h4>
        <p>Yönetim panelinde "Malzeme hareketleri" / "Denetim" sekmesi vardır. Burada stok ekleme, stok güncelleme, stok silme, ekibe dağıtım, stoka iade, ekipler arası transfer ve stok düzeltme türündeki malzeme hareketleri listelenir. Liste işlem türüne, ekibe ve tarih aralığına göre filtrelenebilir. Bu bölüme Şirket Yöneticisi ve Proje Yöneticisi erişir; Ekip Lideri yalnızca kendi ekiplerinin verisiyle sınırlı olabilir. Her satırda işlem tarihi, işlemi yapan kullanıcı, işlem türü, malzeme, kaynak/hedef ekip (varsa), miktar ve not bilgisi görünür.</p>

        <h3 className={styles.h3}>Fiyatlandırma Görünürlüğü</h3>
        <h4 className={styles.h4}>Genel kural</h4>
        <p>Birim fiyat, toplam iş değeri, ekip kazancı ve şirket payı alanları role göre gösterilir veya gizlenir.</p>
        <h4 className={styles.h4}>Şirket Yöneticisi ve Proje Yöneticisi</h4>
        <p>Tüm fiyat bilgilerini görür: iş kalemi birim fiyatı, toplam iş değeri, ekip kazancı, şirket payı. Bu bilgiler İş Girişi, İşlerim, Onaylar, Raporlar, Bordro ve Dashboard ekranlarında tam olarak listelenir.</p>
        <h4 className={styles.h4}>Ekip Lideri</h4>
        <p>Varsayılan olarak hiçbir fiyat alanı görünmez; bu alanlar tire veya benzeri bir işaretle gizlenir. Şirket Yöneticisi veya Proje Yöneticisi, Kullanıcılar yönetiminden bir Ekip Liderine "fiyat görünürlüğü" verirse, o Ekip Lideri yalnızca kendi ekibinin kazancını (ekip payı) görebilir. Toplam iş değeri ve şirket payı Ekip Liderine hiçbir zaman gösterilmez. Fiyat görünürlüğü kapatılırsa Ekip Lideri yine tüm fiyat alanlarında gizleme görür.</p>
        <h4 className={styles.h4}>Nerede kullanılır?</h4>
        <p>İş kalemi seçiminde (birim fiyat CM/PM'de görünür, TL'de gizli), İşlerim listesinde toplam iş değeri ve ekip kazancı sütunlarında, Dashboard'daki toplam ve ekip özetlerinde, ekip detay ve rapor ekranlarında. Hakediş ve bordro raporları yalnızca CM/PM tarafından kullanıldığı için orada fiyatlar tam görünür.</p>

        <h3 className={styles.h3}>Bildirimler</h3>
        <h4 className={styles.h4}>Bekleyen onay sayısı (Onaylar)</h4>
        <p>Sol menüde "Onaylar" bağlantısının yanında bekleyen onay sayısı gösterilir. Bu sayı:</p>
        <ul className={styles.list}>
          <li><strong>Şirket Yöneticisi</strong> için: Onay bekleyen iş sayısı + onay bekleyen kullanıcı (rol atanmamış) sayısı</li>
          <li><strong>Proje Yöneticisi</strong> için: Yalnızca onay bekleyen iş sayısı</li>
          <li><strong>Ekip Lideri</strong> için: Gösterilmez (onay yetkisi olmadığı için sayı 0 kabul edilir)</li>
        </ul>
        <p>Sayı sıfırdan büyükse sol menüde Onaylar satırında rozet (sayı) görünür ve satır hafifçe mavi tonlarda yanıp sener; üstten açılan yazı veya ses yoktur. Tıklanınca Onaylar sayfasına gidilir ve bekleyen işler veya kullanıcılar listelenir.</p>
        <h4 className={styles.h4}>Yönetim bildirimleri (Şirket Yöneticisi ve Proje Yöneticisi)</h4>
        <p>Üst çubukta ve sol menüde <strong>Yönetici paneli</strong> öğesinde, okunmamış bildirim sayısı rozet olarak gösterilir; yeni bildirim varken öğe hafifçe mavi tonlarda yanıp sener (ses ve üstten bildirim çubuğu yoktur). Şirket Yöneticisi için yerel aktivite ve bulut bildirimleri birlikte sayılır; örnek türler:</p>
        <ul className={styles.list}>
          <li>Proje Yöneticisi bir işi onayladığında</li>
          <li>Proje Yöneticisi yeni ekip oluşturduğunda</li>
          <li>Proje Yöneticisi bir ekibi onayladığında</li>
          <li>Onay bekleyen yeni kullanıcı (katılım veya rol ataması bekleyen) olduğunda</li>
        </ul>
        <p>Proje Yöneticisi için ilgili bulut bildirimleri de bu sayıya dahildir. <strong>Yönetim paneline</strong> (sayfa veya alt sayfalar) ilk girişte bildirimler okunmuş sayılır ve rozet sıfırlanır. Ekip Lideri bu rozeti görmez.</p>

        <h3 className={styles.h3}>Özet Tablo</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Konu</th><th>Açıklama</th></tr>
            </thead>
            <tbody>
              <tr><td>Denetim Günlüğü sayfası</td><td>Sadece Şirket Yöneticisi erişir; tüm kritik işlemler kayıt altındadır.</td></tr>
              <tr><td>Denetim kayıtları</td><td>Değiştirilemez, silinemez; sadece yeni kayıt eklenir.</td></tr>
              <tr><td>Malzeme hareketleri</td><td>Yönetim panelinde filtrelenebilir liste; CM/PM erişir.</td></tr>
              <tr><td>Fiyat görünürlüğü</td><td>CM/PM tüm fiyatları görür; TL varsayılan gizli, isteğe bağlı sadece ekip kazancı.</td></tr>
              <tr><td>Bekleyen onay sayısı</td><td>Menüde rozet; CM iş + kullanıcı, PM sadece iş; üst bildirim/ses yok.</td></tr>
              <tr><td>Yönetim bildirim rozeti</td><td>CM ve PM; üst çubuk ve menüde sayı + hafif nabız, Yönetim paneline girince sıfırlanır.</td></tr>
            </tbody>
          </table>
        </div>
      </>
    ),
  },
];

/**
 * Kullanım kılavuzu sayfası. Üstte arama, altta bölümler.
 */
export function UserGuide() {
  const { t } = useI18n();
  const [search, setSearch] = useState('');

  const sections = useMemo(() => {
    return sectionsData.map((s, i) => ({
      id: s.id,
      title: typeof t(SECTION_TITLE_KEYS[i]) === 'string' ? t(SECTION_TITLE_KEYS[i]) : SECTION_TITLE_KEYS[i],
      searchText: (typeof t(SECTION_SEARCH_KEYS[i]) === 'string' ? t(SECTION_SEARCH_KEYS[i]) : '').toLowerCase(),
      content: s.content,
    }));
  }, [t]);

  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter((s) => s.searchText.includes(q) || (s.title && String(s.title).toLowerCase().includes(q)));
  }, [search, sections]);

  const sectionsToRender = filteredSections.length > 0 ? filteredSections : sections;

  return (
    <div className={styles.page}>
      <PublicPageHeader />
      <main className={styles.main}>
        <h1 className={styles.title}>{t('landing.heroGuide')}</h1>
        <p className={styles.subtitle}>{t('userGuide.subtitle')}</p>

        <div className={styles.searchWrap}>
          <input
            type="search"
            className={styles.searchInput}
            placeholder={t('userGuide.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t('userGuide.searchPlaceholder')}
          />
        </div>

        {filteredSections.length === 0 && search.trim() ? (
          <p className={styles.noResults}>{t('userGuide.noResults')}</p>
        ) : (
          <div className={styles.sections}>
            {sectionsToRender.map((section, index) => (
              <section key={section.id} id={section.id} className={styles.section}>
                <h2 className={styles.sectionTitle}>{index + 1}. {section.title}</h2>
                <div className={styles.sectionContent}>{section.content}</div>
              </section>
            ))}
          </div>
        )}

        <footer className={styles.footer}>
          <h2 className={styles.footerTitle}>{t('userGuide.contactTitle')}</h2>
          <p className={styles.footerText}>{t('userGuide.contactText')}</p>
          <p className={styles.footerEmail}>
            <a href="mailto:mustatafa82oner@gmail.com" className={styles.footerLink}>mustatafa82oner@gmail.com</a>
          </p>
        </footer>
      </main>
    </div>
  );
}
