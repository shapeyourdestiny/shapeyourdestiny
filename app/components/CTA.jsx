import styles from "./CTA.module.css";

export default function CTA() {
  return (
    <section className={styles.wrapSection}>
      <div className={`wrap ${styles.band}`}>
        <h2>Help us shape more destinies</h2>
        <p>
          Your donation helps us bring whole-child wellness programs to more schools,
          empowering young people to build resilience, confidence, and purpose.
        </p>
        <a
          className="btn btnPrimary"
          href="https://www.paypal.com/donate/?hosted_button_id=263FBTTYYBNLY"
          target="_blank"
          rel="noopener noreferrer"
        >
          Donate to Shape Your Destiny
        </a>
      </div>
    </section>
  );
}
