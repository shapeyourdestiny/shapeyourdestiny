"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "../page.module.css";

const ChevronIcon = () => (
  <svg className={styles.chevron} viewBox="0 0 24 24" fill="none" stroke="#5A6385" strokeWidth="2" strokeLinecap="round">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

const DistrictIcon = () => (
  <svg className={styles.districtIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21h18M5 21V10M19 21V10M9 21v-6h6v6M2 10l10-6 10 6" />
  </svg>
);

function formatDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
);

export default function SurveyPageClient({ survey, sends, allDistricts, totalResponses }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showSendModal, setShowSendModal] = useState(false);
  const [editingSend, setEditingSend] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Open send modal if ?send=1 in URL
  const shouldOpenSend = searchParams.get("send") === "1";
  useEffect(() => {
    if (shouldOpenSend) {
      // Use setTimeout to avoid synchronous setState in effect
      const timer = setTimeout(() => {
        setShowSendModal(true);
        router.replace(`/admin/surveys/${survey.slug}`, { scroll: false });
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [shouldOpenSend, router, survey.slug]);

  const handleCopyLink = async (e, linkSlug) => {
    e.stopPropagation();
    const url = `${window.location.origin}/survey/${survey.slug}/${linkSlug}`;
    await navigator.clipboard.writeText(url);
    // Show brief feedback
    const btn = e.currentTarget;
    const originalText = btn.textContent;
    btn.textContent = "Copied";
    setTimeout(() => {
      btn.textContent = originalText;
    }, 1500);
  };

  const handleDistrictClick = (send) => {
    router.push(`/admin/surveys/${survey.slug}/${send.linkSlug}`);
  };

  const handleOpenSend = (existingSend = null) => {
    setEditingSend(existingSend);
    setShowSendModal(true);
  };

  const handleDelete = async (e, send) => {
    e.stopPropagation();
    if (!confirm(`Delete survey link for ${send.districtName}? This cannot be undone.`)) {
      return;
    }

    setDeletingId(send.id);
    try {
      const res = await fetch(`/api/admin/surveys/${survey.slug}/sends/${send.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }

      window.location.reload();
    } catch (err) {
      alert(err.message);
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className={styles.crumb}>
        <Link href="/admin/surveys">Surveys</Link> &rsaquo;
      </div>

      <div className={styles.header}>
        <div>
          <h1>
            {survey.title}
            {survey.period && <span className={styles.period}>{survey.period}</span>}
          </h1>
          <div className={styles.sub}>
            {sends.length > 0
              ? `Sent to ${sends.length} ${sends.length === 1 ? "district" : "districts"} · ${totalResponses} ${totalResponses === 1 ? "response" : "responses"}`
              : "Not sent yet"}
          </div>
        </div>
        <div className={styles.headerButtons}>
          <a
            href={`/survey/${survey.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.btnGhost} ${styles.btnSm}`}
          >
            Preview
          </a>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => handleOpenSend()}
          >
            Send to a district
          </button>
        </div>
      </div>

      <div className={styles.listCard}>
        {sends.length > 0 ? (
          sends.map((send) => (
            <div
              key={send.id}
              className={styles.districtItem}
              onClick={() => handleDistrictClick(send)}
            >
              <div className={styles.itemMain}>
                <b>
                  <DistrictIcon />
                  {send.districtName}
                </b>
                <small>
                  {send.schools.length} {send.schools.length === 1 ? "school" : "schools"} · sent {formatDate(send.createdAt)}
                </small>
              </div>

              <div className={styles.itemStat}>
                <span className={styles.num}>{send.responseCount}</span>
                <small>responses</small>
              </div>

              <div className={styles.itemStat}>
                {send.avgOverall !== null && send.avgOverall !== undefined ? (
                  <>
                    <span className={styles.num}>
                      {send.avgOverall}
                      <span className={styles.stars}>&#9733;</span>
                    </span>
                    <small>overall</small>
                  </>
                ) : (
                  <>
                    <span className={styles.num}>-</span>
                    <small>overall</small>
                  </>
                )}
              </div>

              <button
                type="button"
                className={`${styles.btnGhost} ${styles.btnSm} ${styles.copyBtn}`}
                onClick={(e) => handleCopyLink(e, send.linkSlug)}
              >
                Copy link
              </button>

              <button
                type="button"
                className={`${styles.btnGhost} ${styles.btnSm} ${styles.deleteBtn}`}
                onClick={(e) => handleDelete(e, send)}
                disabled={deletingId === send.id}
                title="Delete this survey link"
              >
                <TrashIcon />
              </button>

              <ChevronIcon />
            </div>
          ))
        ) : (
          <div className={styles.empty}>
            <p>Not sent to any districts yet.</p>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => handleOpenSend()}
            >
              Send to a district
            </button>
          </div>
        )}
      </div>

      {showSendModal && (
        <SendModal
          survey={survey}
          sends={sends}
          allDistricts={allDistricts}
          editingSend={editingSend}
          onClose={() => {
            setShowSendModal(false);
            setEditingSend(null);
          }}
        />
      )}
    </>
  );
}

function SendModal({ survey, sends, allDistricts, editingSend, onClose }) {
  const [step, setStep] = useState("form"); // form | done
  const [selectedDistrictId, setSelectedDistrictId] = useState(editingSend?.districtId || "");
  const [selectedSchools, setSelectedSchools] = useState(editingSend?.schools || []);
  const [otherSchools, setOtherSchools] = useState("");
  const [districtSchools, setDistrictSchools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [createdLink, setCreatedLink] = useState(null);
  const [error, setError] = useState(null);

  // Districts that already have a send (can't create new)
  const sentDistrictIds = new Set(sends.map((s) => s.districtId));

  // If editing, we're updating an existing send
  const isEditing = !!editingSend;

  // Fetch schools when district changes
  useEffect(() => {
    if (!selectedDistrictId || isEditing) {
      return;
    }

    let cancelled = false;

    // Start loading and fetch schools
    const fetchSchools = async () => {
      setLoadingSchools(true);
      try {
        const res = await fetch(`/api/admin/districts/${selectedDistrictId}/schools`);
        const data = await res.json();
        if (cancelled) return;
        const schools = data.schools || [];
        setDistrictSchools(schools);
        // Select all by default
        setSelectedSchools(schools.map((s) => s.name));
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to fetch schools:", err);
        setDistrictSchools([]);
      } finally {
        if (!cancelled) setLoadingSchools(false);
      }
    };

    // Use setTimeout to avoid synchronous setState in effect
    const timer = setTimeout(fetchSchools, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedDistrictId, isEditing]);

  // Refresh schools from database (for editing)
  const handleRefreshSchools = async () => {
    if (!selectedDistrictId) return;

    setLoadingSchools(true);
    try {
      const res = await fetch(`/api/admin/districts/${selectedDistrictId}/schools`);
      const data = await res.json();
      const schools = data.schools || [];
      setDistrictSchools(schools);
      // Select all fetched schools
      setSelectedSchools(schools.map((s) => s.name));
    } catch (err) {
      console.error("Failed to fetch schools:", err);
    } finally {
      setLoadingSchools(false);
    }
  };

  const handleDistrictChange = (e) => {
    const districtId = e.target.value;

    // Check if this district already has a send
    const existingSend = sends.find((s) => s.districtId === districtId);
    if (existingSend) {
      // Switch to edit mode for this send
      setSelectedDistrictId(districtId);
      setSelectedSchools(existingSend.schools);
      setDistrictSchools([]); // Will be populated from existing
      return;
    }

    setSelectedDistrictId(districtId);
  };

  const handleSchoolToggle = (schoolName) => {
    setSelectedSchools((prev) =>
      prev.includes(schoolName)
        ? prev.filter((s) => s !== schoolName)
        : [...prev, schoolName]
    );
  };

  const handleSubmit = async () => {
    // Combine selected schools with "other" schools
    const otherList = otherSchools
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const allSchools = [...selectedSchools, ...otherList];

    if (allSchools.length === 0) {
      setError("Please select at least one school.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const existingSend = sends.find((s) => s.districtId === selectedDistrictId);

      if (existingSend) {
        // Update existing send
        const res = await fetch(`/api/admin/surveys/${survey.slug}/sends/${existingSend.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schools: allSchools }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to update");
        }

        await res.json();
        setCreatedLink(`${window.location.origin}/survey/${survey.slug}/${existingSend.linkSlug}`);
      } else {
        // Create new send
        const res = await fetch(`/api/admin/surveys/${survey.slug}/sends`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            districtId: selectedDistrictId,
            schools: allSchools,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create");
        }

        const data = await res.json();
        setCreatedLink(`${window.location.origin}/survey/${survey.slug}/${data.send.link_slug}`);
      }

      setStep("done");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (createdLink) {
      await navigator.clipboard.writeText(createdLink);
    }
  };

  const handleClose = () => {
    if (step === "done") {
      // Reload the page to show updated sends
      window.location.reload();
    } else {
      onClose();
    }
  };

  const selectedDistrict = allDistricts.find((d) => d.id === selectedDistrictId);
  const existingSendForDistrict = sends.find((s) => s.districtId === selectedDistrictId);

  return (
    <div className={`${styles.scrim} ${styles.open}`} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Send to a district</h2>
          <div className={styles.sub}>{survey.title}</div>
        </div>

        {step === "form" ? (
          <>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>District</label>
                <select
                  className={styles.select}
                  value={selectedDistrictId}
                  onChange={handleDistrictChange}
                  disabled={isEditing}
                >
                  <option value="">Select a district...</option>
                  {allDistricts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                      {sentDistrictIds.has(d.id) ? " (already sent)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {selectedDistrictId && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Schools on this link</label>

                  {loadingSchools ? (
                    <p className={styles.formNote}>Loading schools...</p>
                  ) : existingSendForDistrict && districtSchools.length === 0 ? (
                    // Editing existing - show current schools as checkboxes
                    <>
                      <div className={styles.checks}>
                        {existingSendForDistrict.schools.map((school) => (
                          <label key={school} className={styles.checkLabel}>
                            <input
                              type="checkbox"
                              checked={selectedSchools.includes(school)}
                              onChange={() => handleSchoolToggle(school)}
                            />
                            {school}
                          </label>
                        ))}
                      </div>
                      <button
                        type="button"
                        className={`${styles.btnGhost} ${styles.btnSm}`}
                        onClick={handleRefreshSchools}
                        style={{ marginTop: 8 }}
                      >
                        <RefreshIcon /> Refresh schools from database
                      </button>
                    </>
                  ) : districtSchools.length > 0 ? (
                    <div className={styles.checks}>
                      {districtSchools.map((school) => (
                        <label key={school.id} className={styles.checkLabel}>
                          <input
                            type="checkbox"
                            checked={selectedSchools.includes(school.name)}
                            onChange={() => handleSchoolToggle(school.name)}
                          />
                          {school.name}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.formNote}>No schools found for this district.</p>
                  )}

                  <p className={styles.formNote}>
                    Pick the schools to include. Add schools we don&apos;t work with yet:
                  </p>
                  <textarea
                    className={styles.textarea}
                    placeholder="Other schools, one per line"
                    value={otherSchools}
                    onChange={(e) => setOtherSchools(e.target.value)}
                  />
                </div>
              )}

              {error && (
                <p style={{ color: "#c00", fontSize: 14, marginTop: 12 }}>{error}</p>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button type="button" className={styles.btnGhost} onClick={handleClose}>
                Close
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                disabled={!selectedDistrictId || loading}
                onClick={handleSubmit}
              >
                {loading
                  ? "Saving..."
                  : existingSendForDistrict
                  ? "Update link"
                  : "Create link"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.modalBody}>
              <div className={styles.linkResult}>
                <b>Link ready for {selectedDistrict?.name}</b>
                <div className={styles.linkRow}>
                  <span className={styles.linkUrl}>
                    {createdLink?.replace("https://", "").replace("http://", "")}
                  </span>
                  <button
                    type="button"
                    className={`${styles.btnPrimary} ${styles.btnSm}`}
                    onClick={handleCopyLink}
                  >
                    Copy link
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button type="button" className={styles.btnGhost} onClick={handleClose}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
