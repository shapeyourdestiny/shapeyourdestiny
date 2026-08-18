"use client";

import { useState } from "react";
import styles from "./ActivityCard.module.css";

/**
 * Flip card matching the live site's interaction:
 * front = colored summary card, click flips to back = illustration + full copy + close (x).
 * Drop this in app/components/ActivityCard.jsx
 */
export default function ActivityCard({ color, title, summary, fullText, illustrationSrc }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className={styles.scene}
      onClick={() => setFlipped((f) => !f)}
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      aria-label={`${title}, click to ${flipped ? "close" : "read more"}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setFlipped((f) => !f);
        }
      }}
    >
      <div className={`${styles.card} ${flipped ? styles.isFlipped : ""}`}>
        {/* FRONT */}
        <div className={styles.face} style={{ background: color }}>
          <h3 className={styles.title}>{title}</h3>
          <p className={styles.summary}>{summary}</p>
          <span className={styles.cta}>How We Help</span>
        </div>

        {/* BACK */}
        <div className={`${styles.face} ${styles.back}`}>
          <button
            className={styles.close}
            aria-label="Close"
            onClick={(e) => {
              e.stopPropagation();
              setFlipped(false);
            }}
          >
            ×
          </button>
          {illustrationSrc && (
            <img className={styles.illustration} src={illustrationSrc} alt="" />
          )}
          <h3 className={styles.titleDark}>{title}</h3>
          <p className={styles.body}>{fullText}</p>
        </div>
      </div>
    </div>
  );
}

/* Example usage in app/page.tsx or a ProgramActivities.jsx section:

import ActivityCard from "./components/ActivityCard";

const activities = [
  {
    color: "#3FC0E8",
    title: "Yoga & Breathwork",
    summary: "Yoga and breathwork give kids practical tools to calm their minds and regulate emotions.",
    fullText: "Our instructors teach kids gentle poses and simple breathing techniques to help reduce stress, improve focus, and boost self-confidence. Studies show that even short, consistent practice can lower anxiety and improve classroom performance. For children, these skills provide a foundation of emotional regulation they can use every day.",
    illustrationSrc: "/images/yoga-illustration.png",
  },
  {
    color: "#6FCB55",
    title: "Group Fitness & Movement Games",
    summary: "Kids learn best when movement feels fun!",
    fullText: "With group fitness and interactive games led by our instructors, children build strength, coordination, and resilience while also practicing teamwork and communication. These activities give them a healthy outlet for stress and energy, teaching that physical movement is directly connected to how they feel emotionally.",
    illustrationSrc: "/images/movement-illustration.png",
  },
  {
    color: "#F2A65E",
    title: "Team Sports",
    summary: "Team sports teach life skills. Through soccer, basketball, pickleball, and more, kids practice communication, cooperation, and handling wins and losses with confidence.",
    fullText: "These activities strengthen not only the body, but also social-emotional skills like resilience, empathy, and leadership. By working toward shared goals, children build a sense of belonging and discover the confidence that comes from being part of something bigger than themselves.",
    illustrationSrc: "/images/team-illustration.png",
  },
];

export default function ProgramActivities() {
  return (
    <section>
      <h2>Program Activities</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        {activities.map((a) => (
          <ActivityCard key={a.title} {...a} />
        ))}
      </div>
    </section>
  );
}
*/
