import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import styles from './RefundPolicy.module.css';

const PAGE_TITLE = 'Geri Ödeme Politikası | MK-OPS';

export function RefundPolicy() {
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
        <h1 className={styles.mainTitle}>Geri Ödeme Politikası</h1>

        <p className={styles.lead}>
          MK-OPS platformunu tercih ettiğiniz için teşekkür ederiz. MK-OPS, şirketlerin operasyon süreçlerini yönetmelerini sağlayan bir SaaS platformudur.
        </p>
        <p>
          Bu Geri Ödeme Politikası, MK-OPS hizmetini kullanırken abonelik ücretleri, iptaller ve geri ödeme taleplerinin nasıl ele alındığını açıklamaktadır.
        </p>

        <h2 className={styles.h2}>1. Ücretsiz Deneme</h2>
        <p>
          MK-OPS platformu belirli planlarda ücretsiz deneme süresi sunabilir.
        </p>
        <p>
          Deneme süresi boyunca kullanıcılar platformu herhangi bir ücret ödemeden deneyebilir. Deneme süresi sona ermeden önce hesabınızı iptal ederseniz herhangi bir ücretlendirme yapılmaz.
        </p>
        <p>
          Deneme süresi sona erdiğinde ve abonelik iptal edilmemişse seçilen plan üzerinden ücretlendirme başlayabilir.
        </p>

        <h2 className={styles.h2}>2. Abonelik Faturalandırması</h2>
        <p>
          MK-OPS abonelikleri seçilen plana bağlı olarak aylık veya yıllık olarak faturalandırılabilir.
        </p>
        <p>
          Ödeme işlemleri üçüncü taraf ödeme sağlayıcıları aracılığıyla güvenli şekilde gerçekleştirilebilir. Kullanıcılar abonelik başlatırken seçtikleri plana göre ödeme yöntemlerinin ücretlendirilmesine onay vermiş sayılır.
        </p>

        <h2 className={styles.h2}>3. Geri Ödeme Uygunluğu</h2>
        <p>
          Genel kural olarak, faturalama dönemi başladıktan sonra yapılan ödemeler iade edilmez.
        </p>
        <p>
          Ancak aşağıdaki durumlarda geri ödeme talepleri değerlendirilebilir:
        </p>
        <ul>
          <li>mükerrer veya hatalı ücretlendirmeler</li>
          <li>hizmete erişimi tamamen engelleyen ciddi teknik sorunlar</li>
          <li>yürürlükteki yasaların gerektirdiği durumlar</li>
        </ul>
        <p>
          Tüm geri ödeme taleplerinin ödeme tarihi, plan bilgileri ve gerekli belgelerle birlikte incelenmesi gerekir. Talepler aşağıdaki iletişim kanalları üzerinden iletilmelidir.
        </p>

        <h2 className={styles.h2}>4. İletişim</h2>
        <p>Geri ödeme politikası veya talepleriniz hakkında sorularınız için bizimle iletişime geçebilirsiniz:</p>
        <ul className={styles.contactBlock}>
          <li><strong>MK Digital Systems</strong></li>
          <li>E-posta: <a href="mailto:mustafa82oner@gmail.com" className={styles.link}>mustafa82oner@gmail.com</a></li>
          <li>Web sitesi: <a href="https://mk-ops.tr" className={styles.link} rel="noopener noreferrer" target="_blank">https://mk-ops.tr</a></li>
        </ul>
      </main>
    </div>
  );
}
