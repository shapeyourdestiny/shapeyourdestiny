"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { updateInstructorCertification } from "@/lib/instructors/self-service";
import { computeCertStatus, formatExpirationDate } from "@/lib/certifications/status";
import styles from "./page.module.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatJoinedDate(dateStr) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export default function ProfileClient({ profile }) {
  const router = useRouter();
  const [cprExpiration, setCprExpiration] = useState(profile.cpr_expiration || null);
  const [foodHandlerExpiration, setFoodHandlerExpiration] = useState(profile.food_handler_expiration || null);
  const [editingCert, setEditingCert] = useState(null);
  const [editDate, setEditDate] = useState("");
  const [noCert, setNoCert] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const initial = profile.full_name?.charAt(0)?.toUpperCase() || "I";

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/instructor-login");
  };

  const openEditModal = (certType) => {
    setEditingCert(certType);
    setEditDate(certType === "cpr" ? cprExpiration || "" : foodHandlerExpiration || "");
    setNoCert(certType === "food_handler" && !foodHandlerExpiration);
    setError("");
  };

  const closeModal = () => {
    setEditingCert(null);
    setEditDate("");
    setNoCert(false);
    setError("");
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");

    const dateValue = noCert ? null : editDate || null;

    const result = await updateInstructorCertification(profile.id, editingCert, dateValue);

    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    // Update local state
    if (editingCert === "cpr") {
      setCprExpiration(dateValue);
    } else {
      setFoodHandlerExpiration(dateValue);
    }

    setSaving(false);
    closeModal();
    router.refresh();
  };

  const cprStatus = computeCertStatus(cprExpiration);
  const foodStatus = computeCertStatus(foodHandlerExpiration);

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

      {/* Certifications Card */}
      <div className={styles.certCard}>
        <h3>Certifications</h3>

        {/* CPR Row */}
        <div className={styles.certRow}>
          <div className={styles.certIcon} style={{ background: "var(--orange-dark)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div className={styles.certInfo}>
            <div className={styles.certName}>CPR Certification</div>
            <div className={styles.certMeta}>{formatExpirationDate(cprExpiration)}</div>
          </div>
          <div className={styles.certRight}>
            {cprStatus ? (
              <span className={`${styles.certStatus} ${styles[cprStatus.className]}`}>
                {cprStatus.label}
              </span>
            ) : (
              <span className={`${styles.certStatus} ${styles.missing}`}>Not on file</span>
            )}
            <button className={styles.certEditBtn} onClick={() => openEditModal("cpr")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Food Handler Row */}
        <div className={styles.certRow}>
          <div className={styles.certIcon} style={{ background: "#B7C1D8" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M3 3h18v4H3zM5 7v13h14V7M9 12h6" />
            </svg>
          </div>
          <div className={styles.certInfo}>
            <div className={styles.certName}>
              Food Handler&apos;s Card <span className={styles.optional}>(optional)</span>
            </div>
            <div className={styles.certMeta}>
              {foodHandlerExpiration ? formatExpirationDate(foodHandlerExpiration) : "Not on file"}
            </div>
          </div>
          <div className={styles.certRight}>
            {foodHandlerExpiration && foodStatus ? (
              <span className={`${styles.certStatus} ${styles[foodStatus.className]}`}>
                {foodStatus.label}
              </span>
            ) : (
              <span className={`${styles.certStatus} ${styles.optionalPill}`}>Optional</span>
            )}
            <button className={styles.certEditBtn} onClick={() => openEditModal("food_handler")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z" />
              </svg>
            </button>
          </div>
        </div>

        <div className={styles.syncNote}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          Updates here save directly, Destiny and Heather see the same info immediately.
        </div>
      </div>

      {/* Logout Button */}
      <button className={styles.logoutBtn} onClick={handleLogout}>
        Log Out
      </button>

      {/* Edit Modal */}
      {editingCert && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.certModal} onClick={(e) => e.stopPropagation()}>
            <h3>
              {editingCert === "cpr" ? "Update CPR Certification" : "Update Food Handler's Card"}
            </h3>

            {editingCert === "food_handler" && (
              <label className={styles.noCertToggle}>
                <input
                  type="checkbox"
                  checked={noCert}
                  onChange={(e) => setNoCert(e.target.checked)}
                />
                I don&apos;t have this certification
              </label>
            )}

            {!noCert && (
              <>
                <label className={styles.fieldLabel}>Expiration Date</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className={styles.dateInput}
                />
              </>
            )}

            {error && <div className={styles.errorText}>{error}</div>}

            <div className={styles.modalActions}>
              <button
                className={styles.cancelBtn}
                onClick={closeModal}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className={styles.saveBtn}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
