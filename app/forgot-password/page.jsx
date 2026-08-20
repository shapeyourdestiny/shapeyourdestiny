"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";
import Header from "../components/Header";
import Footer from "../components/Footer";

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("error") === "expired") {
      setError("Your reset link has expired. Please request a new one.");
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  return (
    <div className={styles.card}>
      <div className={styles.iconBadge}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>

      <span className={styles.eyebrow}>Password Recovery</span>
      <h1>Forgot Password?</h1>

      {success ? (
        <>
          <p className={styles.body}>
            Check your email for a password reset link. If you don't see it, check your spam folder.
          </p>
          <a href="/instructor-login" className="btn btnPrimary">
            Back to Sign In
          </a>
        </>
      ) : (
        <>
          <p className={styles.body}>
            Enter your email address and we'll send you a link to reset your password.
          </p>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            {error && <p className={styles.errorText}>{error}</p>}

            <button
              type="submit"
              className="btn btnPrimary"
              disabled={loading}
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>

          <p className={styles.secondary}>
            Remember your password?{" "}
            <a href="/instructor-login">Sign in</a>
          </p>
        </>
      )}
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <>
      <Header />

      <section className={styles.section}>
        <Suspense fallback={<div className={styles.card}>Loading...</div>}>
          <ForgotPasswordForm />
        </Suspense>
      </section>

      <Footer />
    </>
  );
}
