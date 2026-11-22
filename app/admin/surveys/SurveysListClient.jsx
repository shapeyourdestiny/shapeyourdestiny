"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

const ChevronIcon = () => (
  <svg className={styles.chevron} viewBox="0 0 24 24" fill="none" stroke="#5A6385" strokeWidth="2" strokeLinecap="round">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export default function SurveysListClient({ surveys }) {
  const router = useRouter();

  return (
    <>
      <div className={styles.header}>
        <div>
          <h1>Surveys</h1>
          <div className={styles.sub}>Send a survey to a school district and see what they said.</div>
        </div>
      </div>

      <div className={styles.listCard}>
        {surveys.map((survey) => (
          <div
            key={survey.slug}
            className={styles.surveyItem}
            onClick={() => router.push(`/admin/surveys/${survey.slug}`)}
          >
            <div className={styles.itemMain}>
              <b>{survey.title}</b>
              <small>
                {survey.districtCount > 0
                  ? `Sent to ${survey.districtCount} ${survey.districtCount === 1 ? "district" : "districts"}`
                  : "Not sent yet"}
              </small>
            </div>

            <div className={styles.itemStat}>
              <span className={styles.num}>{survey.responseCount}</span>
              <small>responses</small>
            </div>

            <div className={styles.itemStat}>
              {survey.districtCount > 0 && survey.avgOverall !== null && survey.avgOverall !== undefined ? (
                <>
                  <span className={styles.num}>
                    {survey.avgOverall}
                    <span className={styles.stars}>&#9733;</span>
                  </span>
                  <small>overall</small>
                </>
              ) : survey.districtCount === 0 ? (
                <Link
                  href={`/admin/surveys/${survey.slug}?send=1`}
                  className={`${styles.btnPrimary} ${styles.btnSm}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  Send
                </Link>
              ) : (
                <>
                  <span className={styles.num}>-</span>
                  <small>overall</small>
                </>
              )}
            </div>

            <ChevronIcon />
          </div>
        ))}

        {surveys.length === 0 && (
          <div className={styles.empty}>
            <p>No surveys yet.</p>
          </div>
        )}
      </div>
    </>
  );
}
