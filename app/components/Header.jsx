"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./Header.module.css";

const NAV_LINKS = [
  { href: "/", label: "Children's Wellness Program", external: false },
  { href: "http://campshape.org", label: "Camp Shape Summer Camp", external: true },
  { href: "/corporate-training", label: "Corporate Training", external: false },
  { href: "/contact", label: "Contact", external: false },
  { href: "/instructor-login", label: "Instructor Sign In", external: false },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        <Link href="/" className={styles.logo}>
          <Image
            src="/Images/footer_logo_gold.png"
            alt="Shape Your Destiny"
            width={140}
            height={47}
          />
        </Link>

        <div className={styles.navLinks}>
          {NAV_LINKS.map((l) =>
            l.external ? (
              <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a>
            ) : (
              <Link key={l.label} href={l.href}>{l.label}</Link>
            )
          )}
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
