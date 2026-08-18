import styles from "./CTA.module.css";

export default function CTA() {
  return (
    <section className={styles.wrapSection}>
      <div className={`wrap ${styles.band}`}>
        <h2>Want to see your child thrive?</h2>
        <p>
          Partner with us to bring whole-child wellness programs into your school,
          at home, in the classroom, and everywhere in between.
        </p>
        <a className="btn btnPrimary" href="/inquiry-form">
          Bring This Program to My School
        </a>
      </div>
    </section>
  );
}
