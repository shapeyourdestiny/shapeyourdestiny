"use client";

import { useState } from "react";
import styles from "./Header.module.css";

const NAV_LINKS = [
  { href: "/", label: "Children's Wellness Program" },
  { href: "http://campshape.org", label: "Camp Shape Summer Camp" },
  { href: "/corporate-training", label: "Corporate Training" },
  { href: "/contact", label: "Contact" },
  { href: "/instructor-login", label: "Instructor Sign In" },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        <a href="/" className={styles.logo}>
          <img src="/Images/footer_logo_gold.png" alt="Shape Your Destiny" />
        </a>

        <div className={styles.navLinks}>
          {NAV_LINKS.map((l) => (
            <a key={l.label} href={l.href}>{l.label}</a>
          ))}
        </div>

        <a
          className={`btn btnPrimary ${styles.navCta}`}
          href="https://www.paypal.com/donate/?hosted_button_id=263FBTTYYBNLY"
          target="_blank"
          rel="noopener noreferrer"
        >
          Donate to Shape
        </a>

        <button
          className={styles.burger}
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      </nav>

      {open && (
        <div className={styles.mobileMenu}>
          {NAV_LINKS.map((l) => (
            <a key={l.label} href={l.href}>{l.label}</a>
          ))}
          <a href="https://www.paypal.com/donate/?hosted_button_id=263FBTTYYBNLY" target="_blank" rel="noopener noreferrer">Donate to Shape</a>
        </div>
      )}
    </header>
  );
}
