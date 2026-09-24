"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import styles from "./our-team.module.css";

// Map internal program names to display labels
const PROGRAM_LABELS = {
  wellness: "Wellness",
  soccer: "Sports",
};

function PlaceholderAvatar() {
  return (
    <div className={styles.placeholder}>
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M12 14c-5 0-8 2.5-8 5v1h16v-1c0-2.5-3-5-8-5z" />
      </svg>
    </div>
  );
}

function InstructorCard({ member }) {
  return (
    <article className={styles.instructorCard}>
      <div className={styles.instructorPhoto}>
        {member.headshotUrl ? (
          <Image
            src={member.headshotUrl}
            alt={member.display_name}
            width={130}
            height={130}
            style={{ objectFit: "cover" }}
          />
        ) : (
          <PlaceholderAvatar />
        )}
      </div>
      <div className={styles.instructorName}>{member.display_name}</div>
      {member.title && (
        <div className={styles.instructorTitle}>{member.title}</div>
      )}
      {member.bio && <p className={styles.instructorBio}>{member.bio}</p>}
      {member.programs && member.programs.length > 0 && (
        <div className={styles.programTags}>
          {member.programs.map((prog) => (
            <span key={prog} className={styles.programTag}>
              {PROGRAM_LABELS[prog] || prog}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

export default function InstructorsSection({ members, programs }) {
  const [filter, setFilter] = useState("all");

  // Get only programs that have at least one instructor
  const activePrograms = useMemo(() => {
    return programs.filter((prog) =>
      members.some((m) => m.programs?.includes(prog))
    );
  }, [members, programs]);

  // Filter members based on selected program
  const filteredMembers = useMemo(() => {
    if (filter === "all") return members;
    return members.filter((m) => m.programs?.includes(filter));
  }, [members, filter]);

  return (
    <section id="instructors" className={styles.instructors}>
      <div className={styles.sectionInner}>
        <div className={styles.sectionEyebrow}>Instructors &amp; Coaches</div>
        <h2 className={styles.sectionHeading}>
          Meet the People Bringing Wellness to Your Schools
        </h2>

        {/* Filter chips - only show if there are programs */}
        {activePrograms.length > 0 && (
          <div className={styles.filters}>
            <button
              className={`${styles.filterChip} ${filter === "all" ? styles.filterChipActive : ""}`}
              onClick={() => setFilter("all")}
            >
              All
            </button>
            {activePrograms.map((prog) => (
              <button
                key={prog}
                className={`${styles.filterChip} ${filter === prog ? styles.filterChipActive : ""}`}
                onClick={() => setFilter(prog)}
              >
                {PROGRAM_LABELS[prog] || prog}
              </button>
            ))}
          </div>
        )}

        {/* Instructor grid */}
        <div className={styles.instructorGrid}>
          {filteredMembers.length > 0 ? (
            filteredMembers.map((member) => (
              <InstructorCard key={member.id} member={member} />
            ))
          ) : (
            <div className={styles.emptyState}>
              {members.length === 0
                ? "Our instructor team is growing! Check back soon."
                : "No instructors found for this program."}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
