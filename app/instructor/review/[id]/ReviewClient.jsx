"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import styles from "./Review.module.css";
import { submitSessionReview } from "@/lib/instructor/actions";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDateRange(start, end) {
  const startD = new Date(start + "T12:00:00");
  const endD = new Date(end + "T12:00:00");
  return `${MONTHS[startD.getMonth()]} ${startD.getDate()} - ${MONTHS[endD.getMonth()]} ${endD.getDate()}`;
}

function StarRating({ value, onChange, label, required }) {
  return (
    <div className={styles.starRow} role="group" aria-label={label}>
      <span className={styles.starLabel}>
        {label}
        {required && <span className={styles.required}>*</span>}
      </span>
      <div className={styles.starButtons}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            className={styles.starBtn}
            onClick={() => onChange(value === i ? null : i)}
            aria-label={`${label}: ${i} of 5`}
            aria-pressed={i <= (value || 0)}
          >
            <svg viewBox="0 0 24 24" fill={i <= (value || 0) ? "#F2A93B" : "#DCE3F1"}>
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}

function CoworkerRating({ coworker, rating, onRatingChange, comment, onCommentChange }) {
  const initial = coworker.profiles?.full_name?.charAt(0)?.toUpperCase() || "?";
  const firstName = coworker.profiles?.full_name?.split(" ")[0] || "Teammate";

  return (
    <div className={styles.coworkerCard}>
      <div className={styles.coworkerHeader}>
        {coworker.profiles?.avatar_url ? (
          <Image
            src={coworker.profiles.avatar_url}
            alt=""
            width={40}
            height={40}
            className={styles.coworkerAvatar}
          />
        ) : (
          <div className={styles.coworkerAvatarPlaceholder}>{initial}</div>
        )}
        <div className={styles.coworkerInfo}>
          <span className={styles.coworkerName}>{coworker.profiles?.full_name}</span>
          <span className={styles.coworkerSessions}>
            {coworker.classes_together} {coworker.classes_together === 1 ? "class" : "classes"} together
          </span>
        </div>
      </div>
      <div className={styles.coworkerStars}>
        <span className={styles.starLabel}>
          Working with {firstName}
          <span className={styles.required}>*</span>
        </span>
        <div className={styles.starButtons}>
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              className={styles.starBtn}
              onClick={() => onRatingChange(rating === i ? null : i)}
              aria-label={`Working with ${firstName}: ${i} of 5`}
              aria-pressed={i <= (rating || 0)}
            >
              <svg viewBox="0 0 24 24" fill={i <= (rating || 0) ? "#F2A93B" : "#DCE3F1"}>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
          ))}
        </div>
      </div>
      <textarea
        className={styles.coworkerComment}
        placeholder={`Anything to share about working with ${firstName}? (optional)`}
        value={comment || ""}
        onChange={(e) => onCommentChange(e.target.value)}
        rows={2}
      />
    </div>
  );
}

