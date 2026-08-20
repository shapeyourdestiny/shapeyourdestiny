"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "../page.module.css";

export default function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [inviteCode, setInviteCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Prefill invite code from URL
  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      setInviteCode(code);
    }
  }, [searchParams]);

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
  );
}
