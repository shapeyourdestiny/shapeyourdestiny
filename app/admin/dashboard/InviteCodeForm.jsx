"use client";

import { useState } from "react";
import styles from "./page.module.css";

export default function InviteCodeForm() {
  const [email, setEmail] = useState("");
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
      const res = await fetch("/api/admin/invite-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to send invite");
        setLoading(false);
        return;
      }

      setSuccess(`Invite sent to ${email}`);
      setEmail("");
      setLoading(false);

      // Reload page to show new invite in table
      setTimeout(() => window.location.reload(), 500);
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className={styles.formCard}>
      <h2>Send an Invite</h2>
      <p className={styles.formDesc}>They&apos;ll get an email with a code and a link to register, pre-filled automatically.</p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.formRow}>
          <div className={styles.field}>
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="instructor@email.com"
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

        {error && <p className={styles.error}>{error}</p>}
        {success && <p className={styles.success}>{success}</p>}

        <button type="submit" className="btn btnPrimary" disabled={loading}>
          {loading ? "Sending..." : "Send Invite"}
        </button>
      </form>
    </div>
  );
}
