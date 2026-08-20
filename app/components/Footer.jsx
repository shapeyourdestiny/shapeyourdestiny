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
            <img src="/Images/footer_logo_gold.png" alt="Shape Your Destiny" className={styles.logo} />
            <p className={styles.tagline}>Wellness and confidence for every child.</p>
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
              <a href="/contact">Bring Us to Your School</a>
            </div>

            <div className={styles.column}>
              <h4>Instructors</h4>
              <a href="/instructor-login">Instructor Sign In</a>
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
