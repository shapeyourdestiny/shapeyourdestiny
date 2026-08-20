"use client";

import { Suspense } from "react";
import RegisterForm from "./RegisterForm";
import styles from "../page.module.css";
import Header from "../../components/Header";
import Footer from "../../components/Footer";

export default function InstructorRegisterPage() {
  return (
    <>
      <Header />

      <section className={styles.section}>
        <div className={styles.card}>
          <div className={styles.iconBadge}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
          </div>

          <span className={styles.eyebrow}>Instructor Portal</span>
          <h1>Create Account</h1>

          <Suspense fallback={<div style={{ padding: "20px", textAlign: "center" }}>Loading...</div>}>
            <RegisterForm />
          </Suspense>

          <p className={styles.secondary}>
            Already have an account?{" "}
            <a href="/instructor-login">Sign in</a>
          </p>
        </div>
      </section>

      <Footer />
    </>
  );
}
