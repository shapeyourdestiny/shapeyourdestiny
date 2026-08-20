"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "../page.module.css";
import Header from "../../components/Header";
import Footer from "../../components/Footer";

export default function InstructorRegisterPage() {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();

    // 1. Look up the invite code
    const { data: inviteData, error: inviteError } = await supabase
      .from("invite_codes")
      .select("id, role, used_by")
      .eq("code", inviteCode.trim())
      .single();

    if (inviteError || !inviteData) {
      setError("Invalid invite code. Please check and try again.");
      setLoading(false);
      return;
    }

    if (inviteData.used_by) {
      setError("This invite code has already been used.");
      setLoading(false);
      return;
    }

    // 2. Create the account
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    const userId = signUpData.user?.id;
    if (!userId) {
      setError("Account creation failed. Please try again.");
      setLoading(false);
      return;
    }

    // 3. Insert profile with role from invite code
    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        full_name: fullName.trim(),
        role: inviteData.role,
      });

    if (profileError) {
      setError("Failed to create profile. Please contact support.");
      setLoading(false);
      return;
    }

    // 4. Mark invite code as used
    const { error: updateError } = await supabase
      .from("invite_codes")
      .update({ used_by: userId })
      .eq("id", inviteData.id);

    if (updateError) {
      // Non-critical, continue anyway
      console.error("Failed to mark invite code as used:", updateError);
    }

    // 5. Redirect to dashboard
    router.push("/instructor/dashboard");
  };

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

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label htmlFor="inviteCode">Invite Code</label>
              <input
                type="text"
                id="inviteCode"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
                placeholder="Enter your invite code"
                autoComplete="off"
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="fullName">Full Name</label>
              <input
                type="text"
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="Jane Smith"
                autoComplete="name"
              />
            </div>

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
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
            </div>

            {error && <p className={styles.errorText}>{error}</p>}

            <button
              type="submit"
              className="btn btnPrimary"
              disabled={loading}
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

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
