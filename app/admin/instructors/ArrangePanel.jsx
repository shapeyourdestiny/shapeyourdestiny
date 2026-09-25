"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./ArrangePanel.module.css";
import { updateStaffSortOrderAction } from "@/lib/staff/actions";

export default function ArrangePanel({ leadership, instructors, onClose }) {
  const router = useRouter();
  const [leadershipOrder, setLeadershipOrder] = useState(leadership.map((l) => l.id));
  const [instructorOrder, setInstructorOrder] = useState(instructors.map((i) => i.id));
  const [saving, setSaving] = useState(false);
  const [dragItem, setDragItem] = useState(null);
  const [dragSection, setDragSection] = useState(null);

  const leadershipList = leadershipOrder.map((id) => leadership.find((l) => l.id === id)).filter(Boolean);
  const instructorList = instructorOrder.map((id) => instructors.find((i) => i.id === id)).filter(Boolean);

  const handleDragStart = (e, id, section) => {
    setDragItem(id);
    setDragSection(section);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, targetId, section) => {
    e.preventDefault();
    if (dragSection !== section) return;

    const order = section === "leadership" ? [...leadershipOrder] : [...instructorOrder];
    const setOrder = section === "leadership" ? setLeadershipOrder : setInstructorOrder;

    const dragIndex = order.indexOf(dragItem);
    const targetIndex = order.indexOf(targetId);

    if (dragIndex === targetIndex) return;

    order.splice(dragIndex, 1);
    order.splice(targetIndex, 0, dragItem);
    setOrder(order);
  };

  const handleDragEnd = () => {
    setDragItem(null);
    setDragSection(null);
  };

  const handleSave = async () => {
    setSaving(true);

    // Build the sort order updates
    const updates = [];
    leadershipOrder.forEach((id, index) => {
      updates.push({ id, sort_order: index });
    });
    instructorOrder.forEach((id, index) => {
      updates.push({ id, sort_order: index + 1000 }); // Offset to ensure leadership comes first
    });

    const result = await updateStaffSortOrderAction(updates);
    setSaving(false);

    if (result.error) {
      alert(result.error);
    } else {
      router.refresh();
      onClose();
    }
  };

  return (
    <aside className={styles.panel} aria-label="Arrange staff page">
      <div className={styles.header}>
        <h2>Arrange staff page</h2>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <p className={styles.intro}>
        Drag to reorder. Only people currently live on the staff page are shown here.
      </p>

      <div className={styles.content}>
        {/* Leadership Section */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Leadership</h3>
          {leadershipList.length === 0 ? (
            <p className={styles.empty}>No leadership members are live on the staff page.</p>
          ) : (
            <div className={styles.list}>
              {leadershipList.map((person) => (
                <div
                  key={person.id}
                  className={`${styles.item} ${dragItem === person.id ? styles.dragging : ""}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, person.id, "leadership")}
                  onDragOver={(e) => handleDragOver(e, person.id, "leadership")}
                  onDragEnd={handleDragEnd}
                >
                  <div className={styles.dragHandle}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="9" cy="6" r="1.5" />
                      <circle cx="15" cy="6" r="1.5" />
                      <circle cx="9" cy="12" r="1.5" />
                      <circle cx="15" cy="12" r="1.5" />
                      <circle cx="9" cy="18" r="1.5" />
                      <circle cx="15" cy="18" r="1.5" />
                    </svg>
                  </div>
                  <div className={styles.itemAvatar}>
                    {person.headshotUrl ? (
                      <img src={person.headshotUrl} alt="" />
                    ) : (
                      <span>{person.full_name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}</span>
                    )}
                  </div>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{person.display_name || person.full_name}</span>
                    <span className={styles.itemTitle}>{person.title || "No title"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructors Section */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Instructors</h3>
          {instructorList.length === 0 ? (
            <p className={styles.empty}>No instructors are live on the staff page.</p>
          ) : (
            <div className={styles.list}>
              {instructorList.map((person) => (
                <div
                  key={person.id}
                  className={`${styles.item} ${dragItem === person.id ? styles.dragging : ""}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, person.id, "instructor")}
                  onDragOver={(e) => handleDragOver(e, person.id, "instructor")}
                  onDragEnd={handleDragEnd}
                >
                  <div className={styles.dragHandle}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="9" cy="6" r="1.5" />
                      <circle cx="15" cy="6" r="1.5" />
                      <circle cx="9" cy="12" r="1.5" />
                      <circle cx="15" cy="12" r="1.5" />
                      <circle cx="9" cy="18" r="1.5" />
                      <circle cx="15" cy="18" r="1.5" />
                    </svg>
                  </div>
                  <div className={styles.itemAvatar}>
                    {person.headshotUrl ? (
                      <img src={person.headshotUrl} alt="" />
                    ) : (
                      <span>{person.full_name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}</span>
                    )}
                  </div>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{person.display_name || person.full_name}</span>
                    <span className={styles.itemTitle}>{person.title || "No title"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.cancelBtn}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className={styles.saveBtn}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save order"}
        </button>
      </div>
    </aside>
  );
}
