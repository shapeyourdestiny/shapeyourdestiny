"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import styles from "./page.module.css";
import {
  saveAnnouncementDraft,
  sendAnnouncement,
  scheduleAnnouncement,
  editAnnouncement,
  archiveAnnouncement,
  deleteAnnouncementDraft,
  remindUnread,
  getAnnouncementRecipientCount,
  getAnnouncementReadStats,
} from "@/lib/admin/announcements-actions";

const TEMPLATES = [
  { key: "no_class", label: "No class", title: "No class today", body: "Hi team, just a heads up — there's no class today at {school}. Enjoy the break!" },
  { key: "schedule_change", label: "Schedule change", title: "Schedule update", body: "Hi team, there's been a change to the schedule. Please check the app for the latest details." },
  { key: "reminder", label: "Reminder", title: "Friendly reminder", body: "Hi team, just a quick reminder about {topic}." },
  { key: "welcome", label: "Welcome", title: "Welcome to the team!", body: "Hi team, please welcome our newest instructor, {name}! Looking forward to working together." },
];

const PROGRAM_LABELS = {
  wellness: "Wellness",
  sports: "Sports",
  leadership: "Leadership",
};

/**
 * Get audience description text for display.
 */
function getAudienceText(audience, schools = [], instructors = [], districts = []) {
  if (!audience) return "No audience";

  const type = audience.type;

  if (type === "all") {
    return "Everyone";
  } else if (type === "program") {
    const program = audience.program;
    return PROGRAM_LABELS[program] || program || "Unknown program";
  } else if (type === "district") {
    const districtIds = audience.district_ids || [];
    if (districtIds.length === 0) return "No districts selected";
    if (districtIds.length === 1) {
      const district = districts.find(d => d.id === districtIds[0]);
      return district?.name || "1 district";
    }
    return `${districtIds.length} districts`;
  } else if (type === "school") {
    const schoolIds = audience.school_ids || [];
    if (schoolIds.length === 0) return "No schools selected";
    if (schoolIds.length === 1) {
      const school = schools.find(s => s.id === schoolIds[0]);
      return school?.name || "1 school";
    }
    return `${schoolIds.length} schools`;
  } else if (type === "people") {
    const profileIds = audience.profile_ids || [];
    if (profileIds.length === 0) return "No people selected";
    if (profileIds.length === 1) {
      const instructor = instructors.find(i => i.id === profileIds[0]);
      return instructor?.full_name || "1 person";
    }
    return `${profileIds.length} people`;
  }

  return "Unknown audience";
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr.includes("T") ? dateStr : dateStr + "T00:00:00");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function formatDateTime(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const hours = date.getHours();
  const mins = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${months[date.getMonth()]} ${date.getDate()} at ${hour12}:${mins} ${ampm}`;
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
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

function getTwoWeeksOut() {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return date.toISOString().split("T")[0];
}

function getDefaultSendAt() {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return date.toISOString().slice(0, 16);
}

export default function UpdatesClient({ announcements, schools, instructors, programs, districts, adminName }) {
  const router = useRouter();

  // Composer state
  const [draftId, setDraftId] = useState(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audienceType, setAudienceType] = useState("all");
  const [audienceProgram, setAudienceProgram] = useState(programs[0] || "wellness");
  const [audienceDistrictIds, setAudienceDistrictIds] = useState([]);
  const [audienceSchoolIds, setAudienceSchoolIds] = useState([]);
  const [audienceProfileIds, setAudienceProfileIds] = useState([]);
  const [sendEmail, setSendEmail] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pinnedUntil, setPinnedUntil] = useState(getTwoWeeksOut());
  const [sendMode, setSendMode] = useState("now");
  const [sendAt, setSendAt] = useState(getDefaultSendAt());
  const [peopleSearch, setPeopleSearch] = useState("");

  // UI state
  const [tab, setTab] = useState("sent");
  const [loading, setLoading] = useState(false);
  const [recipientCount, setRecipientCount] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const [statsLoading, setStatsLoading] = useState({});
  const [stats, setStats] = useState({});
  const [dirty, setDirty] = useState(false);
  const autosaveTimer = useRef(null);

  // Build current audience object
  const getAudience = useCallback(() => {
    if (audienceType === "all") {
      return { type: "all" };
    } else if (audienceType === "program") {
      return { type: "program", program: audienceProgram };
    } else if (audienceType === "district") {
      return { type: "district", district_ids: audienceDistrictIds };
    } else if (audienceType === "school") {
      return { type: "school", school_ids: audienceSchoolIds };
    } else if (audienceType === "people") {
      return { type: "people", profile_ids: audienceProfileIds };
    }
    return { type: "all" };
  }, [audienceType, audienceProgram, audienceDistrictIds, audienceSchoolIds, audienceProfileIds]);

  // Fetch recipient count when audience changes
  useEffect(() => {
    const fetchCount = async () => {
      const audience = getAudience();
      const result = await getAnnouncementRecipientCount(audience);
      setRecipientCount(result.count || 0);
    };
    fetchCount();
  }, [getAudience]);

  // Mark as dirty when content changes - use a ref to track previous values
  const prevValues = useRef({ title, body, audienceType, audienceProgram, audienceDistrictIds, audienceSchoolIds, audienceProfileIds, sendEmail, pinned, pinnedUntil });
  useEffect(() => {
    const prev = prevValues.current;
    const hasChanged =
      prev.title !== title ||
      prev.body !== body ||
      prev.audienceType !== audienceType ||
      prev.audienceProgram !== audienceProgram ||
      JSON.stringify(prev.audienceDistrictIds) !== JSON.stringify(audienceDistrictIds) ||
      JSON.stringify(prev.audienceSchoolIds) !== JSON.stringify(audienceSchoolIds) ||
      JSON.stringify(prev.audienceProfileIds) !== JSON.stringify(audienceProfileIds) ||
      prev.sendEmail !== sendEmail ||
      prev.pinned !== pinned ||
      prev.pinnedUntil !== pinnedUntil;

    if (hasChanged && (title || body)) {
      setDirty(true);
    }
    prevValues.current = { title, body, audienceType, audienceProgram, audienceDistrictIds, audienceSchoolIds, audienceProfileIds, sendEmail, pinned, pinnedUntil };
  }, [title, body, audienceType, audienceProgram, audienceDistrictIds, audienceSchoolIds, audienceProfileIds, sendEmail, pinned, pinnedUntil]);

  // Autosave drafts every 3 seconds when dirty
  useEffect(() => {
    if (!dirty || !title.trim()) return;

    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
    }

    autosaveTimer.current = setTimeout(async () => {
      const result = await saveAnnouncementDraft({
        id: draftId,
        title,
        body,
        audience: getAudience(),
        sendEmail,
        pinnedUntil: pinned ? pinnedUntil : null,
      });

      if (result.success && !draftId) {
        setDraftId(result.id);
      }
      setDirty(false);
    }, 3000);

    return () => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
      }
    };
  }, [dirty, draftId, title, body, getAudience, sendEmail, pinned, pinnedUntil]);

  const resetComposer = () => {
    setDraftId(null);
    setTitle("");
    setBody("");
    setAudienceType("all");
    setAudienceProgram(programs[0] || "wellness");
    setAudienceDistrictIds([]);
    setAudienceSchoolIds([]);
    setAudienceProfileIds([]);
    setSendEmail(false);
    setPinned(false);
    setPinnedUntil(getTwoWeeksOut());
    setSendMode("now");
    setSendAt(getDefaultSendAt());
    setPeopleSearch("");
    setDirty(false);
    setEditingId(null);
  };

  const loadDraft = (announcement) => {
    setDraftId(announcement.id);
    setTitle(announcement.title || "");
    setBody(announcement.body || "");

    const audience = announcement.audience || { type: "all" };
    setAudienceType(audience.type || "all");
    setAudienceProgram(audience.program || programs[0] || "wellness");
    setAudienceDistrictIds(audience.district_ids || []);
    setAudienceSchoolIds(audience.school_ids || []);
    setAudienceProfileIds(audience.profile_ids || []);

    setSendEmail(announcement.send_email || false);
    setPinned(!!announcement.pinned_until);
    setPinnedUntil(announcement.pinned_until || getTwoWeeksOut());

    if (announcement.send_at) {
      setSendMode("schedule");
      setSendAt(announcement.send_at.slice(0, 16));
    } else {
      setSendMode("now");
      setSendAt(getDefaultSendAt());
    }

    setDirty(false);
    setEditingId(announcement.status === "sent" ? announcement.id : null);
  };

  const handleTemplateClick = (template) => {
    setTitle(template.title);
    setBody(template.body);
  };

  const handleDistrictToggle = (districtId) => {
    setAudienceDistrictIds((prev) =>
      prev.includes(districtId) ? prev.filter((id) => id !== districtId) : [...prev, districtId]
    );
  };

  const handleSchoolToggle = (schoolId) => {
    setAudienceSchoolIds((prev) =>
      prev.includes(schoolId) ? prev.filter((id) => id !== schoolId) : [...prev, schoolId]
    );
  };

  const handlePersonToggle = (profileId) => {
    setAudienceProfileIds((prev) =>
      prev.includes(profileId) ? prev.filter((id) => id !== profileId) : [...prev, profileId]
    );
  };

  const handleSend = async () => {
    if (!title.trim()) {
      alert("Please enter a title");
      return;
    }

    if (body.includes("{") && !window.confirm("Your message contains placeholder text (curly braces). Send anyway?")) {
      return;
    }

    setLoading(true);

    // Save draft first if needed
    let announcementId = draftId;
    if (!announcementId) {
      const saveResult = await saveAnnouncementDraft({
        title,
        body,
        audience: getAudience(),
        sendEmail,
        pinnedUntil: pinned ? pinnedUntil : null,
      });

      if (!saveResult.success) {
        alert(saveResult.error || "Failed to save");
        setLoading(false);
        return;
      }
      announcementId = saveResult.id;
    }

    // Send or schedule
    if (sendMode === "now") {
      const result = await sendAnnouncement(announcementId);
      if (!result.success) {
        alert(result.error || "Failed to send");
        setLoading(false);
        return;
      }
    } else {
      const result = await scheduleAnnouncement(announcementId, sendAt);
      if (!result.success) {
        alert(result.error || "Failed to schedule");
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    resetComposer();
    router.refresh();
  };

  const handleSaveEdit = async () => {
    if (!editingId || !title.trim()) return;

    setLoading(true);
    const result = await editAnnouncement(editingId, {
      title,
      body,
      pinnedUntil: pinned ? pinnedUntil : null,
    });
    setLoading(false);

    if (!result.success) {
      alert(result.error || "Failed to save");
      return;
    }

    resetComposer();
    router.refresh();
  };

  const handleSaveDraft = async () => {
    if (!title.trim()) {
      alert("Please enter a title");
      return;
    }

    setLoading(true);
    const result = await saveAnnouncementDraft({
      id: draftId,
      title,
      body,
      audience: getAudience(),
      sendEmail,
      pinnedUntil: pinned ? pinnedUntil : null,
    });
    setLoading(false);

    if (!result.success) {
      alert(result.error || "Failed to save");
      return;
    }

    if (!draftId) {
      setDraftId(result.id);
    }
    setDirty(false);
    router.refresh();
  };

  const handleArchive = async (id) => {
    if (!window.confirm("Archive this announcement? It will no longer appear in instructor inboxes.")) {
      return;
    }

    setLoading(true);
    const result = await archiveAnnouncement(id);
    setLoading(false);

    if (!result.success) {
      alert(result.error || "Failed to archive");
      return;
    }

    router.refresh();
  };

  const handleDeleteDraft = async (id) => {
    if (!window.confirm("Delete this draft?")) {
      return;
    }

    setLoading(true);
    const result = await deleteAnnouncementDraft(id);
    setLoading(false);

    if (!result.success) {
      alert(result.error || "Failed to delete");
      return;
    }

    if (draftId === id) {
      resetComposer();
    }
    router.refresh();
  };

  const handleRemind = async (id) => {
    setLoading(true);
    const result = await remindUnread(id);
    setLoading(false);

    if (!result.success) {
      alert(result.error || "Failed to send reminder");
      return;
    }

    alert(`Reminder sent to ${result.emailsSent} instructor${result.emailsSent !== 1 ? "s" : ""}`);
    router.refresh();
  };

  const handleSendNow = async (id) => {
    setLoading(true);
    const result = await sendAnnouncement(id);
    setLoading(false);

    if (!result.success) {
      alert(result.error || "Failed to send");
      return;
    }

    router.refresh();
  };

  const loadStats = async (id) => {
    if (stats[id]) return;

    setStatsLoading((prev) => ({ ...prev, [id]: true }));
    const result = await getAnnouncementReadStats(id);
    setStatsLoading((prev) => ({ ...prev, [id]: false }));

    if (!result.error) {
      setStats((prev) => ({ ...prev, [id]: result }));
    }
  };

  const filteredInstructors = peopleSearch
    ? instructors.filter((i) =>
        i.full_name?.toLowerCase().includes(peopleSearch.toLowerCase())
      )
    : instructors;

  const { sent, scheduled, drafts } = announcements;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Updates</h1>
        <p>Send announcements to instructors</p>
      </div>

      <div className={styles.layout}>
        {/* Left: Composer */}
        <div className={styles.composerColumn}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              {editingId ? "Edit Announcement" : "Compose"}
              {editingId && (
                <button type="button" className={styles.cancelEditBtn} onClick={resetComposer}>
                  Cancel
                </button>
              )}
            </div>

            {/* Templates */}
            {!editingId && (
              <div className={styles.templates}>
                {TEMPLATES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className={styles.templatePill}
                    onClick={() => handleTemplateClick(t)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {/* Title */}
            <div className={styles.field}>
              <label>Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., No class today"
                maxLength={80}
              />
            </div>

            {/* Message */}
            <div className={styles.field}>
              <label>Message</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your message..."
                maxLength={1000}
                rows={4}
              />
              <div className={styles.charCount}>{body.length}/1000</div>
            </div>

            {/* Audience */}
            {!editingId && (
              <div className={styles.field}>
                <label>Send to</label>
                <div className={styles.audienceControl}>
                  <button
                    type="button"
                    className={`${styles.audienceBtn} ${audienceType === "all" ? styles.active : ""}`}
                    onClick={() => setAudienceType("all")}
                  >
                    Everyone
                  </button>
                  <button
                    type="button"
                    className={`${styles.audienceBtn} ${audienceType === "program" ? styles.active : ""}`}
                    onClick={() => setAudienceType("program")}
                  >
                    A program
                  </button>
                  <button
                    type="button"
                    className={`${styles.audienceBtn} ${audienceType === "district" ? styles.active : ""}`}
                    onClick={() => setAudienceType("district")}
                  >
                    Districts
                  </button>
                  <button
                    type="button"
                    className={`${styles.audienceBtn} ${audienceType === "school" ? styles.active : ""}`}
                    onClick={() => setAudienceType("school")}
                  >
                    Schools
                  </button>
                  <button
                    type="button"
                    className={`${styles.audienceBtn} ${audienceType === "people" ? styles.active : ""}`}
                    onClick={() => setAudienceType("people")}
                  >
                    People
                  </button>
                </div>

                {audienceType === "program" && (
                  <select
                    value={audienceProgram}
                    onChange={(e) => setAudienceProgram(e.target.value)}
                    className={styles.select}
                  >
                    {programs.map((p) => (
                      <option key={p} value={p}>
                        {PROGRAM_LABELS[p] || p}
                      </option>
                    ))}
                  </select>
                )}

                {audienceType === "district" && (
                  <div className={styles.checkboxList}>
                    {districts.map((d) => (
                      <label key={d.id} className={styles.checkboxItem}>
                        <input
                          type="checkbox"
                          checked={audienceDistrictIds.includes(d.id)}
                          onChange={() => handleDistrictToggle(d.id)}
                        />
                        <span
                          className={styles.districtDot}
                          style={{ backgroundColor: d.color }}
                        />
                        {d.name}
                      </label>
                    ))}
                  </div>
                )}

                {audienceType === "school" && (
                  <div className={styles.checkboxList}>
                    {schools.map((s) => (
                      <label key={s.id} className={styles.checkboxItem}>
                        <input
                          type="checkbox"
                          checked={audienceSchoolIds.includes(s.id)}
                          onChange={() => handleSchoolToggle(s.id)}
                        />
                        {s.name}
                      </label>
                    ))}
                  </div>
                )}

                {audienceType === "people" && (
                  <div className={styles.peoplePicker}>
                    <input
                      type="text"
                      value={peopleSearch}
                      onChange={(e) => setPeopleSearch(e.target.value)}
                      placeholder="Search instructors..."
                      className={styles.searchInput}
                    />
                    <div className={styles.peopleList}>
                      {filteredInstructors.length === 0 ? (
                        <div className={styles.emptyList}>
                          {instructors.length === 0
                            ? "No instructors available"
                            : "No instructors found"}
                        </div>
                      ) : (
                        filteredInstructors.slice(0, 20).map((i) => (
                          <label key={i.id} className={styles.personItem}>
                            <input
                              type="checkbox"
                              checked={audienceProfileIds.includes(i.id)}
                              onChange={() => handlePersonToggle(i.id)}
                            />
                            <span className={styles.personAvatar}>
                              {i.avatar_url ? (
                                <Image src={i.avatar_url} alt="" width={24} height={24} />
                              ) : (
                                i.full_name?.charAt(0)?.toUpperCase() || "?"
                              )}
                            </span>
                            {i.full_name}
                          </label>
                        ))
                      )}
                    </div>
                    {audienceProfileIds.length > 0 && (
                      <div className={styles.selectedCount}>
                        {audienceProfileIds.length} selected
                      </div>
                    )}
                  </div>
                )}

                <div className={styles.recipientCount}>
                  {recipientCount} instructor{recipientCount !== 1 ? "s" : ""} will get this
                </div>
              </div>
            )}

            {/* Options */}
            <div className={styles.optionsBox}>
              <label className={styles.optionRow}>
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                />
                <span>Pin to top of inbox</span>
                {pinned && (
                  <input
                    type="date"
                    value={pinnedUntil}
                    onChange={(e) => setPinnedUntil(e.target.value)}
                    className={styles.dateInput}
                  />
                )}
              </label>

              {!editingId && (
                <label className={styles.optionRow}>
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                  />
                  <span>Also send email</span>
                </label>
              )}
            </div>

            {/* Send mode & actions */}
            {!editingId ? (
              <div className={styles.sendRow}>
                <div className={styles.sendModeToggle}>
                  <button
                    type="button"
                    className={`${styles.sendModeBtn} ${sendMode === "now" ? styles.active : ""}`}
                    onClick={() => setSendMode("now")}
                  >
                    Send now
                  </button>
                  <button
                    type="button"
                    className={`${styles.sendModeBtn} ${sendMode === "schedule" ? styles.active : ""}`}
                    onClick={() => setSendMode("schedule")}
                  >
                    Schedule
                  </button>
                </div>

                {sendMode === "schedule" && (
                  <input
                    type="datetime-local"
                    value={sendAt}
                    onChange={(e) => setSendAt(e.target.value)}
                    className={styles.dateTimeInput}
                    min={new Date().toISOString().slice(0, 16)}
                  />
                )}

                <div className={styles.sendActions}>
                  <button
                    type="button"
                    className={styles.saveDraftBtn}
                    onClick={handleSaveDraft}
                    disabled={loading || !title.trim()}
                  >
                    Save draft
                  </button>
                  <button
                    type="button"
                    className={styles.sendBtn}
                    onClick={handleSend}
                    disabled={loading || !title.trim()}
                  >
                    {loading ? "..." : sendMode === "now" ? `Send to ${recipientCount}` : "Schedule update"}
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.sendRow}>
                <div className={styles.sendActions}>
                  <button
                    type="button"
                    className={styles.sendBtn}
                    onClick={handleSaveEdit}
                    disabled={loading || !title.trim()}
                  >
                    {loading ? "..." : "Save changes"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Preview + List */}
        <div className={styles.listColumn}>
          {/* Preview */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>Preview</div>
            <div className={styles.preview}>
              <div className={styles.previewHeader}>
                {pinned && <span className={styles.pinnedBadge}>PINNED</span>}
                <div className={styles.previewIcon}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                </div>
                <div className={styles.previewMeta}>
                  <div className={styles.previewTitle}>
                    {title ? `From ${adminName}: ${title}` : "From Admin: Your title here"}
                  </div>
                  <div className={styles.previewBody}>
                    {body?.slice(0, 60) || "Your message will appear here..."}
                    {body?.length > 60 ? "..." : ""}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* List */}
          <div className={styles.card}>
            <div className={styles.tabs}>
              <button
                type="button"
                className={`${styles.tab} ${tab === "sent" ? styles.active : ""}`}
                onClick={() => setTab("sent")}
              >
                Sent
                {sent.length > 0 && <span className={styles.tabCount}>{sent.length}</span>}
              </button>
              <button
                type="button"
                className={`${styles.tab} ${tab === "scheduled" ? styles.active : ""}`}
                onClick={() => setTab("scheduled")}
              >
                Scheduled
                {scheduled.length > 0 && <span className={styles.tabCount}>{scheduled.length}</span>}
              </button>
              <button
                type="button"
                className={`${styles.tab} ${tab === "drafts" ? styles.active : ""}`}
                onClick={() => setTab("drafts")}
              >
                Drafts
                {drafts.length > 0 && <span className={styles.tabCount}>{drafts.length}</span>}
              </button>
            </div>

            <div className={styles.list}>
              {tab === "sent" && sent.length === 0 && (
                <div className={styles.emptyList}>No sent announcements yet</div>
              )}
              {tab === "scheduled" && scheduled.length === 0 && (
                <div className={styles.emptyList}>No scheduled announcements</div>
              )}
              {tab === "drafts" && drafts.length === 0 && (
                <div className={styles.emptyList}>No drafts</div>
              )}

              {tab === "sent" &&
                sent.map((a) => (
                  <div
                    key={a.id}
                    className={styles.listItem}
                    onMouseEnter={() => loadStats(a.id)}
                  >
                    <div className={styles.listItemHeader}>
                      <div className={styles.listItemTitle}>
                        {a.pinned_until && new Date(a.pinned_until) >= new Date() && (
                          <span className={styles.pinnedPill}>Pinned</span>
                        )}
                        {a.title}
                      </div>
                      <div className={styles.listItemDate}>{formatDate(a.sent_at || a.created_at)}</div>
                    </div>
                    <div className={styles.listItemMeta}>
                      {getAudienceText(a.audience, schools, instructors, districts)}
                      {a.edited_at && <span className={styles.editedBadge}>Edited</span>}
                    </div>
                    {stats[a.id] && (
                      <div className={styles.readStats}>
                        <div className={styles.readBar}>
                          <div
                            className={styles.readBarFill}
                            style={{
                              width: `${(stats[a.id].readCount / stats[a.id].totalRecipients) * 100}%`,
                            }}
                          />
                        </div>
                        <span className={styles.readCount}>
                          {stats[a.id].readCount}/{stats[a.id].totalRecipients} read
                        </span>
                        {stats[a.id].unreadNames.length > 0 && (
                          <span className={styles.unreadNames}>
                            Unread: {stats[a.id].unreadNames.slice(0, 3).join(", ")}
                            {stats[a.id].unreadNames.length > 3 && ` +${stats[a.id].unreadNames.length - 3}`}
                          </span>
                        )}
                      </div>
                    )}
                    {statsLoading[a.id] && (
                      <div className={styles.readStats}>Loading stats...</div>
                    )}
                    <div className={styles.listItemActions}>
                      <button type="button" onClick={() => loadDraft(a)}>Edit</button>
                      <button type="button" onClick={() => handleRemind(a.id)}>Remind</button>
                      <button type="button" onClick={() => handleArchive(a.id)}>Archive</button>
                    </div>
                  </div>
                ))}

              {tab === "scheduled" &&
                scheduled.map((a) => (
                  <div key={a.id} className={styles.listItem}>
                    <div className={styles.listItemHeader}>
                      <div className={styles.listItemTitle}>{a.title}</div>
                      <div className={styles.listItemDate}>Sends {formatDateTime(a.send_at)}</div>
                    </div>
                    <div className={styles.listItemMeta}>
                      {getAudienceText(a.audience, schools, instructors, districts)}
                    </div>
                    <div className={styles.listItemActions}>
                      <button type="button" onClick={() => loadDraft(a)}>Edit</button>
                      <button type="button" onClick={() => handleSendNow(a.id)}>Send now</button>
                    </div>
                  </div>
                ))}

              {tab === "drafts" &&
                drafts.map((a) => (
                  <div key={a.id} className={styles.listItem}>
                    <div className={styles.listItemHeader}>
                      <div className={styles.listItemTitle}>{a.title || "Untitled draft"}</div>
                      <div className={styles.listItemDate}>Last edited {formatRelativeTime(a.created_at)}</div>
                    </div>
                    <div className={styles.listItemActions}>
                      <button type="button" onClick={() => loadDraft(a)}>Edit</button>
                      <button type="button" onClick={() => handleDeleteDraft(a.id)}>Delete</button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
