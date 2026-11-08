import Link from "next/link";
import styles from "./our-team.module.css";

export default function JoinSection() {
  return (
    <section className={styles.join}>
      <div className={styles.joinCard}>
        <div className={styles.joinContent}>
          <h2 className={styles.joinHeading}>Want to work with us?</h2>
        </div>
        <div className={styles.joinActions}>
          <Link href="/join" className={styles.joinBtn}>
            Join Our Team
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
