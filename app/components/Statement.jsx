import styles from "./Statement.module.css";

export default function Statement() {
  return (
    <section className={styles.statement}>
      <div className="wrap">
        <h2 className={styles.heading}>
          Children face more pressure than ever, both in school and at home.
        </h2>
        <p className={styles.lede}>
          They don&apos;t just need homework help. They need tools to handle stress,
          build confidence, and connect how their body, emotions, and learning all work together.
        </p>
        <p className={styles.callout}>
          That&apos;s why we created programs that nurture the whole child{" "}
          <span className={styles.w1}>physically</span>.{" "}
          <span className={styles.w2}>emotionally</span>.{" "}
          <span className={styles.w3}>socially</span>.
        </p>
      </div>

      <div className={styles.wave}>
        <svg viewBox="0 0 1440 110" preserveAspectRatio="none">
          <path fill="#EAF1FC" d="M0,50 C240,100 480,0 720,35 C960,70 1200,15 1440,50 L1440,110 L0,110 Z" />
        </svg>
      </div>
    </section>
  );
}
