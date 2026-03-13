import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import styles from './TermsOfUse.module.css';

const PAGE_TITLE = 'Kullanım Şartları | MK-OPS';

export function TermsOfUse() {
  const { t } = useI18n();

  useEffect(() => {
    document.title = PAGE_TITLE;
    return () => { document.title = 'MK-OPS'; };
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.backLink}>← {t('userGuide.backToHome')}</Link>
      </header>
      <main className={styles.doc}>
        <h1 className={styles.mainTitle}>Kullanım Şartları</h1>

        <p className={styles.lead}>
          MK-OPS’a hoş geldiniz. Bu hizmete <a href="https://mk-ops.tr" className={styles.link} rel="noopener noreferrer" target="_blank">https://mk-ops.tr</a> adresi üzerinden erişebilirsiniz.
        </p>

        <p>
          Bu Kullanım Şartları (“Şartlar”), MK-OPS web uygulamasına ve hizmetlerine (“Hizmet”) erişiminizi ve kullanımınızı düzenler. MK-OPS’a erişerek veya kullanarak bu Şartlara bağlı kalmayı kabul etmiş olursunuz. Bu Şartları kabul etmiyorsanız, Hizmeti kullanmayınız.
        </p>

        <h2 className={styles.h2}>1. Hizmet Sağlayıcı Bilgileri</h2>
        <p>Bu hizmet aşağıdaki kişi/kuruluş tarafından işletilmektedir:</p>
        <ul className={styles.contactBlock}>
          <li><strong>Mustafa Öner</strong></li>
          <li>E-posta: <a href="mailto:mustafa82oner@gmail.com" className={styles.link}>mustafa82oner@gmail.com</a></li>
          <li>Web sitesi: <a href="https://mk-ops.tr" className={styles.link} rel="noopener noreferrer" target="_blank">https://mk-ops.tr</a></li>
        </ul>

        <h2 className={styles.h2}>2. Hizmetin Tanımı</h2>
        <p>
          MK-OPS, şirketlerin operasyonlarını dijital ortamda yönetmesini sağlayan bir yazılım hizmeti (SaaS) platformudur. Platform, aşağıdaki işlevleri sunabilir:
        </p>
        <ul>
          <li>Şirket oluşturma ve yönetme</li>
          <li>Rol bazlı kullanıcı yetkilendirme</li>
          <li>Proje ve görev yönetimi</li>
          <li>Ekip lideri ve proje müdürü yönetimi</li>
          <li>Operasyon süreçlerinin takibi</li>
          <li>Stok ve malzeme yönetimi</li>
          <li>İrsaliye ile malzeme girişi</li>
          <li>Depodan ekiplere malzeme zimmetleme</li>
          <li>Projelere kullanılan malzemelerin işlenmesi</li>
          <li>Taşeron yönetimi, performans ve kazanç takibi</li>
          <li>Raporlama ve operasyon analizleri</li>
        </ul>

        <h2 className={styles.h2}>3. Hesap Kaydı</h2>
        <p>
          MK-OPS’u kullanmak için kullanıcıların doğru, güncel ve eksiksiz bilgilerle hesap oluşturması gerekir. Hesabınıza ait giriş bilgilerinin güvenliğinden siz sorumlusunuz. Hesabınız altında gerçekleşen tüm işlemlerden kullanıcı sorumludur.
        </p>

        <h2 className={styles.h2}>4. Şirket Yapısı ve Kullanıcı Yetkilendirme</h2>
        <p>
          MK-OPS çok kiracılı (multi-tenant) bir sistemdir. Her şirket kendi verilerine yalnızca kendi yetkili kullanıcıları aracılığıyla erişebilir.
        </p>
        <ul>
          <li>Şirketi oluşturan ilk kullanıcı, sistem tarafından şirket yöneticisi olarak tanımlanır.</li>
          <li>Şirket yöneticisi tektir.</li>
          <li>Sisteme katılmak isteyen diğer kullanıcılar kendi başvurularını oluşturur.</li>
          <li>Yeni kullanıcıların şirkete katılımı, şirket yöneticisinin onayına tabidir.</li>
          <li>Kullanıcılar rol bazlı olarak yetkilendirilir.</li>
          <li>Sistem içinde birden fazla proje müdürü ve ekip lideri bulunabilir.</li>
        </ul>

        <h2 className={styles.h2}>5. Abonelik ve Ödemeler</h2>
        <p>
          MK-OPS ücretli veya ücretsiz planlar sunabilir. Ücretli planlara ilişkin fiyatlandırma, ödeme dönemi ve plan içerikleri ilgili fiyatlandırma sayfasında belirtilir.
        </p>
        <p>
          Ödeme altyapısı üçüncü taraf ödeme sağlayıcıları aracılığıyla yürütülebilir. Kullanıcı, seçtiği plana göre ödemelerin işlenmesine onay verir.
        </p>

        <h2 className={styles.h2}>6. Deneme Süresi</h2>
        <p>
          MK-OPS belirli planlarda ücretsiz deneme süresi sunabilir. Deneme süresi sonunda abonelik, kullanıcı tarafından iptal edilmediği takdirde ücretli olarak devam edebilir. Deneme koşulları ilgili plan ekranında ayrıca belirtilir.
        </p>

        <h2 className={styles.h2}>7. İptal ve Geri Ödeme</h2>
        <p>
          Kullanıcı aboneliğini hesap ayarları veya ilgili yönetim alanı üzerinden iptal edebilir. İptal sonrasında erişim, mevcut fatura döneminin sonuna kadar devam edebilir.
        </p>
        <p>
          Geri ödeme koşulları, ayrı olarak yayınlanan <Link to="/geri-odeme-politikasi" className={styles.link}>Geri Ödeme Politikası</Link> kapsamında değerlendirilir. Yasal zorunluluklar dışında yapılan ödemeler iade edilmeyebilir.
        </p>

        <h2 className={styles.h2}>8. Kabul Edilebilir Kullanım</h2>
        <p>
          Kullanıcılar, Hizmeti hukuka ve dürüst kullanım kurallarına uygun şekilde kullanmayı kabul eder. Aşağıdaki eylemler yasaktır:
        </p>
        <ul>
          <li>Hizmeti yasa dışı amaçlarla kullanmak</li>
          <li>Başka şirketlerin veya kullanıcıların verilerine izinsiz erişmeye çalışmak</li>
          <li>Sistemin işleyişini bozmak, engellemek veya zarar vermek</li>
          <li>Platformun herhangi bir bölümünü tersine mühendislik ile incelemeye çalışmak</li>
          <li>Yetkisiz veri kopyalama, aktarma veya dışa çıkarma girişiminde bulunmak</li>
        </ul>
        <p>
          Bu kuralların ihlali halinde hesap askıya alınabilir veya kalıcı olarak kapatılabilir.
        </p>

        <h2 className={styles.h2}>9. Veri Kullanımı ve Gizlilik</h2>
        <p>
          MK-OPS, kullanıcı verilerini ve kullanım bilgilerini ilgili <Link to="/gizlilik-politikasi" className={styles.link}>Gizlilik Politikası</Link> kapsamında toplar ve işler. Hizmeti kullanarak, bu verilerin belirtilen amaçlarla işlenmesini kabul etmiş olursunuz.
        </p>
        <p>
          Veriler, hizmetin sunulması, geliştirilmesi, güvenliğin sağlanması ve operasyonel işleyişin yürütülmesi amacıyla kullanılabilir.
        </p>

        <h2 className={styles.h2}>10. Fikri Mülkiyet</h2>
        <p>
          MK-OPS platformuna ait tüm içerikler, yazılımlar, tasarımlar, markalar, arayüzler ve sistem yapıları, aksi açıkça belirtilmedikçe hizmet sağlayıcının fikri mülkiyetidir. Yazılı izin olmaksızın kopyalanamaz, çoğaltılamaz, değiştirilemez veya ticari amaçla kullanılamaz.
        </p>

        <h2 className={styles.h2}>11. Şartlarda Değişiklik</h2>
        <p>
          MK-OPS, bu Şartları zaman zaman güncelleyebilir. Önemli değişiklikler uygun görülmesi halinde e-posta veya uygulama içi bildirim yoluyla kullanıcılara bildirilebilir. Hizmeti kullanmaya devam etmeniz, güncellenmiş Şartları kabul ettiğiniz anlamına gelir.
        </p>

        <h2 className={styles.h2}>12. Uygulanacak Hukuk</h2>
        <p>
          Bu Şartlar, aksi zorunlu yasal düzenlemeler saklı kalmak kaydıyla Türkiye Cumhuriyeti hukuku çerçevesinde yorumlanır ve uygulanır.
        </p>

        <h2 className={styles.h2}>13. İletişim</h2>
        <p>Bu Şartlar hakkında sorularınız varsa aşağıdaki iletişim bilgilerini kullanabilirsiniz:</p>
        <ul className={styles.contactBlock}>
          <li>E-posta: <a href="mailto:mustafa82oner@gmail.com" className={styles.link}>mustafa82oner@gmail.com</a></li>
          <li>Web sitesi: <a href="https://mk-ops.tr" className={styles.link} rel="noopener noreferrer" target="_blank">https://mk-ops.tr</a></li>
        </ul>
      </main>
    </div>
  );
}
