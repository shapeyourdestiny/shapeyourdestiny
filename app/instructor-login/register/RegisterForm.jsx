"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "../page.module.css";

export default function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Prefill invite code from URL
  const [inviteCode, setInviteCode] = useState(() => searchParams.get("code") || "");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cprExpires, setCprExpires] = useState("");
  const [foodHandlerExpires, setFoodHandlerExpires] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Call the API route which uses admin client to bypass RLS
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteCode: inviteCode.trim(),
          fullName: fullName.trim(),
          phone: phone.trim(),
          email,
          password,
          cprExpires: cprExpires || null,
          foodHandlerExpires: foodHandlerExpires || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed. Please try again.");
        setLoading(false);
        return;
      }

      // Sign in the user after successful registration
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        // Registration succeeded but sign-in failed - redirect to login
        router.push("/instructor-login?registered=true");
        return;
      }

      // Redirect to dashboard
      router.push("/instructor/dashboard");
    } catch (err) {
      console.error("Registration error:", err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
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
        <label htmlFor="phone">Phone Number</label>
        <input
          type="tel"
          id="phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          placeholder="(555) 123-4567"
          autoComplete="tel"
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

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor="cprExpires">CPR Certification Expires</label>
          <input
            type="date"
            id="cprExpires"
            value={cprExpires}
            onChange={(e) => setCprExpires(e.target.value)}
            required
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="foodHandlerExpires">Food Handler Expires <span className={styles.optional}>(optional)</span></label>
          <input
            type="date"
            id="foodHandlerExpires"
            value={foodHandlerExpires}
            onChange={(e) => setFoodHandlerExpires(e.target.value)}
          />
        </div>
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
