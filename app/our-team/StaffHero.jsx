import Link from "next/link";
import styles from "./our-team.module.css";

export default function StaffHero() {
  return (
    <section className={styles.hero}>
      {/* Decorative blobs */}
      <div className={styles.blobLeft} aria-hidden="true" />
      <div className={styles.blobRight} aria-hidden="true" />
      <div className={styles.blobBottom} aria-hidden="true" />

      <div className={styles.heroInner}>
        <span className={styles.eyebrow}>Our Team</span>
        <h1 className={styles.heroHeading}>
          The People Who Show Up for Every Child
        </h1>
        <p className={styles.heroIntro}>
          Our instructors bring yoga, movement, team sports and mindfulness into
          schools across California, and they&apos;re trained to make every kid feel
          seen, safe and capable.
        </p>
        <div className={styles.heroActions}>
          <a href="#instructors" className={styles.heroBtn}>
            Meet the instructors
          </a>
          <Link href="/contact" className={styles.heroLink}>
            Teach with us
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14" />
              <path d="M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Wave divider */}
      <div className={styles.wave} aria-hidden="true">
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none">
          <path
            fill="#E7EFFC"
            d="M0,0 C360,80 1080,80 1440,0 L1440,80 L0,80 Z"
          />
        </svg>
      </div>
    </section>
  );
}
