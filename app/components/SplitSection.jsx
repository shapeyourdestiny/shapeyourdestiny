import styles from "./SplitSection.module.css";

/**
 * Reusable photo-cluster + copy section.
 * Used for both "Our Whole Child Approach" and "Before & After School".
 * Pass reverse={true} to put the photo cluster on the left instead of the right.
 */
export default function SplitSection({
  reverse = false,
  eyebrow,
  heading,
  paragraphs = [],
  mainSrc,
  mainAlt,
  insetSrc,
  insetAlt,
}) {
  return (
    <section className={styles.split}>
      <div className={`wrap ${styles.inner}`}>
        <div style={{ order: reverse ? 2 : 1 }}>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <div className={styles.copy}>
            <h2>{heading}</h2>
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>

        <div className={styles.media} style={{ order: reverse ? 1 : 2 }}>
          <div className={`${styles.blob} ${styles.blobA} ${reverse ? styles.blobALeft : ""}`} />
          <div className={`${styles.blob} ${styles.blobB} ${reverse ? styles.blobBLeft : ""}`} />
          <div className={styles.mainPhoto}>
            <img src={mainSrc} alt={mainAlt} />
          </div>
          <div className={`${styles.insetPhoto} ${reverse ? styles.insetRight : ""}`}>
            <img src={insetSrc} alt={insetAlt} />
          </div>
        </div>
      </div>
    </section>
  );
}
