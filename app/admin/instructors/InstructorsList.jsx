"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import styles from "./InstructorsList.module.css";
import AddInstructorModal from "./AddInstructorModal";
import { formatPhone } from "@/lib/format";

const AVATAR_COLORS = [
  "#3E8FA0",
  "#6FCB55",
  "#3FC0E8",
  "#2B4FA3",
  "#2C6E7D",
  "#1F3F91",
];

function getAvatarColor(name) {
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitials(name) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatSessionDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr + "T00:00:00");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}

export default function InstructorsList({ instructors }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const router = useRouter();

  // Count instructors by status
  const statusCounts = useMemo(() => {
    const counts = { all: 0, active: 0, invited: 0, archived: 0, not_invited: 0 };
    instructors.forEach((inst) => {
      counts.all++;
      counts[inst.status] = (counts[inst.status] || 0) + 1;
    });
    // Combine not_invited + invited as "Pending"
    counts.pending = (counts.not_invited || 0) + (counts.invited || 0);
    return counts;
  }, [instructors]);

  const filteredInstructors = useMemo(() => {
    return instructors.filter((inst) => {
      // Search filter - matches name, email, phone, or school
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        q === "" ||
        inst.full_name.toLowerCase().includes(q) ||
        (inst.email && inst.email.toLowerCase().includes(q)) ||
        (inst.phone && inst.phone.includes(q)) ||
        (inst.teachesAt && inst.teachesAt.toLowerCase().includes(q));

      // Status filter
      let matchesStatus = statusFilter === "all" || inst.status === statusFilter;
      // "pending" matches both "invited" and "not_invited"
      if (statusFilter === "pending") {
        matchesStatus = inst.status === "invited" || inst.status === "not_invited";
      }

      return matchesSearch && matchesStatus;
    });
  }, [instructors, searchQuery, statusFilter]);

  const handleRowClick = (id) => {
    router.push(`/admin/instructors/${id}`);
  };

  const handleOpenAddModal = () => {
    setAddModalOpen(true);
  };

  const handleCloseAddModal = () => {
    setAddModalOpen(false);
  };

  const handleInstructorAdded = (profileId) => {
    setAddModalOpen(false);
    router.refresh();
    // Navigate to the new instructor's profile
    if (profileId) {
      router.push(`/admin/instructors/${profileId}`);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.controlsRow}>
        <div className={styles.searchWrap}>
          <svg
            className={styles.searchIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search name, email, phone, or school..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className={styles.filterRow}>
          <div className={styles.statusFilter}>
            {[
              ["all", "All"],
              ["active", "Active"],
              ["pending", "Pending"],
              ["archived", "Archived"],
            ].map(([status, label]) => (
              <button
                key={status}
                type="button"
                className={`${styles.filterPill} ${statusFilter === status ? styles.filterPillActive : ""}`}
                onClick={() => setStatusFilter(status)}
              >
                {label}
                <span className={styles.pillCount}>{statusCounts[status]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.addBtn}
            onClick={handleOpenAddModal}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add instructor
          </button>
          <a
            href="/our-team"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.viewBtn}
          >
            View staff page
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
            </svg>
          </a>
        </div>
      </div>

      <div className={styles.listCard}>
        <div className={styles.listHead}>
          <span>Instructor</span>
          <span>Contact</span>
          <span>Teaches at</span>
          <span>Next class</span>
          <span>Status</span>
        </div>
        <div className={styles.listBody}>
          {filteredInstructors.length === 0 ? (
            <div className={styles.emptyRow}>
              <p>No instructors found.</p>
            </div>
          ) : (
            filteredInstructors.map((instructor) => (
              <div
                key={instructor.id}
                className={styles.listRow}
                onClick={() => handleRowClick(instructor.id)}
              >
                {/* Instructor column */}
                <div className={styles.nameCell}>
                  {instructor.headshotUrl ? (
                    <img
                      src={instructor.headshotUrl}
                      alt=""
                      className={styles.avatarImg}
                    />
                  ) : (
                    <div
                      className={styles.avatar}
                      style={{ background: getAvatarColor(instructor.full_name) }}
                    >
                      {getInitials(instructor.full_name)}
                    </div>
                  )}
                  <span className={styles.nameText}>
                    {instructor.needsAttention && (
                      <span className={styles.attentionDot} aria-label="Needs attention" />
                    )}
                    {instructor.full_name}
                    {instructor.role === "admin" && (
                      <span className={styles.adminBadge}>Admin</span>
                    )}
                  </span>
                </div>

                {/* Contact column */}
                <div className={styles.contactCell}>
                  {instructor.email && (
                    <div className={styles.contactRow}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <path d="M3 7l9 6 9-6" />
                      </svg>
                      <span>{instructor.email}</span>
                    </div>
                  )}
                  {instructor.phone && (
                    <div className={styles.contactRow}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                      </svg>
                      <span>{formatPhone(instructor.phone)}</span>
                    </div>
                  )}
                  {!instructor.email && !instructor.phone && (
                    <span className={styles.noContact}>—</span>
                  )}
                </div>

                {/* Teaches at column */}
                <div className={styles.teachesAtCell}>
                  {instructor.teachesAt || "—"}
                </div>

                {/* Next class column */}
                <div className={styles.nextClassCell}>
                  {instructor.nextClass ? (
                    <>
                      <span className={styles.nextClassDate}>
                        {formatSessionDate(instructor.nextClass.date)}
                      </span>
                      <span className={styles.nextClassTime}>
                        {instructor.nextClass.time}
                      </span>
                    </>
                  ) : (
                    <span className={styles.noNext}>—</span>
                  )}
                </div>

                {/* Status column */}
                <div className={styles.statusCell}>
                  <span className={`${styles.statusBadge} ${styles[instructor.status === "not_invited" ? "invited" : instructor.status]}`}>
                    {instructor.status === "not_invited" ? "Not invited" :
                     instructor.status.charAt(0).toUpperCase() + instructor.status.slice(1)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Instructor Modal */}
      {addModalOpen && (
        <AddInstructorModal
          onClose={handleCloseAddModal}
          onSuccess={handleInstructorAdded}
        />
      )}

      {/* Scrim */}
      {addModalOpen && (
        <div
          className={styles.scrim}
          onClick={handleCloseAddModal}
        />
      )}
    </div>
  );
}
