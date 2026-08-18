import styles from "./Intro.module.css";

export default function Intro() {
  return (
    <section className={styles.intro}>
      <div className="wrap">
        <h2 className={styles.heading}>
          <span className={styles.b1}>Building</span>{" "}
          <span className={styles.b2}>Healthy Bodies.</span>{" "}
          <span className={styles.b1}>Calm</span>{" "}
          <span className={styles.b2}>Minds.</span>{" "}
          <span className={styles.b1}>Confident</span>{" "}
          <span className={styles.b3}>Hearts.</span>
        </h2>
        <blockquote className={styles.quote}>
          &ldquo;When I asked a group of 3rd&ndash;5th graders if they&apos;d ever felt anxious,
          nearly every hand went up. That broke my heart, but it also gave me a mission.&rdquo;
          <cite>Destiny Owen, Founder of Shape Your Destiny</cite>
        </blockquote>
      </div>
    </section>
  );
}
