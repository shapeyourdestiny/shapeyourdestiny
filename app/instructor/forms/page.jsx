import Link from "next/link";
import styles from "./page.module.css";

export const metadata = {
  title: "Forms & Resources | Shape Your Destiny",
};

const RESOURCES = [
  {
    title: "Lesson plans",
    subtitle: "Youth Wellness",
    tile: "#E1EEF1",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z" />
        <path d="M20 4h-6a3 3 0 0 0-3 3M20 4v14h-6" />
      </svg>
    ),
    href: null,
  },
  {
    title: "Instructor handbook",
    subtitle: "Policies and what to do in an emergency",
    tile: "#DCE8FB",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" />
        <path d="M12 9v6M9 12h6" />
      </svg>
    ),
    href: null,
  },
];

const WarningIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

const ChevronIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

export default function FormsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Forms & resources</h1>
        <p>Report an incident here. More is on the way.</p>
      </div>

      <Link href="/instructor/incident-report" className={styles.incidentCard}>
        <div className={styles.incidentTile}>
          <WarningIcon />
        </div>
        <div className={styles.incidentText}>
          <span className={styles.incidentTitle}>Report an incident</span>
          <span className={styles.incidentSub}>Injury, behavior or safety concern</span>
        </div>
        <div className={styles.incidentChevron}>
          <ChevronIcon />
        </div>
      </Link>

      <div className={styles.resourcesSection}>
        <span className={styles.resourcesLabel}>RESOURCES</span>
        <div className={styles.resourcesCard}>
          {RESOURCES.map((item) => (
            <div
              key={item.title}
              className={styles.resourceRow}
              aria-disabled="true"
            >
              <div
                className={styles.resourceTile}
                style={{ backgroundColor: item.tile }}
              >
                {item.icon}
              </div>
              <div className={styles.resourceText}>
                <span className={styles.resourceTitle}>{item.title}</span>
                <span className={styles.resourceSub}>{item.subtitle}</span>
              </div>
              <span className={styles.comingSoon}>Coming soon</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
