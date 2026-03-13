import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import styles from './PrivacyPolicy.module.css';

const PAGE_TITLE = 'Gizlilik Politikası | MK-OPS';

export function PrivacyPolicy() {
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
        <h1 className={styles.mainTitle}>Gizlilik Politikası</h1>

        <p className={styles.lead}>
          MK-OPS platformunda gizliliğinize büyük önem veriyoruz. Bu Gizlilik Politikası, MK-OPS web uygulamasını kullanırken kişisel verilerinizin nasıl toplandığını, kullanıldığını ve korunduğunu açıklamaktadır.
        </p>
        <p>
          MK-OPS platformunu kullanarak bu Gizlilik Politikasında belirtilen uygulamaları kabul etmiş olursunuz.
        </p>

        <h2 className={styles.h2}>1. Hizmet Sağlayıcı</h2>
        <p>MK-OPS platformu aşağıdaki kuruluş tarafından işletilmektedir:</p>
        <ul className={styles.contactBlock}>
          <li><strong>MK Digital Systems</strong></li>
          <li>E-posta: <a href="mailto:mustafa82oner@gmail.com" className={styles.link}>mustafa82oner@gmail.com</a></li>
          <li>Web sitesi: <a href="https://mk-ops.tr" className={styles.link} rel="noopener noreferrer" target="_blank">https://mk-ops.tr</a></li>
        </ul>

        <h2 className={styles.h2}>2. Toplanan Veri Türleri</h2>
        <p>MK-OPS platformu aşağıdaki veri türlerini toplayabilir:</p>

        <p className={styles.subHeading}>Hesap bilgileri</p>
        <ul>
          <li>ad ve soyad</li>
          <li>e-posta adresi</li>
          <li>şirket adı</li>
        </ul>

        <p className={styles.subHeading}>Kullanım verileri</p>
        <ul>
          <li>oluşturulan projeler</li>
          <li>ekip ve rol yönetimi verileri</li>
          <li>görev ve operasyon kayıtları</li>
          <li>sistem aktiviteleri</li>
        </ul>

        <p className={styles.subHeading}>Teknik bilgiler</p>
        <ul>
          <li>IP adresi</li>
          <li>tarayıcı türü</li>
          <li>cihaz bilgileri</li>
          <li>oturum zamanları</li>
        </ul>

        <p className={styles.subHeading}>Operasyon verileri</p>
        <ul>
          <li>stok ve malzeme hareketleri</li>
          <li>irsaliye kayıtları</li>
          <li>ekip zimmet bilgileri</li>
          <li>proje faaliyetleri</li>
        </ul>

        <p className={styles.subHeading}>Ödeme verileri</p>
        <p>
          Ödeme işlemleri üçüncü taraf ödeme sağlayıcıları tarafından güvenli şekilde işlenebilir. MK-OPS ödeme kartı bilgilerini doğrudan saklamaz.
        </p>

        <h2 className={styles.h2}>3. Verilerin Kullanım Amaçları</h2>
        <p>Toplanan veriler aşağıdaki amaçlarla kullanılabilir:</p>
        <ul>
          <li>hizmetin sağlanması ve geliştirilmesi</li>
          <li>kullanıcı hesaplarının yönetilmesi</li>
          <li>platform özelliklerinin çalıştırılması</li>
          <li>sistem güvenliğinin sağlanması</li>
          <li>operasyon raporlarının oluşturulması</li>
          <li>kullanıcılarla iletişim kurulması</li>
          <li>yasal yükümlülüklerin yerine getirilmesi</li>
        </ul>
        <p>MK-OPS kullanıcı verilerini hiçbir şekilde satmaz veya kiralamaz.</p>

        <h2 className={styles.h2}>4. Veri İşleme Hukuki Dayanağı</h2>
        <p>Kullanıcı verileri aşağıdaki hukuki temellere dayanarak işlenebilir:</p>
        <ul>
          <li>kullanıcının açık rızası</li>
          <li>hizmet sözleşmesinin yerine getirilmesi</li>
          <li>yasal yükümlülüklerin yerine getirilmesi</li>
          <li>platform güvenliğinin sağlanması</li>
        </ul>

        <h2 className={styles.h2}>5. Veri Paylaşımı</h2>
        <p>
          Veriler yalnızca hizmetin çalışması için gerekli durumlarda güvenilir hizmet sağlayıcılarla paylaşılabilir.
        </p>
        <p>Örnek olarak:</p>
        <ul>
          <li>Supabase (veritabanı ve altyapı hizmetleri)</li>
          <li>e-posta servis sağlayıcıları (sistem bildirimleri için)</li>
          <li>ödeme sağlayıcıları (abonelik işlemleri için)</li>
        </ul>
        <p>Tüm üçüncü taraf hizmet sağlayıcıları veri koruma standartlarına uymak zorundadır.</p>

        <h2 className={styles.h2}>6. Veri Güvenliği</h2>
        <p>
          MK-OPS kullanıcı verilerini korumak için çeşitli güvenlik önlemleri uygular.
        </p>
        <p>Bu önlemler şunları içerebilir:</p>
        <ul>
          <li>HTTPS / SSL güvenli bağlantı</li>
          <li>şifrelenmiş veri depolama</li>
          <li>erişim kontrol mekanizmaları</li>
          <li>sistem logları ve denetim kayıtları</li>
        </ul>
        <p>Verilere yalnızca yetkili kişiler erişebilir.</p>

        <h2 className={styles.h2}>7. Kullanıcı Hakları</h2>
        <p>Kullanıcılar aşağıdaki haklara sahiptir:</p>
        <ul>
          <li>kişisel verilerine erişim talep etme</li>
          <li>yanlış verilerin düzeltilmesini isteme</li>
          <li>verilerin silinmesini talep etme</li>
          <li>veri işleme onayını geri çekme</li>
          <li>verilerini dışa aktarma talep etme</li>
        </ul>
        <p>
          Bu haklarınızı kullanmak için aşağıdaki e-posta adresi üzerinden bizimle iletişime geçebilirsiniz:{' '}
          <a href="mailto:mustafa82oner@gmail.com" className={styles.link}>mustafa82oner@gmail.com</a>
        </p>

        <h2 className={styles.h2}>8. Çerezler</h2>
        <p>
          MK-OPS platformu aşağıdaki amaçlarla çerezler veya benzer teknolojiler kullanabilir:
        </p>
        <ul>
          <li>kullanıcı oturumlarını sürdürmek</li>
          <li>kullanıcı tercihlerini saklamak</li>
          <li>platform performansını ölçmek</li>
        </ul>
        <p>Kullanıcılar çerezleri tarayıcı ayarlarından devre dışı bırakabilir.</p>

        <h2 className={styles.h2}>9. Veri Saklama Süresi</h2>
        <p>
          Kullanıcı verileri, hesap aktif olduğu sürece veya hizmetin sağlanması için gerekli olduğu süre boyunca saklanır.
        </p>
        <p>
          Hesap kapatıldığında veriler belirli bir süre sonra silinebilir veya anonim hale getirilebilir.
        </p>

        <h2 className={styles.h2}>10. Politika Güncellemeleri</h2>
        <p>
          Bu Gizlilik Politikası zaman zaman güncellenebilir.
        </p>
        <p>
          Önemli değişiklikler platform üzerinden veya e-posta yoluyla kullanıcılara bildirilebilir.
        </p>

        <h2 className={styles.h2}>11. İletişim</h2>
        <p>Gizlilik politikası ile ilgili sorularınız için bizimle iletişime geçebilirsiniz:</p>
        <ul className={styles.contactBlock}>
          <li><strong>MK Digital Systems</strong></li>
          <li>E-posta: <a href="mailto:mustafa82oner@gmail.com" className={styles.link}>mustafa82oner@gmail.com</a></li>
          <li>Web sitesi: <a href="https://mk-ops.tr" className={styles.link} rel="noopener noreferrer" target="_blank">https://mk-ops.tr</a></li>
        </ul>
      </main>
    </div>
  );
}
