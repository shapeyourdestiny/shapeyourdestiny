"use client";

import { useState, useRef, useEffect } from "react";
import Turnstile from "@/components/Turnstile";
import { countRequiredQuestions } from "@/lib/surveys/soccer-feedback";
import styles from "./survey.module.css";

export default function SurveyClient({ survey, isClosed }) {
  const [answers, setAnswers] = useState({});
  const [otherText, setOtherText] = useState({}); // Store "Other" text values
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pageLoadTime] = useState(() => Date.now());
  const [turnstileToken, setTurnstileToken] = useState("");
  const formRef = useRef(null);

  const totalRequired = countRequiredQuestions(survey);

  // Count answered required questions
  const countAnswered = () => {
    let count = 0;
    for (const section of survey.sections) {
      for (const q of section.questions) {
        if (q.required && isQuestionAnswered(q, answers[q.id])) {
          count++;
        }
      }
    }
    return count;
  };

  const isQuestionAnswered = (q, value) => {
    if (value === undefined || value === null || value === "") return false;
    if (q.type === "grid") {
      if (typeof value !== "object") return false;
      return q.rows.every((row) => value[row] !== undefined && value[row] !== null);
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    // Validate required questions
    const newErrors = {};
    for (const section of survey.sections) {
      for (const q of section.questions) {
        if (q.required && !isQuestionAnswered(q, answers[q.id])) {
          newErrors[q.id] = "Please answer this question";
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // Scroll to first error
      const firstErrorId = Object.keys(newErrors)[0];
      const element = document.getElementById(`question-${firstErrorId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/survey/${survey.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: buildFinalAnswers(),
          _plt: pageLoadTime,
          _hp: "", // honeypot
          "cf-turnstile-response": turnstileToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.errors) {
          setErrors(data.errors);
          const firstErrorId = Object.keys(data.errors)[0];
          const element = document.getElementById(`question-${firstErrorId}`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        } else if (data.error) {
          setErrors({ form: data.error });
        }
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("Submit error:", error);
      setErrors({ form: "Something went wrong. Please try again." });
      setSubmitting(false);
    }
  };

  const updateAnswer = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    if (errors[questionId]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[questionId];
        return newErrors;
      });
    }
  };

  const updateGridAnswer = (questionId, row, value) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        [row]: value,
      },
    }));
    if (errors[questionId]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[questionId];
        return newErrors;
      });
    }
  };

  const toggleCheckbox = (questionId, option) => {
    setAnswers((prev) => {
      const current = prev[questionId] || [];
      if (current.includes(option)) {
        return { ...prev, [questionId]: current.filter((o) => o !== option) };
      }
      return { ...prev, [questionId]: [...current, option] };
    });
  };

  const updateOtherText = (questionId, text) => {
    setOtherText((prev) => ({ ...prev, [questionId]: text }));
  };

  // Build final answers with "Other" text included
  const buildFinalAnswers = () => {
    const finalAnswers = { ...answers };

    // For each question with hasOtherText, append the other text if "Other" is selected
    for (const section of survey.sections) {
      for (const q of section.questions) {
        if (q.hasOtherText && otherText[q.id]) {
          if (q.type === "choice" && answers[q.id] === "Other") {
            finalAnswers[q.id] = `Other: ${otherText[q.id]}`;
          } else if (q.type === "checkboxes" && Array.isArray(answers[q.id]) && answers[q.id].includes("Other")) {
            finalAnswers[`${q.id}_other`] = otherText[q.id];
          }
        }
      }
    }

    return finalAnswers;
  };

  if (isClosed) {
    return (
      <>
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <span className={styles.pill}>{survey.pill}</span>
            <h1 className={styles.heroHeading}>{survey.title}</h1>
          </div>
        </section>
        <section className={styles.formSection}>
          <div className={styles.closedCard}>
            <div className={styles.closedIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
            </div>
            <p>This survey is closed. Thank you!</p>
          </div>
        </section>
      </>
    );
  }

  if (submitted) {
    return (
      <>
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <span className={styles.pill}>{survey.pill}</span>
            <h1 className={styles.heroHeading}>{survey.title}</h1>
          </div>
        </section>
        <section className={styles.formSection}>
          <div className={styles.thankYouCard}>
            <div className={styles.checkIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className={styles.thankYouHeading}>Thank you!</h2>
            <p className={styles.thankYouText}>
              Your feedback helps us keep making the program better for your students.
            </p>
          </div>
        </section>
      </>
    );
  }

  const answered = countAnswered();

  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <span className={styles.pill}>{survey.pill}</span>
          <h1 className={styles.heroHeading}>{survey.title}</h1>
          <p className={styles.heroIntro}>{survey.intro}</p>
        </div>
      </section>

      <section className={styles.formSection}>
        <div className={styles.progressWrapper}>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${(answered / totalRequired) * 100}%` }}
            />
          </div>
          <span className={styles.progressText}>
            {answered} of {totalRequired} answered
          </span>
        </div>

        {errors.form && (
          <div className={styles.formError}>{errors.form}</div>
        )}

        <form ref={formRef} onSubmit={handleSubmit}>
          {/* Honeypot */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            className={styles.honeypot}
            onChange={() => {
              // This should never be filled by humans
            }}
          />

          {survey.sections.map((section, sIdx) => (
            <div key={sIdx} className={styles.sectionCard}>
              <h2 className={styles.sectionTitle}>{section.title}</h2>
              {section.help && (
                <p className={styles.sectionHelp}>{section.help}</p>
              )}

              <div className={styles.questions}>
                {section.questions.map((q) => (
                  <div
                    key={q.id}
                    id={`question-${q.id}`}
                    className={`${styles.question} ${errors[q.id] ? styles.questionError : ""}`}
                  >
                    <QuestionField
                      question={q}
                      value={answers[q.id]}
                      onChange={(v) => updateAnswer(q.id, v)}
                      onGridChange={(row, v) => updateGridAnswer(q.id, row, v)}
                      onToggleCheckbox={(opt) => toggleCheckbox(q.id, opt)}
                      otherText={otherText[q.id] || ""}
                      onOtherTextChange={(text) => updateOtherText(q.id, text)}
                      error={errors[q.id]}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className={styles.submitSection}>
            <Turnstile onVerify={setTurnstileToken} />
            {errors.turnstile && (
              <span className={styles.fieldError}>{errors.turnstile}</span>
            )}

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={submitting}
            >
              {submitting ? "Sending..." : "Send feedback"}
            </button>
            <p className={styles.submitNote}>{survey.closingText}</p>
          </div>
        </form>
      </section>
    </>
  );
}

function QuestionField({ question, value, onChange, onGridChange, onToggleCheckbox, otherText, onOtherTextChange, error }) {
  const q = question;

  const renderLabel = () => (
    <label className={styles.label}>
      {q.label}
      {q.required && <span className={styles.required}>*</span>}
    </label>
  );

  switch (q.type) {
    case "dropdown":
      return (
        <div className={styles.fieldWrapper}>
          {renderLabel()}
          <SearchableDropdown
            options={q.options}
            value={value || ""}
            onChange={onChange}
            placeholder="Select..."
          />
          {q.help && <p className={styles.fieldHelp}>{q.help}</p>}
          {error && <span className={styles.fieldError}>{error}</span>}
        </div>
      );

    case "choice":
      return (
        <fieldset className={styles.fieldWrapper}>
          <legend className={styles.label}>
            {q.label}
            {q.required && <span className={styles.required}>*</span>}
          </legend>
          <div className={styles.choiceGrid}>
            {q.options.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`${styles.choiceBtn} ${value === opt ? styles.choiceBtnActive : ""}`}
                onClick={() => onChange(opt)}
                aria-pressed={value === opt}
              >
                {opt}
              </button>
            ))}
          </div>
          {q.hasOtherText && value === "Other" && (
            <input
              type="text"
              className={styles.otherInput}
              placeholder="Please specify..."
              value={otherText}
              onChange={(e) => onOtherTextChange(e.target.value)}
              maxLength={100}
            />
          )}
          {error && <span className={styles.fieldError}>{error}</span>}
        </fieldset>
      );

    case "checkboxes":
      const hasOtherChecked = (value || []).includes("Other");
      return (
        <fieldset className={styles.fieldWrapper}>
          <legend className={styles.label}>
            {q.label}
            {q.required && <span className={styles.required}>*</span>}
          </legend>
          <div className={styles.chipGrid}>
            {q.options.map((opt) => {
              const isChecked = (value || []).includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  className={`${styles.chip} ${isChecked ? styles.chipActive : ""}`}
                  onClick={() => onToggleCheckbox(opt)}
                  aria-pressed={isChecked}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          {q.hasOtherText && hasOtherChecked && (
            <input
              type="text"
              className={styles.otherInput}
              placeholder="Please specify..."
              value={otherText}
              onChange={(e) => onOtherTextChange(e.target.value)}
              maxLength={100}
            />
          )}
          {error && <span className={styles.fieldError}>{error}</span>}
        </fieldset>
      );

    case "stars":
      return (
        <fieldset className={styles.fieldWrapper}>
          <legend className={styles.label}>
            {q.label}
            {q.required && <span className={styles.required}>*</span>}
          </legend>
          <StarRating value={value} onChange={onChange} />
          {error && <span className={styles.fieldError}>{error}</span>}
        </fieldset>
      );

    case "grid":
      return (
        <fieldset className={styles.fieldWrapper}>
          <legend className={styles.label}>
            {q.label}
            {q.required && <span className={styles.required}>*</span>}
          </legend>
          {q.help && <p className={styles.fieldHelp}>{q.help}</p>}
          <div className={styles.gridWrapper}>
            {q.rows.map((row) => (
              <div key={row} className={styles.gridRow}>
                <span className={styles.gridRowLabel}>{row}</span>
                <StarRating
                  value={value?.[row]}
                  onChange={(v) => onGridChange(row, v)}
                  size="small"
                />
              </div>
            ))}
          </div>
          {error && <span className={styles.fieldError}>{error}</span>}
        </fieldset>
      );

    case "scale":
      return (
        <fieldset className={styles.fieldWrapper}>
          <legend className={styles.label}>
            {q.label}
            {q.required && <span className={styles.required}>*</span>}
          </legend>
          <div className={styles.scaleWrapper}>
            <div className={styles.scaleLabels}>
              <span>{q.minLabel}</span>
              <span>{q.maxLabel}</span>
            </div>
            <div className={styles.scaleGrid}>
              {Array.from({ length: q.max - q.min + 1 }, (_, i) => q.min + i).map((num) => (
                <button
                  key={num}
                  type="button"
                  className={`${styles.scaleBtn} ${value === num ? styles.scaleBtnActive : ""}`}
                  onClick={() => onChange(num)}
                  aria-pressed={value === num}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
          {error && <span className={styles.fieldError}>{error}</span>}
        </fieldset>
      );

    case "short":
      return (
        <div className={styles.fieldWrapper}>
          {renderLabel()}
          <input
            type="text"
            className={styles.textInput}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={q.placeholder || ""}
            maxLength={q.maxLength || 100}
          />
          {error && <span className={styles.fieldError}>{error}</span>}
        </div>
      );

    case "long":
      return (
        <div className={styles.fieldWrapper}>
          {renderLabel()}
          <textarea
            className={styles.textarea}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={q.placeholder || ""}
            maxLength={q.maxLength || 1000}
            rows={4}
          />
          {q.help && <p className={styles.fieldHelp}>{q.help}</p>}
          <span className={styles.charCount}>
            {(value || "").length}/{q.maxLength || 1000}
          </span>
          {error && <span className={styles.fieldError}>{error}</span>}
        </div>
      );

    case "consent":
      return (
        <div className={styles.fieldWrapper}>
          <label className={styles.consentLabel}>
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => onChange(e.target.checked)}
            />
            <span>{q.label}</span>
          </label>
          {error && <span className={styles.fieldError}>{error}</span>}
        </div>
      );

    default:
      return null;
  }
}

function StarRating({ value, onChange, size = "normal" }) {
  const starSize = size === "small" ? 36 : 52;

  return (
    <div className={styles.starRow} data-size={size}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={styles.starBtn}
          onClick={() => onChange(star)}
          aria-label={`${star} star${star > 1 ? "s" : ""}`}
          aria-pressed={star <= (value || 0)}
          style={{ width: starSize, height: starSize }}
        >
          <svg viewBox="0 0 24 24" fill={star <= (value || 0) ? "#F2A93B" : "#DCE3F1"}>
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

function SearchableDropdown({ options, value, onChange, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = options.filter((opt) =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (opt) => {
    onChange(opt);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div ref={wrapperRef} className={styles.dropdown}>
      <button
        type="button"
        className={styles.dropdownTrigger}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
      >
        <span className={value ? styles.dropdownValue : styles.dropdownPlaceholder}>
          {value || placeholder}
        </span>
        <svg className={styles.dropdownArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className={styles.dropdownMenu}>
          <input
            ref={inputRef}
            type="text"
            className={styles.dropdownSearch}
            placeholder="Type to search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className={styles.dropdownOptions}>
            {filtered.length === 0 ? (
              <div className={styles.dropdownEmpty}>No matches</div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`${styles.dropdownOption} ${value === opt ? styles.dropdownOptionActive : ""}`}
                  onClick={() => handleSelect(opt)}
                >
                  {opt}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
