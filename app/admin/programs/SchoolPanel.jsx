"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import styles from "./SchoolPanel.module.css";
import {
  createDistrictAction,
  createSchoolAction,
  updateSchoolAction,
  deleteSchoolAction,
} from "@/lib/schedule/actions";

const DISTRICT_COLORS = [
  "#3E8FA0",
  "#6FCB55",
  "#9B59B6",
  "#2C6E7D",
  "#E74C3C",
  "#3498DB",
  "#1ABC9C",
  "#E91E63",
];

export default function SchoolPanel({
  mode = "create",
  schoolId,
  districtId,
  data,
  onClose,
  onSave,
  onDelete,
}) {
  const panelRef = useRef(null);
  const firstFocusRef = useRef(null);
  const triggerRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Find the school for edit mode
  const district = mode === "edit"
    ? data.districts.find((d) => d.id === districtId)
    : null;
  const school = mode === "edit"
    ? district?.schools?.find((s) => s.id === schoolId)
    : null;

  // Form state
  const [name, setName] = useState(school?.name || "");
  const [selectedDistrictId, setSelectedDistrictId] = useState(
    districtId || data.districts[0]?.id || ""
  );
  const [isNewDistrict, setIsNewDistrict] = useState(false);
  const [newDistrictName, setNewDistrictName] = useState("");
  const [newDistrictColor, setNewDistrictColor] = useState(DISTRICT_COLORS[0]);
  const [address, setAddress] = useState(school?.address || "");
  const [instructions, setInstructions] = useState(school?.instructions || "");
  const [officeContact, setOfficeContact] = useState(school?.office_contact || "");
  const [officePhone, setOfficePhone] = useState(school?.office_phone || "");

  // Parse instructions into steps for preview
  const steps = useMemo(() => {
    return (instructions || "")
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }, [instructions]);

  const hasContact = officeContact?.trim();
  const hasPhone = officePhone?.trim();
  const hasInstructions = steps.length > 0;
  const hasAnyContent = hasInstructions || hasContact || hasPhone;

  // Mount state for portal
  useEffect(() => {
    setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect
    triggerRef.current = document.activeElement;
    return () => {
      triggerRef.current?.focus();
    };
  }, []);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Focus management
  useEffect(() => {
    if (mounted && firstFocusRef.current) {
      firstFocusRef.current.focus();
    }
  }, [mounted]);

  // Focus trap
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = panel.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleDistrictChange = (value) => {
    if (value === "new") {
      setIsNewDistrict(true);
      setSelectedDistrictId("");
    } else {
      setIsNewDistrict(false);
      setSelectedDistrictId(value);
    }
  };

  const handleSave = async () => {
    setError(null);

    if (!name.trim()) {
      setError("School name is required");
      return;
    }

    if (mode === "create" && !selectedDistrictId && !isNewDistrict) {
      setError("Please select a district");
      return;
    }

    if (isNewDistrict && !newDistrictName.trim()) {
      setError("New district name is required");
      return;
    }

    setLoading(true);

    try {
      let finalDistrictId = selectedDistrictId;

      // Create new district if needed
      if (isNewDistrict) {
        const result = await createDistrictAction(newDistrictName.trim(), newDistrictColor);
        if (result.error) throw new Error(result.error);
        finalDistrictId = result.id;
      }

      if (mode === "create") {
        await createSchoolAction(finalDistrictId, name.trim(), address.trim() || null);
        // After creating, also update with instructions if provided
        if (instructions.trim() || officeContact.trim() || officePhone.trim()) {
          const res = await fetch("/api/admin/schedule");
          if (res.ok) {
            const newData = await res.json();
            const newSchool = newData.districts
              .flatMap((d) => d.schools || [])
              .find((s) => s.name === name.trim());
            if (newSchool) {
              await updateSchoolAction(newSchool.id, {
                instructions: instructions.trim() || null,
                office_contact: officeContact.trim() || null,
                office_phone: officePhone.trim() || null,
              });
            }
          }
        }
        await onSave(`${name.trim()} added. It will show here once it has a class.`);
      } else {
        await updateSchoolAction(schoolId, {
          name: name.trim(),
          address: address.trim() || null,
          instructions: instructions.trim() || null,
          office_contact: officeContact.trim() || null,
          office_phone: officePhone.trim() || null,
        });
        await onSave();
      }
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

  if (!mounted) return null;

  const isEdit = mode === "edit";
  const title = isEdit ? (school?.name || "Edit school") : "Add a school";
  const subtitle = isEdit
    ? "Edit school details. Changes show for instructors right away."
    : "Only schools with classes show on Programs. Add a class here after you save.";
  const canSave = name.trim() && (selectedDistrictId || (isNewDistrict && newDistrictName.trim()));

  return createPortal(
    <div
      className={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="school-panel-title"
    >
      <div
        className={styles.panel}
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerText}>
            <h2 id="school-panel-title">{title}</h2>
            <p className={styles.headerSubtitle}>{subtitle}</p>
          </div>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Left column - fields */}
          <div className={styles.fieldsColumn}>
            {error && <div className={styles.error}>{error}</div>}

            {/* School name and district */}
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label}>School name</label>
                <input
                  ref={firstFocusRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Lincoln Elementary"
                  className={styles.input}
                />
              </div>
              {!isEdit && (
                <div className={styles.field}>
                  <label className={styles.label}>District</label>
                  <select
                    value={isNewDistrict ? "new" : selectedDistrictId}
                    onChange={(e) => handleDistrictChange(e.target.value)}
                    className={styles.select}
                  >
                    {data.districts.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                    <option value="new">+ New district</option>
                  </select>
                </div>
              )}
            </div>

            {/* New district row */}
            {isNewDistrict && (
              <div className={styles.newDistrictRow}>
                <div className={styles.field}>
                  <label className={styles.label}>New district name</label>
                  <input
                    type="text"
                    value={newDistrictName}
                    onChange={(e) => setNewDistrictName(e.target.value)}
                    placeholder="e.g., Fontana"
                    className={styles.input}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Color</label>
                  <div className={styles.colorPicker}>
                    {DISTRICT_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`${styles.colorSwatch} ${newDistrictColor === color ? styles.colorSelected : ""}`}
                        style={{ background: color }}
                        onClick={() => setNewDistrictColor(color)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Address */}
            <div className={styles.field}>
              <label className={styles.label}>Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g., 123 Main St, City, CA 90210"
                className={styles.input}
              />
              <span className={styles.hint}>Powers the Directions button.</span>
            </div>

            {/* Instructions */}
            <div className={styles.field}>
              <label className={styles.label}>
                Arrival instructions <span className={styles.optional}>(optional)</span>
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="One step per line, e.g. Check in at the front office"
                rows={5}
                className={styles.textarea}
              />
            </div>

            {/* Contact info */}
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label}>
                  Front office contact <span className={styles.optional}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={officeContact}
                  onChange={(e) => setOfficeContact(e.target.value)}
                  placeholder="e.g., Ms. Lopez"
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>
                  Phone <span className={styles.optional}>(optional)</span>
                </label>
                <input
                  type="tel"
                  value={officePhone}
                  onChange={(e) => setOfficePhone(e.target.value)}
                  placeholder="(909) 555-0123"
                  className={styles.input}
                />
              </div>
            </div>
          </div>

          {/* Right column - preview */}
          <div className={styles.previewColumn}>
            <div className={styles.previewLabel}>WHAT INSTRUCTORS SEE</div>

            {/* School card preview */}
            <div className={styles.previewCard}>
              <div className={styles.previewSchoolName}>
                {name.trim() || <span className={styles.previewPlaceholder}>School name</span>}
              </div>
              {address.trim() ? (
                <div className={styles.previewAddress}>{address}</div>
              ) : (
                <div className={styles.previewPlaceholder}>Address shows here</div>
              )}
              {address.trim() && (
                <button className={styles.previewDirections} type="button">
                  Directions
                </button>
              )}
            </div>

            {/* Instructions preview */}
            {hasAnyContent ? (
              <div className={styles.previewInstructions}>
                <div className={styles.previewInstructionsHeader}>SCHOOL INSTRUCTIONS</div>
                {hasInstructions && (
                  <div className={styles.previewSteps}>
                    {steps.map((step, i) => (
                      <div key={i} className={styles.previewStep}>
                        <span className={styles.stepNumber}>{i + 1}</span>
                        <span className={styles.stepText}>{step}</span>
                      </div>
                    ))}
                  </div>
                )}
                {(hasContact || hasPhone) && (
                  <div className={styles.previewContact}>
                    <div className={styles.contactLeft}>
                      <span className={styles.contactLabel}>Front office</span>
                      {hasContact && (
                        <span className={styles.contactName}>Ask for {officeContact.trim()}</span>
                      )}
                    </div>
                    {hasPhone && (
                      <span className={styles.contactCall}>Call</span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.previewEmpty}>
                No instructions yet. Instructors just get the address and Directions.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          {isEdit && (
            <button
              className={styles.deleteBtn}
              onClick={handleDelete}
              disabled={loading}
            >
              Delete school
            </button>
          )}
          <div className={styles.footerRight}>
            <button
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              className={styles.saveBtn}
              onClick={handleSave}
              disabled={loading || !canSave}
            >
              {loading ? "Saving..." : isEdit ? "Save school" : "Add school"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
