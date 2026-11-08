import Image from "next/image";
import styles from "./SplitSection.module.css";

/**
 * Reusable photo + copy section.
 * Used for both "Our Whole Child Approach" and "Before & After School".
 * Pass reverse={true} to put the photo on the left instead of the right.
 * Images already have decorative frames built in, so we display them simply.
 */
export default function SplitSection({
  reverse = false,
  eyebrow,
  heading,
  paragraphs = [],
  imageSrc,
  imageAlt,
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
          <Image
            src={imageSrc}
            alt={imageAlt}
            width={500}
            height={400}
            className={styles.designedImage}
            sizes="(max-width: 768px) 100vw, 500px"
          />
        </div>
      </div>
    </section>
  );
}
