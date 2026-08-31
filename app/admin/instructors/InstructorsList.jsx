"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import styles from "./InstructorsList.module.css";

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

export default function InstructorsList({ instructors }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredInstructors = useMemo(() => {
    return instructors.filter((inst) => {
      // Search filter
      const matchesSearch =
        searchQuery === "" ||
        inst.full_name.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      const matchesStatus =
        statusFilter === "all" || inst.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [instructors, searchQuery, statusFilter]);

  const handleRowClick = (id) => {
    router.push(`/admin/instructors/${id}`);
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
            placeholder="Search instructors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className={styles.statusFilter}>
          {["all", "active", "invited", "archived"].map((status) => (
            <button
              key={status}
              type="button"
              className={`${styles.filterPill} ${statusFilter === status ? styles.filterPillActive : ""}`}
              onClick={() => setStatusFilter(status)}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
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
                className={styles.listRow}
                onClick={() => handleRowClick(instructor.id)}
              >
                <div className={styles.nameCell}>
                  <div
                    className={styles.avatar}
                    style={{ background: getAvatarColor(instructor.full_name) }}
                  >
                    {getInitials(instructor.full_name)}
                  </div>
                  <span className={styles.nameText}>{instructor.full_name}</span>
                </div>
                <span>
                  <span className={`${styles.statusBadge} ${styles[instructor.status]}`}>
                    {instructor.status.charAt(0).toUpperCase() +
                      instructor.status.slice(1)}
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
    </div>
  );
}
