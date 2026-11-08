"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import styles from "./page.module.css";
import {
  markApplicationOpened,
  updateApplicationStatus,
  addApplicationNote,
  getResumeSignedUrl,
  updateHiringSettings,
  addApplicantAsInstructor,
} from "@/lib/admin/applications-actions";

const STATUS_LABELS = {
  new: "New",
  reviewing: "Reviewing",
  interview: "Interview",
  hired: "Hired",
  not_a_fit: "Not a fit",
};

const STATUS_COLORS = {
  new: "teal",
  reviewing: "navy",
  interview: "amber",
  hired: "green",
  not_a_fit: "gray",
};

function formatDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function ApplicationsClient({ applications, settings }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlId = searchParams.get("id");

  const [tab, setTab] = useState("new");
  const [selectedId, setSelectedId] = useState(null);
  const [selectedApp, setSelectedApp] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [loading, setLoading] = useState(false);
  const [hiringOpen, setHiringOpen] = useState(settings.hiring_open);
  const [showEmailSettings, setShowEmailSettings] = useState(false);
  const [notifyEmails, setNotifyEmails] = useState(settings.notify_emails?.join(", ") || "");
  const [copied, setCopied] = useState(false);

  // Get applications for current tab
  const tabApps = applications[tab] || [];

  // Track if we've initialized from URL
  const initializedRef = useRef(false);

  // Find initial application from URL and initialize on first render
  useEffect(() => {
    if (initializedRef.current || !urlId) return;

    for (const status of Object.keys(applications)) {
      const found = applications[status].find((a) => a.id === urlId);
      if (found) {
        initializedRef.current = true;
        // Use setTimeout to defer state updates
        setTimeout(() => {
          setTab(status);
          setSelectedId(found.id);
          setSelectedApp(found);
          if (!found.opened_at) {
            markApplicationOpened(found.id);
          }
        }, 0);
        break;
      }
    }
  }, [urlId, applications]);

  const selectApplication = async (app) => {
    setSelectedId(app.id);
    setSelectedApp(app);

    // Update URL
    const params = new URLSearchParams(searchParams);
    params.set("id", app.id);
    router.replace(`/admin/applications?${params.toString()}`, { scroll: false });

    // Mark as opened if first time
    if (!app.opened_at) {
      await markApplicationOpened(app.id);
    }

    router.refresh();
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedApp) return;
    setLoading(true);
    const result = await updateApplicationStatus(selectedApp.id, newStatus);
    setLoading(false);

    if (result.error) {
      alert(result.error);
      return;
    }

    router.refresh();
  };

  const handleAddNote = async () => {
    if (!selectedApp || !noteText.trim()) return;
    setLoading(true);
    const result = await addApplicationNote(selectedApp.id, noteText);
    setLoading(false);

    if (result.error) {
      alert(result.error);
      return;
    }

    setNoteText("");
    router.refresh();
  };

  const handleOpenResume = async () => {
    if (!selectedApp?.resume_path) return;
    setLoading(true);
    const result = await getResumeSignedUrl(selectedApp.resume_path);
    setLoading(false);

    if (result.error) {
      alert(result.error);
      return;
    }

    window.open(result.url, "_blank");
  };

  const handleDownloadResume = async () => {
    if (!selectedApp?.resume_path) return;
    setLoading(true);
    const result = await getResumeSignedUrl(selectedApp.resume_path);
    setLoading(false);

    if (result.error) {
      alert(result.error);
      return;
    }

    // Create a download link
    const a = document.createElement("a");
    a.href = result.url;
    a.download = selectedApp.resume_name || "resume";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleToggleHiring = async () => {
    if (!hiringOpen) {
      // Opening - just do it
      setLoading(true);
      const result = await updateHiringSettings({ hiring_open: true });
      setLoading(false);
      if (result.error) {
        alert(result.error);
        return;
      }
      setHiringOpen(true);
      router.refresh();
    } else {
      // Closing - ask for confirmation
      if (!window.confirm("Pause hiring? The Join Our Team page will say you're not hiring right now.")) {
        return;
      }
      setLoading(true);
      const result = await updateHiringSettings({ hiring_open: false });
      setLoading(false);
      if (result.error) {
        alert(result.error);
        return;
      }
      setHiringOpen(false);
      router.refresh();
    }
  };

  const handleSaveEmailSettings = async () => {
    const emails = notifyEmails
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    if (emails.length === 0) {
      alert("Add at least one email address");
      return;
    }

    setLoading(true);
    const result = await updateHiringSettings({ notify_emails: emails });
    setLoading(false);

    if (result.error) {
      alert(result.error);
      return;
    }

    setShowEmailSettings(false);
    router.refresh();
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/join`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddAsInstructor = async () => {
    if (!selectedApp) return;
    setLoading(true);
    const result = await addApplicantAsInstructor(selectedApp.id);
    setLoading(false);

    if (result.error) {
      if (result.existingProfileId) {
        alert(`${result.error}. View their profile.`);
        router.push(`/admin/instructors/${result.existingProfileId}`);
      } else {
        alert(result.error);
      }
      return;
    }

    // Navigate to the new instructor profile
    router.push(`/admin/instructors/${result.profileId}`);
  };

  const getInitial = (firstName) => {
    return firstName?.charAt(0)?.toUpperCase() || "?";
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>Applications</h1>
          <p>People who applied on the Join Our Team page. You get an email for each new one.</p>
        </div>
        <div className={styles.headerRight}>
          <button
            type="button"
            className={`${styles.hiringToggle} ${hiringOpen ? styles.open : styles.paused}`}
            onClick={handleToggleHiring}
            disabled={loading}
          >
            {hiringOpen ? "Hiring is Open" : "Hiring is Paused"}
          </button>
          <div className={styles.settingsGroup}>
            <button type="button" className={styles.copyBtn} onClick={handleCopyLink}>
              {copied ? "Copied" : "Copy page link"}
            </button>
            <button
              type="button"
              className={styles.gearBtn}
              onClick={() => setShowEmailSettings(!showEmailSettings)}
              aria-label="Email settings"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            </button>
            {/* Email Settings Popover */}
            {showEmailSettings && (
              <div className={styles.settingsPopover}>
                <div className={styles.settingsPopoverHeader}>
                  <h3>Email settings</h3>
                  <button type="button" onClick={() => setShowEmailSettings(false)} className={styles.closeBtn}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                <label className={styles.settingsLabel}>
                  Send new applications to
                </label>
                <textarea
                  value={notifyEmails}
                  onChange={(e) => setNotifyEmails(e.target.value)}
                  placeholder="email1@example.com, email2@example.com"
                  rows={3}
                  className={styles.settingsTextarea}
                />
                <p className={styles.settingsHint}>Separate multiple addresses with commas</p>
                <button
                  type="button"
                  className={styles.saveSettingsBtn}
                  onClick={handleSaveEmailSettings}
                  disabled={loading}
                >
                  Save
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {Object.keys(STATUS_LABELS).map((status) => (
          <button
            key={status}
            type="button"
            className={`${styles.tab} ${tab === status ? styles.active : ""}`}
            onClick={() => setTab(status)}
          >
            {STATUS_LABELS[status]}
            <span className={styles.tabCount}>{applications[status]?.length || 0}</span>
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className={styles.layout}>
        {/* List */}
        <div className={styles.list}>
          {tabApps.length === 0 ? (
            <div className={styles.emptyList}>Nobody here right now.</div>
          ) : (
            tabApps.map((app) => (
              <button
                key={app.id}
                type="button"
                className={`${styles.listCard} ${selectedId === app.id ? styles.selected : ""}`}
                onClick={() => selectApplication(app)}
              >
                <div className={styles.listCardAvatar}>
                  {getInitial(app.first_name)}
                </div>
                <div className={styles.listCardMain}>
                  <div className={styles.listCardHeader}>
                    <span className={styles.listCardName}>
                      {!app.opened_at && <span className={styles.newDot} />}
                      {app.first_name} {app.last_name}
                    </span>
                    <span className={styles.listCardTime}>
                      {formatRelativeTime(app.created_at)}
                    </span>
                  </div>
                  <div className={styles.listCardEmail}>{app.email}</div>
                  <div className={styles.listCardMeta}>Resume attached</div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Detail */}
        <div className={styles.detail}>
          {selectedApp ? (
            <>
              <div className={styles.detailHeader}>
                <div className={styles.detailAvatar}>
                  {getInitial(selectedApp.first_name)}
                </div>
                <div className={styles.detailMeta}>
                  <h2 className={styles.detailName}>
                    {selectedApp.first_name} {selectedApp.last_name}
                  </h2>
                  <p className={styles.detailDate}>Applied {formatDate(selectedApp.created_at)}</p>
                </div>
                <select
                  value={selectedApp.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className={`${styles.statusSelect} ${styles[STATUS_COLORS[selectedApp.status]]}`}
                  disabled={loading}
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div className={styles.detailContent}>
                <div className={styles.detailMain}>
                  {/* Contact tiles */}
                  <div className={styles.contactTiles}>
                    <a href={`mailto:${selectedApp.email}`} className={styles.contactTile}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                      <span>{selectedApp.email}</span>
                    </a>
                    <a href={`tel:${selectedApp.phone}`} className={styles.contactTile}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                      </svg>
                      <span>{selectedApp.phone}</span>
                    </a>
                  </div>

                  {/* Message */}
                  <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>What they wrote</h3>
                    {selectedApp.message ? (
                      <p className={styles.messageText}>{selectedApp.message}</p>
                    ) : (
                      <p className={styles.messageMuted}>Nothing added.</p>
                    )}
                  </div>

                  {/* Resume */}
                  <div className={styles.resumeRow}>
                    <div className={styles.resumeIcon}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <div className={styles.resumeInfo}>
                      <span className={styles.resumeName}>{selectedApp.resume_name}</span>
                      <span className={styles.resumeSize}>{formatFileSize(selectedApp.resume_size)}</span>
                    </div>
                    <button
                      type="button"
                      className={styles.resumeBtn}
                      onClick={handleOpenResume}
                      disabled={loading}
                    >
                      Open resume
                    </button>
                    <button
                      type="button"
                      className={styles.resumeBtnSecondary}
                      onClick={handleDownloadResume}
                      disabled={loading}
                    >
                      Download
                    </button>
                  </div>
                </div>

                {/* Notes sidebar */}
                <div className={styles.notesSidebar}>
                  <h3 className={styles.sectionTitle}>Notes</h3>

                  <div className={styles.noteInput}>
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Add a note for the team"
                      rows={3}
                    />
                    <button
                      type="button"
                      className={styles.addNoteBtn}
                      onClick={handleAddNote}
                      disabled={loading || !noteText.trim()}
                    >
                      Add
                    </button>
                  </div>

                  <div className={styles.notesList}>
                    {selectedApp.notes?.map((note) => (
                      <div
                        key={note.id}
                        className={`${styles.note} ${note.is_system ? styles.systemNote : ""}`}
                      >
                        <div className={styles.noteHeader}>
                          <span className={styles.noteAuthor}>
                            {note.author?.full_name?.split(" ")[0] || "Admin"}
                          </span>
                          <span className={styles.noteDate}>
                            {formatRelativeTime(note.created_at)}
                          </span>
                        </div>
                        <p className={styles.noteBody}>{note.body}</p>
                      </div>
                    ))}
                  </div>

                  {/* Action buttons */}
                  <div className={styles.actionButtons}>
                    {selectedApp.status === "new" && (
                      <>
                        <button
                          type="button"
                          className={styles.primaryBtn}
                          onClick={() => handleStatusChange("reviewing")}
                          disabled={loading}
                        >
                          Move to Reviewing
                        </button>
                        <button
                          type="button"
                          className={styles.notAFitBtn}
                          onClick={() => handleStatusChange("not_a_fit")}
                          disabled={loading}
                        >
                          Not a fit
                        </button>
                      </>
                    )}

                    {selectedApp.status === "reviewing" && (
                      <>
                        <button
                          type="button"
                          className={styles.primaryBtn}
                          onClick={() => handleStatusChange("interview")}
                          disabled={loading}
                        >
                          Move to Interview
                        </button>
                        <button
                          type="button"
                          className={styles.notAFitBtn}
                          onClick={() => handleStatusChange("not_a_fit")}
                          disabled={loading}
                        >
                          Not a fit
                        </button>
                      </>
                    )}

                    {selectedApp.status === "interview" && (
                      <>
                        <button
                          type="button"
                          className={styles.primaryBtn}
                          onClick={() => handleStatusChange("hired")}
                          disabled={loading}
                        >
                          Mark hired
                        </button>
                        <button
                          type="button"
                          className={styles.notAFitBtn}
                          onClick={() => handleStatusChange("not_a_fit")}
                          disabled={loading}
                        >
                          Not a fit
                        </button>
                      </>
                    )}

                    {selectedApp.status === "hired" && (
                      <>
                        {selectedApp.profile_id ? (
                          <Link
                            href={`/admin/instructors/${selectedApp.profile_id}`}
                            className={styles.viewInstructorLink}
                          >
                            View instructor &rsaquo;
                          </Link>
                        ) : (
                          <div className={styles.addInstructorSection}>
                            <button
                              type="button"
                              className={styles.primaryBtn}
                              onClick={handleAddAsInstructor}
                              disabled={loading}
                            >
                              Add as instructor
                            </button>
                            <p className={styles.addInstructorHint}>
                              Creates their profile and an invite code. Nothing is sent until you send the invite.
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className={styles.emptyDetail}>
              <p>Select an application to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
