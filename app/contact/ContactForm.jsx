"use client";

import { useState } from "react";
import styles from "./page.module.css";

const REASONS = [
  { value: "school", label: "Bring the program to my school", caption: "Youth Wellness Program inquiry", messageLabel: "Tell us about your school", messagePlaceholder: "Grade levels, number of students, what you're hoping to achieve..." },
  { value: "corporate", label: "Corporate wellness for my staff", caption: "Educator training inquiry", messageLabel: "Tell us about your organization", messagePlaceholder: "Team size, current wellness initiatives, goals..." },
  { value: "general", label: "General questions", caption: "General inquiry", messageLabel: "Your message", messagePlaceholder: "How can we help?" },
  { value: "support", label: "Support with an existing program", caption: "Program support request", messageLabel: "How can we help?", messagePlaceholder: "Describe the issue or question..." },
];

export default function ContactForm() {
  const [reason, setReason] = useState("school");
  const [status, setStatus] = useState("idle"); // idle | sending | success | error
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    org: "",
    message: "",
  });

  const currentReason = REASONS.find((r) => r.value === reason) || REASONS[0];

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("sending");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, reason }),
      });

      if (res.ok) {
        setStatus("success");
        setForm({ name: "", email: "", phone: "", org: "", message: "" });
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className={styles.successMessage}>
        <div className={styles.successIcon}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h3>Message sent!</h3>
        <p>We&apos;ll get back to you within 1-2 business days.</p>
        <button className="btn btnPrimary" onClick={() => setStatus("idle")}>
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label htmlFor="reason">What can we help you with?</label>
        <div className={styles.selectWrap}>
          <select
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={styles.select}
          >
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <span className={styles.reasonCaption}>{currentReason.caption}</span>
      </div>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor="name">Your name</label>
          <input
            type="text"
            id="name"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            placeholder="Jane Smith"
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
            placeholder="jane@school.edu"
          />
        </div>
      </div>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor="phone">Phone (optional)</label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="(555) 123-4567"
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="org">School or organization</label>
          <input
            type="text"
            id="org"
            name="org"
            value={form.org}
            onChange={handleChange}
            placeholder="Lincoln Elementary"
          />
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="message">{currentReason.messageLabel}</label>
        <textarea
          id="message"
          name="message"
          value={form.message}
          onChange={handleChange}
          required
          rows={5}
          placeholder={currentReason.messagePlaceholder}
        />
      </div>

      <button
        type="submit"
        className={`btn btnPrimary ${styles.submitBtn}`}
        disabled={status === "sending"}
      >
        {status === "sending" ? "Sending..." : "Send Message"}
      </button>

      {status === "error" && (
        <p className={styles.errorText}>
          Something went wrong. Please try again or email us directly.
        </p>
      )}
    </form>
  );
}
