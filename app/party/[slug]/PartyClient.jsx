"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./party.module.css";

const STORAGE_KEY_PREFIX = "party_rsvp_";

// Format date for display
function formatDate(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

// Format time for display
function formatTime(timeStr) {
  if (!timeStr) return "";
  const [hours, minutes] = timeStr.split(":");
  const h = parseInt(hours);
  const ampm = h >= 12 ? "PM" : "AM";
  const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayHour}:${minutes} ${ampm}`;
}

// Get short weekday
function getShortWeekday(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[d.getDay()];
}

// Split location into name and subtitle
function parseLocation(location) {
  if (!location) return { name: "", subtitle: "" };
  const parts = location.split(",").map((s) => s.trim());
  if (parts.length >= 2) {
    return { name: parts[0], subtitle: parts.slice(1).join(", ") };
  }
  return { name: location, subtitle: "" };
}

// Check if title contains "Christmas" (case insensitive)
function hasChristmas(title) {
  return /christmas/i.test(title);
}

// Render title with Christmas styling
function renderTitle(title) {
  if (!hasChristmas(title)) return title;

  const parts = title.split(/(\bChristmas\b)/i);
  return parts.map((part, i) =>
    /christmas/i.test(part) ? (
      <span key={i} className={styles.goldText}>{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

// Ornament SVG
function OrnamentSVG({ className }) {
  return (
    <svg className={className} viewBox="0 0 70 90" fill="none" aria-hidden="true">
      <path d="M35 0v20" stroke="#E8A93A" strokeWidth="2" />
      <rect x="29" y="18" width="12" height="8" rx="2" fill="#E8A93A" />
      <circle cx="35" cy="54" r="30" fill="#C8443A" />
      <path d="M8 48c18 8 36 8 54 0" stroke="#fff" strokeOpacity=".5" strokeWidth="3" />
      <path d="M8 60c18 8 36 8 54 0" stroke="#E8A93A" strokeWidth="3" />
      <circle cx="25" cy="40" r="6" fill="#fff" fillOpacity=".25" />
    </svg>
  );
}

// Calendar icon
function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

// Location pin icon
function LocationIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

// Gift icon
function GiftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="13" rx="2" />
      <path d="M12 8v13M3 12h18M12 8c-2-4-6-4-6-1s6 1 6 1zm0 0c2-4 6-4 6-1s-6 1-6 1z" />
    </svg>
  );
}

// Check icon
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.6" strokeLinecap="round">
      <path d="M5 12l4 4L19 6" />
    </svg>
  );
}

export default function PartyClient({ event, slug, creatorFirstName, isCancelled, hasStarted }) {
  // Form state
  const [name, setName] = useState("");
  const [attending, setAttending] = useState(null);
  const [adults, setAdults] = useState(0);
  const [kids, setKids] = useState(0);
  const [note, setNote] = useState("");
  const [noteExpanded, setNoteExpanded] = useState(false);

  // Submission state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);

  // Conflict state (name already exists)
  const [showConflict, setShowConflict] = useState(false);
  const [conflictName, setConflictName] = useState("");

  // Load time for spam protection - set once on mount
  const loadTimeRef = useRef(0);
  useEffect(() => {
    loadTimeRef.current = Date.now();
  }, []);

  // Check localStorage for existing RSVP
  useEffect(() => {
    let stored;
    try {
      stored = localStorage.getItem(STORAGE_KEY_PREFIX + event.id);
    } catch {
      // Ignore localStorage errors
      return;
    }
    if (!stored) return;

    let data;
    try {
      data = JSON.parse(stored);
    } catch {
      // Ignore parse errors
      return;
    }

    // Schedule state update for next tick to avoid synchronous setState in effect
    const timer = setTimeout(() => {
      setSubmittedData(data);
      setSubmitted(true);
    }, 0);

    return () => clearTimeout(timer);
  }, [event.id]);

  // Parse note into paragraphs
  const noteParagraphs = event.note ? event.note.split("\n").filter((p) => p.trim()) : [];
  const firstParagraph = noteParagraphs[0] || "";
  const hasMoreParagraphs = noteParagraphs.length > 1;

  // Location parsing
  const { name: locationName, subtitle: locationSubtitle } = parseLocation(event.location);

  // Calculate group total
  const groupTotal = attending ? 1 + adults + kids : 0;

  // Build group summary text
  const buildGroupSummary = () => {
    const parts = ["you"];
    if (adults > 0) parts.push(`${adults} adult${adults > 1 ? "s" : ""}`);
    if (kids > 0) parts.push(`${kids} kid${kids > 1 ? "s" : ""}`);
    return `Your group: ${parts.join(" + ")} = ${groupTotal} ${groupTotal === 1 ? "person" : "people"}`;
  };

  // Handle form submission
  const handleSubmit = async (forceUpdate = false) => {
    if (loading) return;

    // Validate
    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }
    if (name.trim().length < 2) {
      setError("Please enter your full name");
      return;
    }
    if (attending === null) {
      setError("Please let us know if you can make it");
      return;
    }

    setLoading(true);
    setError(null);
    setShowConflict(false);

    try {
      const response = await fetch(`/api/party/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          attending,
          guestAdults: attending ? adults : 0,
          guestKids: attending ? kids : 0,
          note: note.trim() || null,
          forceUpdate,
          _plt: loadTimeRef.current,
          _hp: "", // honeypot
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.nameConflict) {
          setConflictName(data.existingName);
          setShowConflict(true);
          setLoading(false);
          return;
        }
        throw new Error(data.error || "Something went wrong");
      }

      // Save to localStorage
      const rsvpData = {
        id: data.id,
        name: name.trim(),
        attending,
        adults: attending ? adults : 0,
        kids: attending ? kids : 0,
      };

      try {
        localStorage.setItem(STORAGE_KEY_PREFIX + event.id, JSON.stringify(rsvpData));
      } catch {
        // Ignore localStorage errors
      }

      setSubmittedData(rsvpData);
      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle "Change my RSVP"
  const handleChange = () => {
    if (submittedData) {
      setName(submittedData.name);
      setAttending(submittedData.attending);
      setAdults(submittedData.adults || 0);
      setKids(submittedData.kids || 0);
    }
    setSubmitted(false);
    setSubmittedData(null);
  };

  // Desktop layout check
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Render cancelled state
  if (isCancelled) {
    return (
      <div className={styles.page}>
        <div className={styles.hero}>
          <div className={styles.snow} />
          <div className={styles.eyebrow}>TEAM PARTY</div>
          <h1 className={styles.heroTitle}>{renderTitle(event.title)}</h1>
        </div>
        <div className={styles.closedMessage}>
          <h2>This event was cancelled.</h2>
        </div>
      </div>
    );
  }

  // Render closed state
  if (hasStarted) {
    return (
      <div className={styles.page}>
        <div className={styles.hero}>
          <div className={styles.snow} />
          <div className={styles.eyebrow}>TEAM PARTY</div>
          <h1 className={styles.heroTitle}>{renderTitle(event.title)}</h1>
        </div>
        <div className={styles.closedMessage}>
          <h2>RSVPs are closed.</h2>
          <p>See you there!</p>
        </div>
      </div>
    );
  }

  // Render form/confirmation
  const renderForm = () => {
    if (submitted && submittedData) {
      // Confirmation view
      if (!submittedData.attending) {
        return (
          <div className={styles.declinedConfirm}>
            <h2 className={styles.declinedTitle}>Thanks for letting us know.</h2>
            <p className={styles.confirmSubtitle}>We will miss you!</p>
            <button className={styles.ghostBtn} onClick={handleChange}>
              Change my RSVP
            </button>
          </div>
        );
      }

      return (
        <div className={styles.confirmation}>
          <div className={styles.checkCircle}>
            <CheckIcon />
          </div>
          <h2 className={styles.confirmTitle}>You are on the list!</h2>
          <p className={styles.confirmSubtitle}>
            See you {getShortWeekday(event.event_date)}, {formatDate(event.event_date).split(",")[1]} at {formatTime(event.start_time)}.
          </p>
          <div className={styles.chips}>
            <span className={styles.chip}>You</span>
            {submittedData.adults > 0 && (
              <span className={styles.chip}>+{submittedData.adults} adult{submittedData.adults > 1 ? "s" : ""}</span>
            )}
            {submittedData.kids > 0 && (
              <span className={styles.chip}>+{submittedData.kids} kid{submittedData.kids > 1 ? "s" : ""}</span>
            )}
          </div>
          {event.location_url && (
            <a
              href={event.location_url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.ghostBtn}
            >
              <LocationIcon />
              Directions
            </a>
          )}
          <button className={styles.ghostBtn} onClick={handleChange}>
            Change my RSVP
          </button>
        </div>
      );
    }

    // Form view
    return (
      <div className={styles.formSection}>
        {isDesktop && <h2 className={styles.formTitle}>RSVP</h2>}

        {error && <div className={styles.error}>{error}</div>}

        {showConflict && (
          <div className={styles.conflictDialog}>
            <p>We already have an RSVP for <strong>{conflictName}</strong>. Update it?</p>
            <div className={styles.conflictButtons}>
              <button
                className={`${styles.conflictBtn} ${styles.primary}`}
                onClick={() => handleSubmit(true)}
                disabled={loading}
              >
                Update
              </button>
              <button
                className={`${styles.conflictBtn} ${styles.secondary}`}
                onClick={() => setShowConflict(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Honeypot field */}
        <input
          type="text"
          name="_hp"
          style={{ display: "none" }}
          tabIndex={-1}
          autoComplete="off"
        />

        {/* Name */}
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Your name</label>
          <input
            type="text"
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="First and last name"
            maxLength={80}
            autoComplete="name"
          />
        </div>

        {/* Yes/No */}
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Will you be there?</label>
          <div className={styles.ynButtons}>
            <button
              type="button"
              className={`${styles.ynBtn} ${attending === true ? styles.on : ""}`}
              onClick={() => setAttending(true)}
            >
              <CheckIcon />
              I will be there
            </button>
            <button
              type="button"
              className={`${styles.ynBtn} ${attending === false ? styles.on : ""}`}
              onClick={() => setAttending(false)}
            >
              Can not make it
            </button>
          </div>
        </div>

        {/* Guest steppers (only if attending and guests allowed) */}
        {attending && event.allow_guests && (
          <>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Who is coming with you?</label>

              {/* Adults */}
              <div className={styles.stepper}>
                <div className={styles.stepperInfo}>
                  <b>Adults</b>
                  <span>Partner, spouse or another adult</span>
                </div>
                <div className={styles.stepperControls}>
                  <button
                    type="button"
                    className={styles.stepperBtn}
                    onClick={() => setAdults(Math.max(0, adults - 1))}
                    disabled={adults === 0}
                  >
                    -
                  </button>
                  <span className={styles.stepperValue}>{adults}</span>
                  <button
                    type="button"
                    className={`${styles.stepperBtn} ${styles.plus}`}
                    onClick={() => setAdults(Math.min(6, adults + 1))}
                    disabled={adults >= 6}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Kids */}
              <div className={styles.stepper}>
                <div className={styles.stepperInfo}>
                  <b>Kids</b>
                  <span>Any age</span>
                </div>
                <div className={styles.stepperControls}>
                  <button
                    type="button"
                    className={styles.stepperBtn}
                    onClick={() => setKids(Math.max(0, kids - 1))}
                    disabled={kids === 0}
                  >
                    -
                  </button>
                  <span className={styles.stepperValue}>{kids}</span>
                  <button
                    type="button"
                    className={`${styles.stepperBtn} ${styles.plus}`}
                    onClick={() => setKids(Math.min(10, kids + 1))}
                    disabled={kids >= 10}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Group summary */}
              <div className={styles.totalSummary}>{buildGroupSummary()}</div>
            </div>
          </>
        )}

        {/* Optional note */}
        <div className={styles.field}>
          <label className={styles.fieldLabel}>
            Anything we should know? <span className={styles.fieldHint}>Optional</span>
          </label>
          <textarea
            className={styles.textarea}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Allergies, kids' ages, arriving late..."
            maxLength={300}
          />
        </div>

        {/* Submit button */}
        {!isDesktop && (
          <div className={styles.submitFooter}>
            <button
              type="button"
              className={styles.submitBtn}
              onClick={() => handleSubmit(false)}
              disabled={loading}
            >
              {loading ? "Sending..." : "Send my RSVP"}
            </button>
          </div>
        )}

        {isDesktop && (
          <div className={styles.submitFooter}>
            <button
              type="button"
              className={styles.submitBtn}
              onClick={() => handleSubmit(false)}
              disabled={loading}
            >
              {loading ? "Sending..." : "Send my RSVP"}
            </button>
          </div>
        )}
      </div>
    );
  };

  // Mobile layout
  if (!isDesktop) {
    return (
      <div className={styles.page}>
        {/* Hero */}
        <div className={styles.hero}>
          <div className={styles.snow} />
          {hasChristmas(event.title) && <OrnamentSVG className={styles.ornament} />}
          <div className={styles.eyebrow}>TEAM PARTY</div>
          <h1 className={styles.heroTitle}>{renderTitle(event.title)}</h1>
          <p className={styles.heroDetails}>{event.details}</p>
        </div>

        {/* Info card */}
        <div className={styles.infoCard}>
          <div className={styles.infoRow}>
            <div className={styles.infoIcon}>
              <CalendarIcon />
            </div>
            <div>
              <b>{formatDate(event.event_date)}</b>
              <span>{formatTime(event.start_time)} to {formatTime(event.end_time)}</span>
            </div>
          </div>
          <div className={styles.infoRow}>
            <div className={styles.infoIcon}>
              <LocationIcon />
            </div>
            <div>
              <b>{locationName}</b>
              {locationSubtitle && <span>{locationSubtitle}</span>}
            </div>
            {event.location_url && (
              <a
                href={event.location_url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.directionsBtn}
              >
                Directions
              </a>
            )}
          </div>
        </div>

        {/* Note section */}
        {event.note && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>A note from {creatorFirstName}</h2>
            <div className={styles.noteCard}>
              <div className={styles.notePreview}>
                {noteExpanded ? (
                  noteParagraphs.map((p, i) => <p key={i}>{p}</p>)
                ) : (
                  <p>{firstParagraph}{hasMoreParagraphs ? "..." : ""}</p>
                )}
              </div>
              {hasMoreParagraphs && !noteExpanded && (
                <button className={styles.moreBtn} onClick={() => setNoteExpanded(true)}>
                  Read the whole note
                </button>
              )}
            </div>
            {event.highlight && (
              <div className={styles.bonus}>
                <GiftIcon />
                {event.highlight}
              </div>
            )}
          </div>
        )}

        {/* Form */}
        {renderForm()}

        {/* Footer */}
        <div className={styles.pageFooter}>
          Shape Your Destiny
        </div>
      </div>
    );
  }

  // Desktop layout
  return (
    <div className={styles.page}>
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.snow} />
        <div className={styles.heroInner}>
          {hasChristmas(event.title) && <OrnamentSVG className={styles.ornament} />}
          <div className={styles.eyebrow}>TEAM PARTY</div>
          <h1 className={styles.heroTitle}>{renderTitle(event.title)}</h1>
          <p className={styles.heroDetails}>{event.details}</p>
        </div>
      </div>

      {/* Main content */}
      <div className={styles.mainContent}>
        <div className={styles.columns}>
          {/* Left column */}
          <div className={styles.leftColumn}>
            {/* Info card */}
            <div className={styles.infoCard}>
              <div className={styles.infoCardDesktop}>
                <div className={styles.infoRow}>
                  <div className={styles.infoIcon}>
                    <CalendarIcon />
                  </div>
                  <div>
                    <b>{formatDate(event.event_date)}</b>
                    <span>{formatTime(event.start_time)} to {formatTime(event.end_time)}</span>
                  </div>
                </div>
                <div className={styles.infoRow}>
                  <div className={styles.infoIcon}>
                    <LocationIcon />
                  </div>
                  <div>
                    <b>{locationName}</b>
                    {locationSubtitle && <span>{locationSubtitle}</span>}
                  </div>
                  {event.location_url && (
                    <a
                      href={event.location_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.directionsBtn}
                    >
                      Directions
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Note section - fully expanded on desktop */}
            {event.note && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>A note from {creatorFirstName}</h2>
                <div className={styles.noteCard}>
                  {noteParagraphs.map((p, i) => (
                    <p key={i} style={{ margin: i === noteParagraphs.length - 1 ? 0 : "0 0 12px" }}>{p}</p>
                  ))}
                </div>
                {event.highlight && (
                  <div className={styles.bonus}>
                    <GiftIcon />
                    {event.highlight}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right column - Form card */}
          <div className={styles.rightColumn}>
            <div className={styles.formCard}>
              {renderForm()}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={styles.pageFooter}>
        Shape Your Destiny
      </div>
    </div>
  );
}
