"use client";

import { useState, useRef, useEffect } from "react";
import styles from "./SlotMenu.module.css";
import BottomSheet from "./BottomSheet";
import { SlotStatus } from "@/lib/schedule/session-staff";
import { deleteSessionChangeAction } from "@/lib/schedule/actions";

/**
 * Slot menu popover for instructor slot actions.
 * Shows different options based on slot state.
 */
export default function SlotMenu({
  open,
  anchorRect,
  cls,
  slotType,
  slotState,
  date,
  isMobile,
  onClose,
  onMarkOut,
  onRefresh,
}) {
  const popoverRef = useRef(null);
  const [loading, setLoading] = useState(false);

  // Close on escape or click outside
  useEffect(() => {
    if (!open || isMobile) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };

    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, isMobile, onClose]);

  if (!open || !slotState) return null;

  const { status, actualInstructor, absentInstructor, sessionChangeId } = slotState;

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  // Handle "is back" action (delete session change)
  const handleIsBack = async () => {
    if (!sessionChangeId || loading) return;
    setLoading(true);
    try {
      await deleteSessionChangeAction(sessionChangeId);
      await onRefresh();
      onClose();
    } catch (err) {
      console.error("Failed to mark instructor as back:", err);
    } finally {
      setLoading(false);
    }
  };

  // Build menu options based on slot state
  const renderMenuOptions = () => {
    const dateDisplay = formatDate(date);

    // Normal slot - regular instructor teaching
    if (status === SlotStatus.NORMAL && actualInstructor) {
      return (
        <>
          <button
            className={styles.menuOption}
            onClick={() => onMarkOut(cls, slotType, date, actualInstructor)}
          >
            <span className={styles.optionText}>Mark out for {dateDisplay}</span>
          </button>
          <button
            className={styles.menuOption}
            onClick={() => onMarkOut(cls, slotType, date, actualInstructor)}
          >
            <span className={styles.optionText}>Swap for {dateDisplay} only</span>
          </button>
          <div className={styles.menuDivider} />
          <a
            href={`/admin/programs?class=${cls.id}`}
            className={`${styles.menuOption} ${styles.dangerOption}`}
          >
            <span className={styles.optionText}>Remove from this class</span>
          </a>
        </>
      );
    }

    // Sub slot - substitute teaching
    if (status === SlotStatus.SUB && actualInstructor) {
      const firstName = absentInstructor?.full_name?.split(" ")[0] || "them";
      return (
        <>
          <button
            className={styles.menuOption}
            onClick={() => onMarkOut(cls, slotType, date, absentInstructor)}
          >
            <span className={styles.optionText}>Change the sub</span>
          </button>
          <button
            className={styles.menuOption}
            onClick={handleIsBack}
            disabled={loading}
          >
            <span className={styles.optionText}>
              {loading ? "Updating..." : `${firstName} is back`}
            </span>
          </button>
        </>
      );
    }

    // One-time slot - temp assignment
    if (status === SlotStatus.ONE_TIME && actualInstructor) {
      return (
        <>
          <button
            className={styles.menuOption}
            onClick={handleIsBack}
            disabled={loading}
          >
            <span className={styles.optionText}>
              {loading ? "Removing..." : "Remove one-time assignment"}
            </span>
          </button>
        </>
      );
    }

    // Empty slot - no one assigned
    if (status === SlotStatus.EMPTY) {
      return (
        <>
          <a
            href={`/admin/programs?class=${cls.id}`}
            className={styles.menuOption}
          >
            <span className={styles.optionText}>Assign every week</span>
          </a>
          <button
            className={styles.menuOption}
            onClick={() => onMarkOut(cls, slotType, date, null)}
          >
            <span className={styles.optionText}>Just {dateDisplay}</span>
          </button>
        </>
      );
    }

    return null;
  };

  // Mobile: use bottom sheet
  if (isMobile) {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title={actualInstructor?.full_name || "Slot options"}
      >
        <div className={styles.mobileMenu}>
          {renderMenuOptions()}
        </div>
      </BottomSheet>
    );
  }

  // Desktop: popover
  const popoverStyle = {
    position: "fixed",
    top: anchorRect?.bottom + 8 || 0,
    left: anchorRect?.left || 0,
    minWidth: 270,
  };

  // Adjust if popover would go off-screen
  if (anchorRect) {
    if (anchorRect.left + 270 > window.innerWidth) {
      popoverStyle.left = window.innerWidth - 280;
    }
    if (anchorRect.bottom + 200 > window.innerHeight) {
      popoverStyle.top = anchorRect.top - 180;
    }
  }

  return (
    <div
      className={styles.popover}
      style={popoverStyle}
      ref={popoverRef}
      role="menu"
    >
      <div className={styles.popoverHeader}>
        {actualInstructor ? (
          <span className={styles.instructorName}>{actualInstructor.full_name}</span>
        ) : absentInstructor ? (
          <span className={styles.instructorName}>{absentInstructor.full_name} (out)</span>
        ) : (
          <span className={styles.emptyTitle}>Empty slot</span>
        )}
      </div>
      <div className={styles.popoverContent}>
        {renderMenuOptions()}
      </div>
    </div>
  );
}
