import Link from "next/link";
import styles from "./page.module.css";
import { getResource, formatResourceDate } from "@/lib/resources/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Resources | Shape Your Destiny",
};

const BookIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z" />
    <path d="M20 4h-6a3 3 0 0 0-3 3M20 4v14h-6" />
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" />
    <path d="M12 9v6M9 12h6" />
  </svg>
);

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

const HelpIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

export default async function FormsPage() {
  // Fetch resources
  let handbook = null;
  let lessonPlans = null;
  try {
    [handbook, lessonPlans] = await Promise.all([
      getResource("handbook"),
      getResource("lesson_plans"),
    ]);
  } catch (err) {
    // Table may not exist yet
    console.error("Error fetching resources:", err);
  }

  const handbookHasFile = handbook?.file_path != null;
  const handbookSubtitle = handbookHasFile
    ? `Policies, attendance and emergencies · ${handbook.version_label || ""}, updated ${formatResourceDate(handbook.updated_at)}`.replace(" · ,", " ·").replace("· ,", "·")
    : "Coming soon";

  const lessonPlansHasFile = lessonPlans?.file_path != null;
  const lessonPlansSubtitle = lessonPlansHasFile
    ? `Youth Wellness · ${lessonPlans.version_label || ""}, updated ${formatResourceDate(lessonPlans.updated_at)}`.replace(" · ,", " ·").replace("· ,", "·")
    : "Youth Wellness";

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Resources</h1>
        <p>Help, forms, and more.</p>
      </div>

      <Link href="/instructor/help" className={styles.helpCard}>
        <div className={styles.helpTile}>
          <HelpIcon />
        </div>
        <div className={styles.incidentText}>
          <span className={styles.incidentTitle}>Help & FAQ</span>
          <span className={styles.incidentSub}>How to use the app</span>
        </div>
        <div className={styles.incidentChevron}>
          <ChevronIcon />
        </div>
      </Link>

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
          {/* Lesson plans */}
          {lessonPlansHasFile ? (
            <Link
              href="/instructor/resources/lesson_plans"
              className={styles.resourceRowLink}
              aria-label="Lesson plans, PDF"
            >
              <div className={styles.resourceTile} style={{ backgroundColor: "#E1EEF1" }}>
                <BookIcon />
              </div>
              <div className={styles.resourceText}>
                <span className={styles.resourceTitle}>Lesson plans</span>
                <span className={styles.resourceSub}>{lessonPlansSubtitle}</span>
              </div>
              <div className={styles.resourceChevron}>
                <ChevronIcon />
              </div>
            </Link>
          ) : (
            <div className={styles.resourceRow} aria-disabled="true">
              <div className={styles.resourceTile} style={{ backgroundColor: "#E1EEF1" }}>
                <BookIcon />
              </div>
              <div className={styles.resourceText}>
                <span className={styles.resourceTitle}>Lesson plans</span>
                <span className={styles.resourceSub}>{lessonPlansSubtitle}</span>
              </div>
              <span className={styles.comingSoon}>Coming soon</span>
            </div>
          )}

          {/* Employee handbook */}
          {handbookHasFile ? (
            <Link
              href="/instructor/resources/handbook"
              className={styles.resourceRowLink}
              aria-label="Employee handbook, PDF"
            >
              <div className={styles.resourceTile} style={{ backgroundColor: "#DCE8FB" }}>
                <ShieldIcon />
              </div>
              <div className={styles.resourceText}>
                <span className={styles.resourceTitle}>Employee handbook</span>
                <span className={styles.resourceSub}>{handbookSubtitle}</span>
              </div>
              <div className={styles.resourceChevron}>
                <ChevronIcon />
              </div>
            </Link>
          ) : (
            <div className={styles.resourceRow} aria-disabled="true">
              <div className={styles.resourceTile} style={{ backgroundColor: "#DCE8FB" }}>
                <ShieldIcon />
              </div>
              <div className={styles.resourceText}>
                <span className={styles.resourceTitle}>Employee handbook</span>
                <span className={styles.resourceSub}>{handbookSubtitle}</span>
              </div>
              <span className={styles.comingSoon}>Coming soon</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
