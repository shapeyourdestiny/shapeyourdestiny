"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function CreateAccountForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("instructor");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/create-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create account");
        setLoading(false);
        return;
      }

      setSuccess(`Account created for ${fullName}`);
      setFullName("");
      setEmail("");
      setPassword("");
      setRole("instructor");
      setLoading(false);

      // Refresh to show in instructors list
      router.refresh();
    } catch (err) {
      console.error("Create account error:", err);
      setError("Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className={styles.formCard}>
      <h2>Create Account Manually</h2>
      <p className={styles.formDesc}>Create an account directly without sending an invite.</p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.formRow}>
          <div className={styles.field}>
            <label htmlFor="fullName">Full Name</label>
            <input
              type="text"
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="Jane Smith"
            />
          </div>

          <div className={styles.field}>
            <label>Role</label>
            <div className={styles.roleToggle}>
              <button
                type="button"
                className={`${styles.roleBtn} ${role === "instructor" ? styles.roleBtnActive : ""}`}
                onClick={() => setRole("instructor")}
              >
                Instructor
              </button>
              <button
                type="button"
                className={`${styles.roleBtn} ${role === "admin" ? styles.roleBtnActive : ""}`}
                onClick={() => setRole("admin")}
              >
                Admin
              </button>
            </div>
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.field}>
            <label htmlFor="createEmail">Email</label>
            <input
              type="email"
              id="createEmail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="instructor@email.com"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="createPassword">Password</label>
            <input
              type="password"
              id="createPassword"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="At least 6 characters"
            />
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}
        {success && <p className={styles.success}>{success}</p>}

        <button type="submit" className="btn btnPrimary" disabled={loading}>
          {loading ? "Creating..." : "Create Account"}
        </button>
      </form>
    </div>
  );
}
