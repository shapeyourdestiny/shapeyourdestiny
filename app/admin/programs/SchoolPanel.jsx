"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./SchoolPanel.module.css";
import SchoolDetailsFields from "../components/SchoolDetailsFields";
import { updateSchoolAction, deleteSchoolAction } from "@/lib/schedule/actions";

export default function SchoolPanel({
  schoolId,
  districtId,
  data,
  onClose,
  onSave,
  onDelete,
}) {
  const panelRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Find the school
  const district = data.districts.find((d) => d.id === districtId);
  const school = district?.schools?.find((s) => s.id === schoolId);

  // Form state
  const [name, setName] = useState(school?.name || "");
  const [address, setAddress] = useState(school?.address || "");
  const [instructions, setInstructions] = useState(school?.instructions || "");
  const [officeContact, setOfficeContact] = useState(school?.office_contact || "");
  const [officePhone, setOfficePhone] = useState(school?.office_phone || "");

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Focus trap
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const firstFocusable = panel.querySelector("button, input, select, textarea");
    firstFocusable?.focus();
  }, []);

  const handleSave = async () => {
    setError(null);

    if (!name.trim()) {
      setError("School name is required");
      return;
    }

    setLoading(true);

    try {
      await updateSchoolAction(schoolId, {
        name: name.trim(),
        address: address.trim() || null,
        instructions: instructions.trim() || null,
        office_contact: officeContact.trim() || null,
        office_phone: officePhone.trim() || null,
      });
      await onSave();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const classCount = school?.classes?.length || 0;
    const message = classCount > 0
      ? `Delete ${school.name}? This will also delete ${classCount} class${classCount === 1 ? "" : "es"}. This cannot be undone.`
      : `Delete ${school.name}? This cannot be undone.`;

    if (!confirm(message)) return;

    setLoading(true);
    try {
      await deleteSchoolAction(schoolId);
      await onDelete();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to delete");
    } finally {
      setLoading(false);
    }
  };

  if (!school) {
    return null;
  }

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.panel} ref={panelRef}>
        <div className={styles.header}>
          <h2>Edit school</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.content}>
          {error && <div className={styles.error}>{error}</div>}

          {/* District info */}
          <div className={styles.districtInfo}>
            <span className={styles.districtDot} style={{ background: district?.color }} />
            <span className={styles.districtName}>{district?.name}</span>
          </div>

          {/* School name */}
          <div className={styles.field}>
            <label>School name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Lincoln Elementary"
            />
          </div>

          {/* School details (address, instructions, contact) */}
          <div className={styles.detailsSection}>
            <h3>Details for instructors</h3>
            <SchoolDetailsFields
              address={address}
              onAddressChange={setAddress}
              instructions={instructions}
              onInstructionsChange={setInstructions}
              officeContact={officeContact}
              onOfficeContactChange={setOfficeContact}
              officePhone={officePhone}
              onOfficePhoneChange={setOfficePhone}
            />
          </div>

          {/* Classes info */}
          {school.classes && school.classes.length > 0 && (
            <div className={styles.classesInfo}>
              <h3>Classes at this school</h3>
              <p>
                {school.classes.length} class{school.classes.length === 1 ? "" : "es"} scheduled.
                Edit classes from the main list.
              </p>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button
            className={styles.deleteBtn}
            onClick={handleDelete}
            disabled={loading}
          >
            Delete school
          </button>
          <div className={styles.footerRight}>
            <button className={styles.cancelBtn} onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button
              className={styles.saveBtn}
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
