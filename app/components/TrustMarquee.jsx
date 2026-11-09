import Image from "next/image";
import styles from "./TrustMarquee.module.css";

// Partner logos with descriptive alt text for accessibility
const PARTNERS = [
  { src: "/Images/partner3.png", alt: "Partner school district" },
  { src: "/Images/partner4.webp", alt: "Partner educational organization" },
  { src: "/Images/partner5.png", alt: "Partner elementary school" },
  { src: "/Images/Garden-City-Community-College-NSKS.jpg", alt: "Garden City Community College" },
  { src: "/Images/partner7.png", alt: "Partner school" },
  { src: "/Images/partner9.png", alt: "Partner organization" },
  { src: "/Images/partner10.png", alt: "Partner institution" },
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
          {looped.map((partner, i) => (
            <div className={styles.logo} key={i} aria-hidden={i >= PARTNERS.length}>
              <Image
                src={partner.src}
                alt={i < PARTNERS.length ? partner.alt : ""}
                width={120}
                height={60}
                style={{ objectFit: "contain" }}
              />
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
