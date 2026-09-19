import { contactUrl, solutions, solutionPath } from './content';
import styles from './ProductPages.module.css';

export function SolutionLinks() {
  return <section id="solutions" className={styles.section} aria-labelledby="solutions-title">
    <p className={styles.eyebrow}>MK OPS ÇÖZÜMLERİ</p><h2 id="solutions-title">Saha kaydından dönem raporuna</h2>
    <p>MK OPS; telekom ve fiber altyapı çalışmalarında günlük iş, ekip, malzeme, onay ve hakediş kayıtlarını bir araya getirir. Şirket ve proje yöneticileri operasyonu izlerken ekip liderleri kendi ekiplerinin çalışmalarını kaydeder.</p>
    <div className={styles.grid}>{solutions.map(s => <article key={s.slug} className={styles.card}><h3><a href={solutionPath(s.slug)}>{s.title}</a></h3><p>{s.description}</p><a href={solutionPath(s.slug)} aria-label={`${s.title} çözümünü inceleyin`}>Çözümü inceleyin →</a></article>)}</div>
    <div className={styles.note}><h3>Dağınık kayıtlar yerine ortak iş akışı</h3><p>Excel dosyalarında miktar, WhatsApp mesajlarında onay ve farklı listelerde malzeme aramak yerine kayıtları proje ve ekip bağlamında tutun. Bir işin taslak mı, onay bekleyen mi, kabul edilmiş mi olduğunu ayırın; dönem raporlarını onaylı üretim üzerinden değerlendirin.</p></div>
  </section>;
}
export function ProductPage({ slug }: { slug: string }) {
  const s = solutions.find(item => item.slug === slug);
  return <div className={styles.page}>
    <a className={styles.skip} href="#content">İçeriğe geç</a>
    <header className={styles.header}><a className={styles.brand} href="/">MK OPS</a><nav aria-label="Ürün navigasyonu"><a href="/#solutions">Çözümler</a><a href="/#how-it-works">Nasıl çalışır?</a><a href={contactUrl}>Bilgi al</a><a href="/login">Giriş yap</a></nav></header>
    {s ? <main id="content">
      <div className={styles.hero}><nav aria-label="İçerik yolu" className={styles.breadcrumb}><a href="/">MK OPS</a><span aria-hidden="true"> / </span><span aria-current="page">{s.title}</span></nav><p className={styles.eyebrow}>SAHA OPERASYONLARI İÇİN MK OPS</p><h1>{s.title}</h1><p className={styles.lead}>{s.intro}</p><a className={styles.button} href={contactUrl}>Ürün hakkında bilgi alın</a></div>
      <section className={styles.section}><h2>{s.slug === 'hakedis-takibi' ? 'Dönem hesabını ortak kayıtlara dayandırın' : 'Sahadaki ihtiyaç'}</h2><p>{s.problem}</p><div className={styles.grid}>{s.sections.map(section => <article className={styles.card} key={section.title}><h3>{section.title}</h3><p>{section.text}</p></article>)}</div></section>
      <section className={`${styles.section} ${styles.workflow}`}><h2>MK OPS’ta nasıl çalışır?</h2><ol>{s.steps.map(step => <li key={step}>{step}</li>)}</ol><h3>Kimler kullanabilir?</h3><p>{s.audience}</p></section>
      <section className={styles.section}><h2>Sık sorulan sorular</h2>{s.faq.map(item => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</section>
      <section className={styles.section}><h2>İş akışını tamamlayan çözümler</h2><div className={styles.grid}>{s.related.map(slug => { const item = solutions.find(s => s.slug === slug)!; return <a className={styles.card} key={slug} href={solutionPath(slug)}>{item.title} →</a>; })}</div><div className={styles.note}><h3>Operasyonunuza uygun kullanımı konuşalım</h3><p>Proje, ekip ve günlük kayıt düzeninizi paylaşarak MK OPS hakkında bilgi alabilirsiniz.</p><a className={styles.button} href={contactUrl}>İletişime geçin</a></div></section>
    </main> : <main id="content" className={styles.section}><h1>Sayfa bulunamadı</h1><p>Bu adreste bir MK OPS sayfası bulunmuyor.</p><a href="/">Ana sayfaya dönün</a></main>}
    <footer className={styles.footer}><a href="/">MK OPS — Saha operasyon yönetimi</a><nav aria-label="Alt navigasyon">{solutions.map(s => <a key={s.slug} href={solutionPath(s.slug)}>{s.title}</a>)}<a href="/gizlilik-politikasi">Gizlilik politikası</a><a href="/kullanim-sartlari">Kullanım şartları</a><a href="/kullanim-kilavuzu">Kullanım kılavuzu</a></nav></footer>
  </div>;
}
