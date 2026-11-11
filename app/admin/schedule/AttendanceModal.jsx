"use client";

import { useState, useEffect } from "react";
import styles from "./AttendanceModal.module.css";
import BottomSheet from "./BottomSheet";
import { markAttendance } from "@/lib/team-events/actions";

export default function AttendanceModal({ open, onClose, event, onSave }) {
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(false);

  // Initialize attendance from event people
  useEffect(() => {
    if (open && event?.people) {
      const initial = {};
      event.people.forEach((p) => {
        // Pre-fill with existing attendance data, or use RSVP as hint
        if (p.attended !== null) {
          initial[p.profile_id] = p.attended;
        } else if (p.rsvp === "yes") {
          initial[p.profile_id] = true;
        } else if (p.rsvp === "no") {
          initial[p.profile_id] = false;
        }
      });
      setAttendance(initial);
    }
  }, [open, event]);

  const handleToggle = (profileId) => {
    setAttendance((prev) => ({
      ...prev,
      [profileId]: !prev[profileId],
    }));
  };

  const handleMarkAll = (value) => {
    const newAttendance = {};
    event.people.forEach((p) => {
      newAttendance[p.profile_id] = value;
    });
    setAttendance(newAttendance);
  };

  const handleSave = async () => {
    if (loading) return;
    setLoading(true);

    try {
      // Fill in any undefined as false
      const finalAttendance = {};
      event.people.forEach((p) => {
        finalAttendance[p.profile_id] = attendance[p.profile_id] ?? false;
      });

      await markAttendance(event.id, finalAttendance);
      onSave?.();
      onClose();
    } catch (err) {
      console.error("Error marking attendance:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!event) return null;

  const people = event.people || [];
  const attendedCount = Object.values(attendance).filter(Boolean).length;

  const content = (
    <div className={styles.content}>
      <p className={styles.description}>
        Mark who attended <strong>{event.title}</strong>. Only people marked as attended will be paid.
      </p>

      {/* Quick actions */}
      <div className={styles.quickActions}>
        <button
          className={styles.quickBtn}
          onClick={() => handleMarkAll(true)}
        >
          Mark all attended
        </button>
        <button
          className={styles.quickBtn}
          onClick={() => handleMarkAll(false)}
        >
          Mark all absent
        </button>
      </div>

      {/* People list */}
      <div className={styles.peopleList}>
        {people.map((person) => {
          const isAttended = attendance[person.profile_id] ?? false;
          return (
            <button
              key={person.profile_id}
              className={`${styles.personRow} ${isAttended ? styles.attended : ""}`}
              onClick={() => handleToggle(person.profile_id)}
            >
              <div className={styles.checkbox}>
                {isAttended && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <div className={styles.personAvatar}>
                {person.profile?.avatar_url ? (
                  <img src={person.profile.avatar_url} alt="" />
                ) : (
                  <span>{person.profile?.full_name?.charAt(0) || "?"}</span>
                )}
              </div>
              <div className={styles.personInfo}>
                <span className={styles.personName}>{person.profile?.full_name}</span>
                <span className={styles.personRsvp}>
                  RSVP: {person.rsvp === "yes" ? "Coming" : person.rsvp === "no" ? "Can't" : "No answer"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <span className={styles.summary}>
          {attendedCount} of {people.length} attended
        </span>
        <div className={styles.footerButtons}>
          <button className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save attendance"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <BottomSheet open={open} onClose={onClose} title="Mark attendance">
      {content}
    </BottomSheet>
  );
}
