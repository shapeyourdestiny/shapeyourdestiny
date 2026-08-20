"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";
import Header from "../components/Header";
import Footer from "../components/Footer";

export default function InstructorLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message === "Invalid login credentials"
        ? "Invalid email or password. Please try again."
        : signInError.message
      );
      setLoading(false);
      return;
    }

    router.push("/instructor/dashboard");
  };

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
          <h1>Sign In</h1>

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

            <div className={styles.field}>
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Your password"
                autoComplete="current-password"
              />
            </div>

            {error && <p className={styles.errorText}>{error}</p>}

            <button
              type="submit"
              className="btn btnPrimary"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className={styles.secondary}>
            Need an account?{" "}
            <a href="/instructor-login/register">Register with your invite code</a>
          </p>
        </div>
      </section>

      <Footer />
    </>
  );
}
