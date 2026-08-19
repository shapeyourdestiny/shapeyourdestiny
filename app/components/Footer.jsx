"use client";

import styles from "./Footer.module.css";

const DONATE_URL = "https://www.paypal.com/donate/?hosted_button_id=263FBTTYYBNLY";

export default function Footer() {
  return (
    <>
      <div className={styles.wave}>
        <svg viewBox="0 0 1440 90" preserveAspectRatio="none">
          <path fill="#142C6B" d="M0,0 L720,70 L1440,0 L1440,90 L0,90 Z" />
        </svg>
      </div>
      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.brand}>
            <img src="/Images/footer_logo_gold.webp" alt="Shape Your Destiny" className={styles.logo} />
            <p className={styles.tagline}>Wellness and confidence for every child.</p>
            <div className={styles.social}>
              <a href="https://www.facebook.com/profile.php?id=100084441627855" aria-label="Facebook" target="_blank" rel="noopener noreferrer">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22 12a10 10 0 10-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0022 12z" />
                </svg>
              </a>
              <a href="https://www.instagram.com/healthbydestiny/" aria-label="Instagram" target="_blank" rel="noopener noreferrer">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1" />
                </svg>
              </a>
            </div>
          </div>

          <div className={styles.links}>
            <div className={styles.column}>
              <h4>Programs</h4>
              <a href="/">Children&apos;s Wellness</a>
              <a href="http://campshape.org" target="_blank" rel="noopener noreferrer">Camp Shape Summer Camp</a>
              <a href="/corporate-training">Corporate Training</a>
            </div>

            <div className={styles.column}>
              <h4>Resources</h4>
              <a href="/youth-program/yoga-breathwork">Yoga & Breathwork</a>
              <a href="/youth-program/mindfulness">Mindfulness</a>
              <a href="/youth-program/nutrition">Nutrition</a>
            </div>

            <div className={styles.column}>
              <h4>Connect</h4>
              <a href="/contact">Contact Us</a>
              <a href="/instructor-login">Instructor Sign In</a>
              <a href="/inquiry-form">Bring Us to Your School</a>
            </div>
          </div>

          <div className={styles.donate}>
            <h4>Support Our Mission</h4>
            <p>Help us bring wellness programs to more children in need.</p>
            <a href={DONATE_URL} className={styles.donateBtn} target="_blank" rel="noopener noreferrer">
              Donate Now
            </a>
          </div>
        </div>

        <div className={styles.bottom}>
          <p>&copy; {new Date().getFullYear()} Shape Your Destiny. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}
