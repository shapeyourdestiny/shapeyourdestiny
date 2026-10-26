"use client";

import styles from "./SchoolDetailsFields.module.css";

/**
 * Reusable component for editing school details (address, instructions, contact).
 * Used in ManageModal and can be reused on a future Programs page.
 */
export default function SchoolDetailsFields({
  address,
  onAddressChange,
  instructions,
  onInstructionsChange,
  officeContact,
  onOfficeContactChange,
  officePhone,
  onOfficePhoneChange,
}) {
  // Parse instructions into steps for preview
  const steps = (instructions || "")
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const hasContact = officeContact?.trim();
  const hasPhone = officePhone?.trim();
  const hasInstructions = steps.length > 0;
  const hasAnyContent = hasInstructions || hasContact || hasPhone;

  return (
    <div className={styles.container}>
      {/* Address */}
      <div className={styles.field}>
        <label className={styles.label}>Address</label>
        <input
          type="text"
          value={address || ""}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder="e.g., 123 Main St, City, CA 90210"
          className={styles.input}
        />
        <span className={styles.hint}>Powers the Directions button.</span>
      </div>

      {/* Instructions */}
      <div className={styles.field}>
        <label className={styles.label}>Instructions for instructors</label>
        <textarea
          value={instructions || ""}
          onChange={(e) => onInstructionsChange(e.target.value)}
          placeholder="One step per line, e.g. Check in at the front office"
          rows={6}
          className={styles.textarea}
        />
        <span className={styles.hint}>
          One step per line. Each line becomes a numbered step. Leave it empty and the section will not show.
        </span>
      </div>

      {/* Front office contact */}
      <div className={styles.field}>
        <label className={styles.label}>Front office contact (optional)</label>
        <div className={styles.row}>
          <input
            type="text"
            value={officeContact || ""}
            onChange={(e) => onOfficeContactChange(e.target.value)}
            placeholder="e.g., Ms. Lopez"
            className={styles.input}
          />
          <input
            type="tel"
            value={officePhone || ""}
            onChange={(e) => onOfficePhoneChange(e.target.value)}
            placeholder="(909) 555-0123"
            className={styles.input}
          />
        </div>
        <span className={styles.hint}>
          No phone, no Call button. Instructors only see what you fill in.
        </span>
      </div>

      {/* Live preview */}
      <div className={styles.previewSection}>
        <label className={styles.previewLabel}>What instructors see</label>
        {hasAnyContent ? (
          <div className={styles.previewBox}>
            <div className={styles.previewHeader}>SCHOOL INSTRUCTIONS</div>
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
            Nothing yet. Instructors will just see the address and Directions button.
          </div>
        )}
      </div>
    </div>
  );
}
