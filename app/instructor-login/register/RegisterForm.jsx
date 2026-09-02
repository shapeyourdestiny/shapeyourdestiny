"use client";

import { useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "../page.module.css";

export default function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef(null);

  // Prefill invite code from URL
  const [inviteCode, setInviteCode] = useState(() => searchParams.get("code") || "");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cprExpires, setCprExpires] = useState("");
  const [foodHandlerExpires, setFoodHandlerExpires] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setError("Please upload a JPEG, PNG, or WebP image.");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Photo must be under 5MB.");
      return;
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError("");
  };

  const removePhoto = () => {
    setPhotoFile(null);
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validate photo is required
    if (!photoFile) {
      setError("Please upload a profile photo.");
      return;
    }

    setLoading(true);

    try {
      // First, upload the photo
      const formData = new FormData();
      formData.append("file", photoFile);
      formData.append("inviteCode", inviteCode.trim());

      const uploadRes = await fetch("/api/auth/upload-avatar", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        setError(uploadData.error || "Failed to upload photo.");
        setLoading(false);
        return;
      }

      // Now call the registration API with the avatar URL
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
          avatarUrl: uploadData.url,
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

      {/* Profile Photo Upload */}
      <div className={styles.field}>
        <label>Profile Photo <span className={styles.required}>*</span></label>
        <p className={styles.photoHint}>
          This photo will be visible to other instructors and admin.
        </p>
        {photoPreview ? (
          <div className={styles.photoPreview}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoPreview} alt="Preview" className={styles.photoThumb} />
            <div className={styles.photoInfo}>
              <span className={styles.photoName}>{photoFile?.name}</span>
              <button type="button" className={styles.photoRemove} onClick={removePhoto}>
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div
            className={styles.photoDropzone}
            onClick={() => fileInputRef.current?.click()}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="8" r="4" />
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            </svg>
            <span>Click to upload your photo</span>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handlePhotoSelect}
          style={{ display: "none" }}
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
