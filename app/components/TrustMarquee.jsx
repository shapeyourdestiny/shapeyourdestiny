import styles from "./TrustMarquee.module.css";

// Replace each src below with the real logo file path once you have them.
const PARTNERS = [
  "/images/partner-1.png",
  "/images/partner-2.png",
  "/images/partner-3.png",
  "/images/partner-4.png",
  "/images/partner-5.png",
  "/images/partner-6.png",
  "/images/partner-7.png",
];

export default function TrustMarquee() {
  const looped = [...PARTNERS, ...PARTNERS]; // duplicate for seamless loop

  return (
    <section className={styles.trust}>
      <div className={`wrap ${styles.head}`}>
        <span className={styles.eyebrow}>School Affiliates That Trust Us</span>
      </div>

      <div className={styles.marquee} role="region" aria-label="Partner school and organization logos">
        <div className={styles.track}>
          {looped.map((src, i) => (
            <div className={styles.logo} key={i} aria-hidden={i >= PARTNERS.length}>
              <img src={src} alt={i < PARTNERS.length ? "Partner school logo" : ""} />
            </div>
          ))}
        </div>
      </div>

      <div className={styles.wave}>
        <svg viewBox="0 0 1440 100" preserveAspectRatio="none">
          <path fill="#1F3F91" d="M0,0 L720,80 L1440,0 L1440,100 L0,100 Z" />
        </svg>
      </div>
    </section>
  );
}
