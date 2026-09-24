import styles from "./our-team.module.css";

const VALUES = [
  {
    title: "Meeting kids where they are",
    text: "Shy, full of energy or somewhere in between, our instructors meet each child where they are.",
  },
  {
    title: "Whole-child training",
    text: "Every instructor is trained in our approach linking body, emotions and learning.",
  },
  {
    title: "Safety first",
    text: "Background checks, CPR certification and ongoing coaching keep every session safe.",
  },
  {
    title: "Consistency",
    text: "Kids learn best with familiar faces, so we keep instructor-school pairings stable.",
  },
];

export default function ValuesSection() {
  return (
    <section className={styles.values}>
      <div className={styles.sectionInner}>
        <div className={styles.sectionEyebrow}>What every instructor brings</div>
        <h2 className={styles.sectionHeading}>
          Trained, Certified and Ready to Inspire
        </h2>
        <div className={styles.valuesGrid}>
          {VALUES.map((value) => (
            <div key={value.title} className={styles.valueCard}>
              <h3 className={styles.valueTitle}>{value.title}</h3>
              <p className={styles.valueText}>{value.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
