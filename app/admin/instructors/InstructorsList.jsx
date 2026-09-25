"use client";

import { useState, useMemo } from "react";
import styles from "./InstructorsList.module.css";
import InstructorDrawer from "./InstructorDrawer";
import ArrangePanel from "./ArrangePanel";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [needsProfileFilter, setNeedsProfileFilter] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [drawerTab, setDrawerTab] = useState("overview");
  const [arrangeOpen, setArrangeOpen] = useState(false);

  // Count instructors by status
  const statusCounts = useMemo(() => {
    const counts = { all: 0, active: 0, invited: 0, archived: 0 };
    instructors.forEach((inst) => {
      counts.all++;
      counts[inst.status] = (counts[inst.status] || 0) + 1;
    });
    return counts;
  }, [instructors]);

  // Count instructors needing profile
  const needsProfileCount = useMemo(() => {
    return instructors.filter((inst) => inst.needsProfile).length;
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
      const matchesStatus =
        statusFilter === "all" || inst.status === statusFilter;

      // Needs profile filter
      const matchesNeedsProfile = !needsProfileFilter || inst.needsProfile;

      return matchesSearch && matchesStatus && matchesNeedsProfile;
    });
  }, [instructors, searchQuery, statusFilter, needsProfileFilter]);

  const selectedInstructor = useMemo(() => {
    return instructors.find((i) => i.id === selectedId) || null;
  }, [instructors, selectedId]);

  const handleRowClick = (id) => {
    setSelectedId(id);
    setDrawerTab("overview");
  };

  const handleCloseDrawer = () => {
    setSelectedId(null);
  };

  const handleOpenArrange = () => {
    setSelectedId(null);
    setArrangeOpen(true);
  };

  const handleCloseArrange = () => {
    setArrangeOpen(false);
  };

  // Get live instructors for arrange panel
  const liveInstructors = useMemo(() => {
    return instructors
      .filter((i) => i.staffPageStatus === "live" || i.staffPageStatus === "live-incomplete")
      .sort((a, b) => a.staff_sort_order - b.staff_sort_order);
  }, [instructors]);

  const leadership = liveInstructors.filter((i) => i.staff_section === "leadership");
  const instructorSection = liveInstructors.filter((i) => i.staff_section === "instructor");

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
              ["invited", "Invited"],
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
          {needsProfileCount > 0 && (
            <button
              type="button"
              className={`${styles.needsChip} ${needsProfileFilter ? styles.needsChipActive : ""}`}
              onClick={() => setNeedsProfileFilter(!needsProfileFilter)}
            >
              Needs profile
              <span className={styles.pillCount}>{needsProfileCount}</span>
            </button>
          )}
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.arrangeBtn}
            onClick={handleOpenArrange}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
            </svg>
            Arrange staff page
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
          <span>Staff page</span>
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
                  <span className={styles.nameText}>{instructor.full_name}</span>
                </div>
                <span>
                  <span className={`${styles.statusBadge} ${styles[instructor.status]}`}>
                    {instructor.status.charAt(0).toUpperCase() + instructor.status.slice(1)}
                  </span>
                </span>
                <span className={styles.districtCell}>{instructor.districts}</span>
                <span className={styles.sessionsCell}>{instructor.sessionCount}</span>
                <span className={styles.joinedCell}>
                  {formatDate(instructor.created_at)}
                </span>
                <span className={styles.staffPageCell}>
                  <StaffPageStatus instructor={instructor} />
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
          tab={drawerTab}
          onTabChange={setDrawerTab}
          onClose={handleCloseDrawer}
        />
      )}

      {/* Arrange Panel */}
      {arrangeOpen && (
        <ArrangePanel
          leadership={leadership}
          instructors={instructorSection}
          onClose={handleCloseArrange}
        />
      )}

      {/* Scrim */}
      {(selectedInstructor || arrangeOpen) && (
        <div
          className={styles.scrim}
          onClick={() => {
            handleCloseDrawer();
            handleCloseArrange();
          }}
        />
      )}
    </div>
  );
}

function StaffPageStatus({ instructor }) {
  const { staffPageStatus, staffPageLabel, hasHeadshot, hasBio, status } = instructor;

  if (status === "archived") {
    return <span className={styles.spOff}>Off the site</span>;
  }

  if (status === "invited") {
    return <span className={styles.spPending}>After sign-up</span>;
  }

  if (staffPageStatus === "hidden") {
    return <span className={styles.spHidden}>Hidden</span>;
  }

  // Live status
  const warnings = [];
  if (!hasHeadshot) warnings.push("No photo");
  if (!hasBio) warnings.push("No bio");

  return (
    <div className={styles.spLiveWrap}>
      <span className={styles.spLive}>Live</span>
      {warnings.length > 0 && (
        <span className={styles.spWarning}>{warnings.join(", ")}</span>
      )}
    </div>
  );
}
