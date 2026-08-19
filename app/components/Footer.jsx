import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <>
      <div className={styles.wave}>
        <svg viewBox="0 0 1440 90" preserveAspectRatio="none">
          <path fill="#142C6B" d="M0,0 L720,70 L1440,0 L1440,90 L0,90 Z" />
        </svg>
      </div>
      <footer className={styles.footer}>
        <img src="/Images/footer_logo_gold.webp" alt="Shape Your Destiny" className={styles.logo} />
        <div className={styles.social}>
          <a href="https://www.facebook.com/profile.php?id=100084441627855" aria-label="Facebook">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22 12a10 10 0 10-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0022 12z" />
            </svg>
          </a>
          <a href="https://www.instagram.com/healthbydestiny/" aria-label="Instagram">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" />
            </svg>
          </a>
        </div>
        <p>Copyright &copy; {new Date().getFullYear()} Destiny Owen. All rights reserved.</p>
      </footer>
    </>
  );
}
