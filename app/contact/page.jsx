import styles from "./page.module.css";
import Header from "../components/Header";
import Footer from "../components/Footer";
import ContactForm from "./ContactForm";

export const metadata = {
  title: "Contact Us | Shape Your Destiny",
  description: "Get in touch with Shape Your Destiny about youth wellness programs, corporate training, or general inquiries.",
};

export default function ContactPage() {
  return (
    <>
      <Header />

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <span className={styles.eyebrow}>Contact Us</span>
          <h1>Let&apos;s Start a Conversation</h1>
          <p className={styles.lede}>
            Whether you&apos;re interested in bringing our programs to your school, exploring corporate wellness, or just have questions, we&apos;d love to hear from you.
          </p>
        </div>
        <div className={styles.wave}>
          <svg viewBox="0 0 1440 100" preserveAspectRatio="none">
            <path fill="#EAF1FC" d="M0,60 C240,110 480,10 720,45 C960,80 1200,20 1440,55 L1440,100 L0,100 Z" />
          </svg>
        </div>
      </section>

      <section className={styles.content}>
        <div className="wrap">
          <div className={styles.grid}>
            <div className={styles.formSection}>
              <ContactForm />
            </div>

            <div className={styles.infoSection}>
              <div className={styles.contactCard}>
                <h3>Reach us directly</h3>
                <a href="mailto:destiny@shapeyourdestiny.co" className={styles.contactLink}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="M22 6l-10 7L2 6" />
                  </svg>
                  destiny@shapeyourdestiny.co
                </a>
                <a href="tel:9096843095" className={styles.contactLink}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                  </svg>
                  (909) 684-3095
                </a>
              </div>

              <div className={styles.stepsCard}>
                <h3>What happens after you send this?</h3>
                <div className={styles.steps}>
                  <div className={styles.step}>
                    <div className={styles.stepNum}>1</div>
                    <div>
                      <strong>We review your message</strong>
                      <p>Usually within 24 hours on business days.</p>
                    </div>
                  </div>
                  <div className={styles.step}>
                    <div className={styles.stepNum}>2</div>
                    <div>
                      <strong>We reach out to learn more</strong>
                      <p>A quick call or email to understand your needs.</p>
                    </div>
                  </div>
                  <div className={styles.step}>
                    <div className={styles.stepNum}>3</div>
                    <div>
                      <strong>We build a plan together</strong>
                      <p>Tailored to your school, staff, or goals.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
