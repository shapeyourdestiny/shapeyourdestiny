import styles from "./TrustMarquee.module.css";

// Replace each src below with the real logo file path once you have them.
const PARTNERS = [
  "/Images/partner3.png",
  "/Images/partner4.png",
  "/Images/partner5.png",
  "/Images/Garden-City-Community-College-NSKS.jpg",
  "/Images/partner7.png",
  "/Images/partner9.png",
  "/Images/partner10.png",
];

export default function TrustMarquee() {
  const looped = [...PARTNERS, ...PARTNERS]; // duplicate for seamless loop

  return (
    <section className={styles.trust}>
      <div className={`wrap ${styles.head}`}>
        <span className={styles.eyebrow}>Trusted Partners</span>
        <h2>Schools & Organizations We Work With</h2>
        <p>From elementary schools to universities, we bring wellness programs to institutions across California.</p>
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
