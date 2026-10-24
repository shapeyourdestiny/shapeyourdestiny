"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  uploadMyHeadshot,
  removeMyHeadshot,
} from "@/lib/instructors/self-service";
import styles from "./page.module.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatJoinedDate(dateStr) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export default function ProfileClient({ profile }) {
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [headshotUrl, setHeadshotUrl] = useState(profile.headshotUrl || null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");

  const initial = profile.full_name?.charAt(0)?.toUpperCase() || "I";

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/instructor-login");
  };

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    setPhotoError("");

    const formData = new FormData();
    formData.append("headshot", file);

    const result = await uploadMyHeadshot(profile.id, formData);

    if (result.error) {
      setPhotoError(result.error);
      setUploadingPhoto(false);
      return;
    }

    setUploadingPhoto(false);
    router.refresh();
  };

  const handleRemovePhoto = async () => {
    setUploadingPhoto(true);
    setPhotoError("");

    const result = await removeMyHeadshot(profile.id);

    if (result.error) {
      setPhotoError(result.error);
      setUploadingPhoto(false);
      return;
    }

    setHeadshotUrl(null);
    setUploadingPhoto(false);
    router.refresh();
  };

  return (
    <div className={styles.page}>
      {/* Hero */}
      <div className={styles.profileHero}>
        <div className={styles.avatar}>{initial}</div>
        <h1 className={styles.profileName}>{profile.full_name}</h1>
        <span className={styles.rolePill}>Instructor</span>
      </div>

      {/* Stats */}
      <div className={styles.statRow}>
        <div className={styles.statCard}>
          <div className={styles.statNum}>{profile.sessionCount}</div>
          <div className={styles.statLabel}>Sessions Taught</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNum}>{profile.districtCount}</div>
          <div className={styles.statLabel}>Districts</div>
        </div>
      </div>

      {/* Info Card */}
      <div className={styles.infoCard}>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Email</span>
          <span className={styles.infoValue}>{profile.email}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Joined</span>
          <span className={styles.infoValue}>{formatJoinedDate(profile.created_at)}</span>
        </div>
      </div>

      {/* Profile Photo Card */}
      <div className={styles.photoCard}>
        <h3>Profile Photo</h3>

        {photoError && <div className={styles.photoError}>{photoError}</div>}

        <div className={styles.photoPreviewLarge}>
          {headshotUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={headshotUrl} alt={profile.full_name} />
          ) : (
            <span>{initial}</span>
          )}
        </div>

        <div className={styles.photoButtonRow}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoSelect}
            style={{ display: "none" }}
          />
          <button
            className={styles.uploadPhotoBtn}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPhoto}
          >
            {uploadingPhoto ? "Uploading..." : headshotUrl ? "Change Photo" : "Upload Photo"}
          </button>
          {headshotUrl && (
            <button
              className={styles.removePhotoBtn}
              onClick={handleRemovePhoto}
              disabled={uploadingPhoto}
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Logout Button */}
      <button className={styles.logoutBtn} onClick={handleLogout}>
        Log Out
      </button>
    </div>
  );
}
