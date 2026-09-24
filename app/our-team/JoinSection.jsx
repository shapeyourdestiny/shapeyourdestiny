import Link from "next/link";
import styles from "./our-team.module.css";

export default function JoinSection() {
  return (
    <section className={styles.join}>
      <div className={styles.joinCard}>
        <div className={styles.joinContent}>
          <h2 className={styles.joinHeading}>Teach with Shape</h2>
          <p className={styles.joinText}>
            We&apos;re looking for yoga instructors, coaches and wellness leaders for
            before- and after-school programs across California.
          </p>
        </div>
        <div className={styles.joinActions}>
          <Link href="/contact" className={styles.joinBtn}>
            Apply to teach
          </Link>
          <Link href="/instructor-login" className={styles.joinLink}>
            Instructor Sign In
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
    </section>
  );
}
