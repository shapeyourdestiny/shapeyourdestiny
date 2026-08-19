import styles from "./page.module.css";
import Header from "../components/Header";
import Footer from "../components/Footer";

export const metadata = {
  title: "Instructor Sign In | Shape Your Destiny",
  description: "Instructor portal for Shape Your Destiny wellness program coaches and facilitators.",
};

export default function InstructorLoginPage() {
  return (
    <>
      <Header />

      <section className={styles.section}>
        <div className={styles.card}>
          <div className={styles.iconBadge}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>

          <span className={styles.eyebrow}>Instructor Portal</span>
          <h1>Sign in is on its way</h1>
          <p className={styles.body}>
            We are building a proper login for instructors right now. In the meantime, reach out directly and we will get you what you need.
          </p>

          <a className="btn btnPrimary" href="/contact">Contact Us</a>

          <p className={styles.secondary}>
            Already have login questions? Email{" "}
            <a href="mailto:destiny@shapeyourdestiny.co">destiny@shapeyourdestiny.co</a>{" "}
            directly.
          </p>
        </div>
      </section>

      <Footer />
    </>
  );
}
