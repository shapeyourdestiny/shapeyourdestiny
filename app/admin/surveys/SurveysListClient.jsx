"use client";

import { useState } from "react";
import Link from "next/link";
import { formatRelativeTime, formatDate } from "@/lib/surveys/queries";
import styles from "./page.module.css";

const TEMPLATE_TEXT = `Add a new survey to the app, using the same
setup as the soccer feedback survey.

Title:
Who it's for:
Closes on:
Anonymous allowed: yes / no

Questions (one per line, "-" for choices,
[1-5] stars, [0-10] scale, [long] paragraph,
* required, ## section):`;

const ICONS = {
  ball: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
      <path d="M2 12h20" />
    </svg>
  ),
  clipboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
};

export default function SurveysListClient({ surveys }) {
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyTemplate = async () => {
    await navigator.clipboard.writeText(TEMPLATE_TEXT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className={styles.header}>
        <div>
          <h1>Surveys</h1>
          <p>Feedback from schools, parents and staff. Every response lands here.</p>
        </div>
        <button className={styles.newBtn} onClick={() => setShowModal(true)}>
          + New survey
        </button>
      </div>

      <div className={styles.grid}>
        {surveys.map((survey) => (
          <Link
            key={survey.slug}
            href={`/admin/surveys/${survey.slug}`}
            className={styles.card}
          >
            <div className={styles.cardHeader}>
              <div className={`${styles.iconTile} ${styles[`icon${survey.status}`]}`}>
                {ICONS[survey.icon] || ICONS.clipboard}
              </div>
              <span className={`${styles.statusPill} ${styles[`status${survey.status}`]}`}>
                {survey.status === "open" ? "Open" : survey.status === "draft" ? "Draft" : "Closed"}
              </span>
            </div>

            <h2 className={styles.cardTitle}>{survey.title}</h2>
            <p className={styles.cardMeta}>
              {survey.audience}
              {survey.closesAt && ` · closes ${formatDate(survey.closesAt)}`}
              {!survey.closesAt && survey.responseCount === 0 && " · not sent yet"}
            </p>

            <div className={styles.cardStats}>
              <div className={styles.stat}>
                <span className={styles.statValue}>{survey.responseCount}</span>
                <span className={styles.statLabel}>responses</span>
              </div>
              {survey.avgOverall !== null && survey.avgOverall !== undefined ? (
                <div className={styles.stat}>
                  <span className={styles.statValue}>{survey.avgOverall}</span>
                  <span className={styles.statLabel}>avg rating</span>
                </div>
              ) : (
                <div className={styles.stat}>
                  <span className={styles.statValue}>{survey.questionCount}</span>
                  <span className={styles.statLabel}>questions</span>
                </div>
              )}
              {survey.avgRecommend !== null && survey.avgRecommend !== undefined ? (
                <div className={styles.stat}>
                  <span className={styles.statValue}>{survey.avgRecommend}</span>
                  <span className={styles.statLabel}>recommend</span>
                </div>
              ) : null}
            </div>

            <p className={styles.cardFooter}>
              {survey.lastResponseAt
                ? `Last response ${formatRelativeTime(survey.lastResponseAt)}`
                : survey.status === "draft"
                ? "Not published"
                : "No responses yet"}
            </p>
          </Link>
        ))}

        <button className={styles.addCard} onClick={() => setShowModal(true)}>
          <div className={styles.addIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <span className={styles.addTitle}>Add a survey</span>
          <span className={styles.addDesc}>Parents, staff, end of season. Any questions you want.</span>
        </button>
      </div>

      {showModal && (
        <div className={styles.modal} onClick={() => setShowModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3>Add a survey</h3>
            <p className={styles.modalDesc}>
              New surveys are set up from a list of questions. Copy this, fill it in, and send it to Claude Code. The new survey shows up here with its own link and results.
            </p>

            <div className={styles.templateBox}>
              <pre>{TEMPLATE_TEXT}</pre>
            </div>

            <div className={styles.modalActions}>
              <button className={styles.copyBtn} onClick={handleCopyTemplate}>
                {copied ? "Copied!" : "Copy template"}
              </button>
              <button className={styles.closeBtn} onClick={() => setShowModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
