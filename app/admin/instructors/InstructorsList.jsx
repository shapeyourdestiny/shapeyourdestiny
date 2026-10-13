"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import styles from "./InstructorsList.module.css";
import InstructorDrawer from "./InstructorDrawer";
import AddInstructorModal from "./AddInstructorModal";

const AVATAR_COLORS = [
  "#D8AE4B",
  "#6FCB55",
  "#3FC0E8",
  "#2B4FA3",
  "#3E8FA0",
  "#F2A65E",
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

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export default function InstructorsList({ instructors, districts = [] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const router = useRouter();

  // Count instructors by status
  const statusCounts = useMemo(() => {
    const counts = { all: 0, active: 0, invited: 0, archived: 0, not_invited: 0 };
    instructors.forEach((inst) => {
      counts.all++;
      counts[inst.status] = (counts[inst.status] || 0) + 1;
    });
    // Combine not_invited + invited as "Pending" for simplicity
    counts.pending = (counts.not_invited || 0) + (counts.invited || 0);
    return counts;
  }, [instructors]);

  const filteredInstructors = useMemo(() => {
    return instructors.filter((inst) => {
      // Search filter - matches name or district
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        q === "" ||
        inst.full_name.toLowerCase().includes(q) ||
        inst.districts.toLowerCase().includes(q);

      // Status filter
      let matchesStatus = statusFilter === "all" || inst.status === statusFilter;
      // "pending" matches both "invited" and "not_invited"
      if (statusFilter === "pending") {
        matchesStatus = inst.status === "invited" || inst.status === "not_invited";
      }

      return matchesSearch && matchesStatus;
    });
  }, [instructors, searchQuery, statusFilter]);

  const selectedInstructor = useMemo(() => {
    return instructors.find((i) => i.id === selectedId) || null;
  }, [instructors, selectedId]);

  const handleRowClick = (id) => {
    setSelectedId(id);
  };

  const handleCloseDrawer = () => {
    setSelectedId(null);
  };

  const handleOpenAddModal = () => {
    setSelectedId(null);
    setAddModalOpen(true);
  };

  const handleCloseAddModal = () => {
    setAddModalOpen(false);
  };

  const handleInstructorAdded = (profileId) => {
    setAddModalOpen(false);
    router.refresh();
    // Optionally open the drawer for the new instructor
    if (profileId) {
      setSelectedId(profileId);
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
            placeholder="Search name or district..."
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
          <span>Status</span>
          <span>District(s)</span>
          <span>Sessions</span>
          <span>Joined</span>
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
                className={`${styles.listRow} ${selectedId === instructor.id ? styles.listRowSelected : ""}`}
                onClick={() => handleRowClick(instructor.id)}
              >
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
                    {instructor.full_name}
                    {instructor.role === "admin" && (
                      <span className={styles.adminBadge}>Admin</span>
                    )}
                  </span>
                </div>
                <span>
                  <span className={`${styles.statusBadge} ${styles[instructor.status === "not_invited" ? "invited" : instructor.status]}`}>
                    {instructor.status === "not_invited" ? "Not invited" :
                     instructor.status.charAt(0).toUpperCase() + instructor.status.slice(1)}
                  </span>
                </span>
                <span className={styles.districtCell}>{instructor.districts}</span>
                <span className={styles.sessionsCell}>{instructor.sessionCount}</span>
                <span className={styles.joinedCell}>
                  {formatDate(instructor.created_at)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Drawer */}
      {selectedInstructor && (
        <InstructorDrawer
          instructor={selectedInstructor}
          districts={districts}
          onClose={handleCloseDrawer}
        />
      )}

      {/* Add Instructor Modal */}
      {addModalOpen && (
        <AddInstructorModal
          onClose={handleCloseAddModal}
          onSuccess={handleInstructorAdded}
        />
      )}

      {/* Scrim */}
      {(selectedInstructor || addModalOpen) && (
        <div
          className={styles.scrim}
          onClick={() => {
            handleCloseDrawer();
            handleCloseAddModal();
          }}
        />
      )}
    </div>
  );
}
