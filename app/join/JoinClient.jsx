"use client";

import { useState, useRef } from "react";
import Turnstile from "@/components/Turnstile";
import styles from "./join.module.css";

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function JoinClient({ hiringOpen }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [ageConfirm, setAgeConfirm] = useState(false);
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedName, setSubmittedName] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [pageLoadTime] = useState(() => Date.now());
  const [turnstileToken, setTurnstileToken] = useState("");

  const fileInputRef = useRef(null);
  const formRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (selectedFile) => {
    setFile(selectedFile);
    setErrors((prev) => ({ ...prev, resume: null }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setSubmitting(true);

    const formData = new FormData();
    formData.append("firstName", firstName);
    formData.append("lastName", lastName);
    formData.append("email", email);
    formData.append("phone", phone);
    formData.append("message", message);
    formData.append("ageConfirm", ageConfirm.toString());
    formData.append("_plt", pageLoadTime.toString());
    formData.append("cf-turnstile-response", turnstileToken);
    // Honeypot field
    formData.append("website", "");

    if (file) {
      formData.append("resume", file);
    }

    try {
      const response = await fetch("/api/apply", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.errors) {
          setErrors(data.errors);
          // Focus first field with error
          const firstErrorField = Object.keys(data.errors)[0];
          const fieldElement = formRef.current?.querySelector(`[name="${firstErrorField}"]`);
          fieldElement?.focus();
        } else if (data.error) {
          setErrors({ form: data.error });
        }
        setSubmitting(false);
        return;
      }

      // Success
      setSubmittedName(data.firstName || firstName);
      setSubmittedEmail(email);
      setSubmitted(true);
    } catch (error) {
      console.error("Submit error:", error);
      setErrors({ form: "Something went wrong. Please try again." });
      setSubmitting(false);
    }
  };

  if (!hiringOpen) {
    return (
      <>
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <span className={styles.eyebrow}>Now hiring instructors</span>
            <h1 className={styles.heroHeading}>Join our team</h1>
            <p className={styles.heroIntro}>
              Teach wellness, yoga and sports to kids at schools across the Inland Empire.
            </p>
          </div>
        </section>

        <section className={styles.formSection}>
          <div className={styles.formCard}>
            <div className={styles.pausedMessage}>
              <p>We&apos;re not hiring right now. Check back soon.</p>
            </div>
          </div>
        </section>
      </>
    );
  }

  if (submitted) {
    return (
      <>
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <span className={styles.eyebrow}>Now hiring instructors</span>
            <h1 className={styles.heroHeading}>Join our team</h1>
            <p className={styles.heroIntro}>
              Teach wellness, yoga and sports to kids at schools across the Inland Empire.
            </p>
          </div>
        </section>

        <section className={styles.formSection}>
          <div className={styles.formCard}>
            <div className={styles.thankYou}>
              <div className={styles.checkIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 className={styles.thankYouHeading}>Thanks, {submittedName}!</h2>
              <p className={styles.thankYouText}>
                We got your application and sent a copy to {submittedEmail}. We&apos;ll be in touch.
              </p>
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <span className={styles.eyebrow}>Now hiring instructors</span>
          <h1 className={styles.heroHeading}>Join our team</h1>
          <p className={styles.heroIntro}>
            Teach wellness, yoga and sports to kids at schools across the Inland Empire.
          </p>
        </div>
      </section>

      <section className={styles.formSection}>
        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>Apply to teach with us</h2>
          <p className={styles.formIntro}>Send us your info and resume. We&apos;ll be in touch.</p>

          {errors.form && (
            <div className={styles.formError}>{errors.form}</div>
          )}

          <form ref={formRef} onSubmit={handleSubmit} className={styles.form}>
            {/* Honeypot - hidden from users */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              className={styles.honeypot}
            />

            <div className={styles.nameRow}>
              <div className={styles.field}>
                <label htmlFor="firstName">First name</label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  aria-invalid={!!errors.firstName}
                />
                {errors.firstName && <span className={styles.fieldError}>{errors.firstName}</span>}
              </div>
              <div className={styles.field}>
                <label htmlFor="lastName">Last name</label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  aria-invalid={!!errors.lastName}
                />
                {errors.lastName && <span className={styles.fieldError}>{errors.lastName}</span>}
              </div>
            </div>

            <div className={styles.contactRow}>
              <div className={styles.field}>
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                />
                {errors.email && <span className={styles.fieldError}>{errors.email}</span>}
              </div>
              <div className={styles.field}>
                <label htmlFor="phone">Phone</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  aria-invalid={!!errors.phone}
                />
                {errors.phone && <span className={styles.fieldError}>{errors.phone}</span>}
              </div>
            </div>

            <div className={styles.field}>
              <label>Resume</label>
              <div
                className={`${styles.dropZone} ${dragActive ? styles.dragActive : ""} ${file ? styles.hasFile : ""}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                aria-describedby={errors.resume ? "resume-error" : undefined}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  name="resume"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileChange}
                  className={styles.fileInput}
                />
                {file ? (
                  <div className={styles.fileInfo}>
                    <svg className={styles.fileIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <div className={styles.fileDetails}>
                      <span className={styles.fileName}>{file.name}</span>
                      <span className={styles.fileSize}>{formatFileSize(file.size)}</span>
                    </div>
                    <button
                      type="button"
                      className={styles.replaceBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      Replace
                    </button>
                  </div>
                ) : (
                  <div className={styles.dropPrompt}>
                    <svg className={styles.uploadIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span>Upload your resume</span>
                    <span className={styles.dropOr}>or drag it here</span>
                  </div>
                )}
              </div>
              <p className={styles.fileHint}>PDF or Word, up to 10 MB.</p>
              {errors.resume && <span className={styles.fieldError}>{errors.resume}</span>}
            </div>

            <div className={styles.field}>
              <label htmlFor="message">Anything else you&apos;d like us to know? (optional)</label>
              <textarea
                id="message"
                name="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={1000}
              />
              <span className={styles.charCount}>{message.length}/1000</span>
            </div>

            <div className={styles.checkboxField}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  name="ageConfirm"
                  checked={ageConfirm}
                  onChange={(e) => setAgeConfirm(e.target.checked)}
                  aria-invalid={!!errors.ageConfirm}
                />
                <span>I&apos;m 18 or older.</span>
              </label>
              {errors.ageConfirm && <span className={styles.fieldError}>{errors.ageConfirm}</span>}
            </div>

            <Turnstile onVerify={setTurnstileToken} />
            {errors.turnstile && <span className={styles.fieldError}>{errors.turnstile}</span>}

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={submitting}
            >
              {submitting ? "Sending..." : "Send my application"}
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
