import styles from "./Hero.module.css";

export default function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.heroGrid}>
        <div>
          <p className={styles.eyebrow}>Children&apos;s Youth Programs</p>
          <h1 className={styles.title}>Wellness and Confidence for Every Child</h1>
          <div className={styles.ctas}>
            <a className="btn btnPrimary" href="/inquiry-form">
              Bring this program to my school
            </a>
          </div>
        </div>

        <div className={styles.photoWrap}>
          <div className={`${styles.blob} ${styles.blobOrange}`} />
          <div className={`${styles.blob} ${styles.blobTeal}`} />
          {/* Replace with the real hero photo */}
          <div className={styles.photoFrame}>
            <img src="/Images/hero-kids.webp" alt="Kids in the Shape Your Destiny wellness program" />
          </div>
        </div>
      </div>

      <div className={styles.wave}>
        <svg viewBox="0 0 1440 110" preserveAspectRatio="none">
          <path fill="#EAF1FC" d="M0,60 C240,110 480,10 720,40 C960,70 1200,20 1440,55 L1440,110 L0,110 Z" />
        </svg>
      </div>
    </section>
  );
}