export default function ReviewClient({ review }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form state
  const [overall, setOverall] = useState(review.overall || null);
  const [kidsGrowth, setKidsGrowth] = useState(review.kids_growth || null);
  const [support, setSupport] = useState(review.support || null);
  const [wentWell, setWentWell] = useState(review.went_well || "");
  const [changeNext, setChangeNext] = useState(review.change_next || "");
  const [needs, setNeeds] = useState(review.needs || "");
  const [coworkerRatings, setCoworkerRatings] = useState(
    (review.coworkers || []).map((cw) => ({
      coworkerId: cw.coworker_id,
      rating: cw.rating || null,
      comment: cw.comment || "",
    }))
  );

  const schoolName = review.classes?.schools?.name || "Session";
  const program = review.classes?.program === "soccer" ? "Soccer" : "Wellness";

  // Show thank you view if already submitted
  if (review.status === "submitted") {
    return (
      <div className={styles.page}>
        <div className={styles.thankYou}>
          <div className={styles.thankYouIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h1 className={styles.thankYouTitle}>Review submitted</h1>
          <p className={styles.thankYouText}>
            Thanks for your feedback on your {schoolName} session. It helps us make the next one even better.
          </p>
          <Link href="/instructor/inbox" className={styles.thankYouBtn}>
            Back to Inbox
          </Link>
        </div>
      </div>
    );
  }

  const handleCoworkerRatingChange = (index, rating) => {
    setCoworkerRatings((prev) =>
      prev.map((cw, i) => (i === index ? { ...cw, rating } : cw))
    );
  };

  const handleCoworkerCommentChange = (index, comment) => {
    setCoworkerRatings((prev) =>
      prev.map((cw, i) => (i === index ? { ...cw, comment } : cw))
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (!overall || !kidsGrowth || !support) {
      setError("Please complete all star ratings");
      return;
    }
    if (!wentWell.trim()) {
      setError("Please share what went well");
      return;
    }
    if (!changeNext.trim()) {
      setError("Please share what you would change");
      return;
    }

    // Validate coworker ratings
    for (const cw of coworkerRatings) {
      if (!cw.rating) {
        setError("Please rate all co-instructors");
        return;
      }
    }

    setLoading(true);

    try {
      const result = await submitSessionReview(review.id, {
        overall,
        kidsGrowth,
        support,
        wentWell,
        changeNext,
        needs,
        coworkerRatings,
      });

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      // Refresh the page to show thank you
      router.refresh();
    } catch (err) {
      setError(err.message || "Failed to submit review");
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <Link href="/instructor/inbox" className={styles.backBtn}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <div className={styles.headerContent}>
          <span className={styles.headerLabel}>{program} at</span>
          <h1 className={styles.headerTitle}>{schoolName}</h1>
        </div>
      </header>

      {/* Stats row */}
      <div className={styles.stats}>
        <div className={styles.statItem}>
          <span className={styles.statNum}>{review.classes_taught}</span>
          <span className={styles.statLabel}>Classes</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statNum}>{review.teammatesCount || 0}</span>
          <span className={styles.statLabel}>Teammates</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statNum}>{review.shoutOutsCount || 0}</span>
          <span className={styles.statLabel}>Shout-outs</span>
        </div>
      </div>

      {/* Date range */}
      <p className={styles.dateRange}>
        {formatDateRange(review.session_start, review.session_end)}
      </p>

      {/* Shout-outs received */}
      {review.shoutOuts && review.shoutOuts.length > 0 && (
        <div className={styles.shoutOutsSection}>
          <h2 className={styles.sectionTitle}>Shout-outs you received</h2>
          <div className={styles.shoutOutsList}>
            {review.shoutOuts.map((so) => (
              <div key={so.id} className={styles.shoutOutCard}>
                <span className={styles.shoutOutFrom}>From {so.from_first_name}</span>
                <p className={styles.shoutOutMessage}>&ldquo;{so.message}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className={styles.form}>
        {error && <div className={styles.error}>{error}</div>}

        {/* Overall ratings */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>How was this session?</h2>
          <div className={styles.starRows}>
            <StarRating
              label="Overall"
              value={overall}
              onChange={setOverall}
              required
            />
            <StarRating
              label="Kids' growth"
              value={kidsGrowth}
              onChange={setKidsGrowth}
              required
            />
            <StarRating
              label="Support from office"
              value={support}
              onChange={setSupport}
              required
            />
          </div>
        </div>

        {/* Co-instructor ratings */}
        {review.coworkers && review.coworkers.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Working with your teammates</h2>
            <div className={styles.coworkersList}>
              {review.coworkers.map((cw, index) => {
                const ratingData = coworkerRatings.find(
                  (cr) => cr.coworkerId === cw.coworker_id
                );
                return (
                  <CoworkerRating
                    key={cw.coworker_id}
                    coworker={cw}
                    rating={ratingData?.rating}
                    onRatingChange={(rating) => handleCoworkerRatingChange(index, rating)}
                    comment={ratingData?.comment}
                    onCommentChange={(comment) => handleCoworkerCommentChange(index, comment)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Text answers */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Tell us more</h2>

          <div className={styles.field}>
            <label htmlFor="went-well">
              What went well?
              <span className={styles.required}>*</span>
            </label>
            <textarea
              id="went-well"
              className={styles.textarea}
              value={wentWell}
              onChange={(e) => setWentWell(e.target.value)}
              placeholder="What did you enjoy most? What were your wins?"
              rows={3}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="change-next">
              What would you change?
              <span className={styles.required}>*</span>
            </label>
            <textarea
              id="change-next"
              className={styles.textarea}
              value={changeNext}
              onChange={(e) => setChangeNext(e.target.value)}
              placeholder="What could be better next time?"
              rows={3}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="needs">
              Anything you need from the office? (optional)
            </label>
            <textarea
              id="needs"
              className={styles.textarea}
              value={needs}
              onChange={(e) => setNeeds(e.target.value)}
              placeholder="Supplies, support, questions..."
              rows={2}
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className={styles.submitBtn}
          disabled={loading}
        >
          {loading ? "Submitting..." : "Submit review"}
        </button>
      </form>
    </div>
  );
}
