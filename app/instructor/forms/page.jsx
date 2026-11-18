import Link from "next/link";
import styles from "./page.module.css";
import { getVisibleResources, formatResourceDate } from "@/lib/resources/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Resources | Shape Your Destiny",
};

const ICONS = {
  book: {
    color: "#E1EEF1",
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z" />
        <path d="M20 4h-6a3 3 0 0 0-3 3M20 4v14h-6" />
      </svg>
    ),
  },
  shield: {
    color: "#DCE8FB",
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" />
        <path d="M12 9v6M9 12h6" />
      </svg>
    ),
  },
  video: {
    color: "#FDF0DF",
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    ),
  },
  link: {
    color: "#E8F4F6",
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
  form: {
    color: "#E5ECFA",
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path d="M14 2v6h6" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    ),
  },
  folder: {
    color: "#F1F2F6",
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
      </svg>
    ),
  },
};

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

const ExternalLinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const HelpIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

function buildSubtitle(resource) {
  const parts = [];

  if (resource.subtitle) {
    parts.push(resource.subtitle);
  }

  // For files with uploaded content, add version and date
  if (resource.kind === "file" && resource.file_path) {
    const versionPart = resource.version_label || "";
    const datePart = formatResourceDate(resource.updated_at);

    if (versionPart && datePart) {
      parts.push(`${versionPart}, updated ${datePart}`);
    } else if (datePart) {
      parts.push(`updated ${datePart}`);
    }
  }

  return parts.join(" · ");
}

function getAriaLabel(resource) {
  if (resource.kind === "link") {
    return `${resource.title}, opens a website`;
  }
  return `${resource.title}, PDF`;
}

export default async function FormsPage() {
  let resources = [];
  try {
    resources = await getVisibleResources();
  } catch (err) {
    console.error("Error fetching resources:", err);
  }

  const hasResources = resources.length > 0;

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

      {hasResources && (
        <div className={styles.resourcesSection}>
          <span className={styles.resourcesLabel}>RESOURCES</span>
          <div className={styles.resourcesCard}>
            {resources.map((resource) => {
              const iconConfig = ICONS[resource.icon] || ICONS.book;
              const subtitle = buildSubtitle(resource);
              const isLink = resource.kind === "link";
              const hasContent = isLink ? !!resource.url : !!resource.file_path;

              if (!hasContent) {
                // Coming soon state
                return (
                  <div
                    key={resource.key}
                    className={styles.resourceRow}
                    aria-disabled="true"
                  >
                    <div
                      className={styles.resourceTile}
                      style={{ backgroundColor: iconConfig.color }}
                    >
                      {iconConfig.svg}
                    </div>
                    <div className={styles.resourceText}>
                      <span className={styles.resourceTitle}>{resource.title}</span>
                      <span className={styles.resourceSub}>{subtitle || resource.subtitle || ""}</span>
                    </div>
                    <span className={styles.comingSoon}>Coming soon</span>
                  </div>
                );
              }

              // Clickable row
              return (
                <Link
                  key={resource.key}
                  href={`/instructor/resources/${resource.key}`}
                  className={styles.resourceRowLink}
                  aria-label={getAriaLabel(resource)}
                  target={isLink ? "_blank" : undefined}
                  rel={isLink ? "noopener" : undefined}
                >
                  <div
                    className={styles.resourceTile}
                    style={{ backgroundColor: iconConfig.color }}
                  >
                    {iconConfig.svg}
                  </div>
                  <div className={styles.resourceText}>
                    <span className={styles.resourceTitle}>{resource.title}</span>
                    <span className={styles.resourceSub}>{subtitle}</span>
                  </div>
                  <div className={isLink ? styles.externalIcon : styles.resourceChevron}>
                    {isLink ? <ExternalLinkIcon /> : <ChevronIcon />}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
