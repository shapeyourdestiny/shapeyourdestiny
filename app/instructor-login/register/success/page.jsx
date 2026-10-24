import Link from "next/link";
import styles from "../../page.module.css";

export const metadata = {
  title: "Check Your Email | Shape Your Destiny",
};

export default function RegisterSuccessPage() {
  return (
    <section className={styles.section}>
      <div className={styles.card}>
        <div className={styles.iconBadge}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>

        <span className={styles.eyebrow}>Almost There!</span>
        <h1>Check Your Email</h1>

        <p className={styles.body}>
          We&apos;ve sent a confirmation link to your email address.
          Click the link in that email to activate your account.
        </p>

        <div className={styles.steps}>
          <div className={styles.step}>
            <span className={styles.stepNum}>1</span>
            <span>Check your inbox (and spam folder)</span>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNum}>2</span>
            <span>Click the confirmation link</span>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNum}>3</span>
            <span>Sign in to access your dashboard</span>
          </div>
        </div>

        <Link href="/instructor-login" className="btn btnPrimary">
          Go to Sign In
        </Link>

        <p className={styles.secondary}>
          Didn&apos;t receive the email? Contact{" "}
          <a href="mailto:heather@shapeyourdestiny.co">heather@shapeyourdestiny.co</a>{" "}
          or message her on WhatsApp.
        </p>
      </div>
    </section>
  );
}
