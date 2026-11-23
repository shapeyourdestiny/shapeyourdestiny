"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import Turnstile from "@/components/Turnstile";
import styles from "./survey.module.css";

const STORAGE_KEY_PREFIX = "survey_";
const AUTO_ADVANCE_DELAY = 350;

// Star labels for display
const STAR_LABELS = ["Not great", "Okay", "Good", "Great", "Amazing!"];

// Detect Mac for keyboard hints
const isMac = typeof window !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

// Haptic feedback helper - Android only
const hapticFeedback = () => {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      navigator.vibrate(8);
    } catch {
      // Ignore if not supported
    }
  }
};

// Check if any rating is low (1 or 2 stars)
function hasLowRating(answers) {
  const result = { hasLow: false, lowItems: [], overallLow: false };

  // Check overall rating
  if (typeof answers.overall === "number" && answers.overall <= 2) {
    result.hasLow = true;
    result.overallLow = true;
  }

  // Check grid ratings
  if (answers.ratings && typeof answers.ratings === "object") {
    for (const [row, value] of Object.entries(answers.ratings)) {
      if (typeof value === "number" && value <= 2) {
        result.hasLow = true;
        result.lowItems.push({ row, value });
      }
    }
  }

  return result;
}

// Find a question with followUpFor config
function findFollowUpQuestion(survey) {
  for (const section of survey.sections) {
    for (const q of section.questions) {
      if (q.followUpFor) {
        return { question: q, sectionTitle: section.title };
      }
    }
  }
  return null;
}

// Build steps from survey config (answers-aware for follow-up logic)
function buildSteps(survey, answers = {}) {
  const steps = [];
  let stepIndex = 0;

  // Find follow-up question config
  const followUpInfo = findFollowUpQuestion(survey);
  const lowRatingInfo = hasLowRating(answers, survey);
  const shouldShowFollowUpEarly = followUpInfo && lowRatingInfo.hasLow;

  // Track if we've inserted the follow-up early
  let followUpInsertedEarly = false;

  for (let sIdx = 0; sIdx < survey.sections.length; sIdx++) {
    const section = survey.sections[sIdx];
    const questions = section.questions;

    // Check if this is the first section and all questions are optional (About You pattern)
    const isFirstSection = sIdx === 0;
    const allOptional = questions.every((q) => !q.required);

    if (isFirstSection && allOptional) {
      // Group all questions in the first optional section - but name goes to final step
      const aboutQuestions = questions.filter((q) => q.id !== "name");
      steps.push({
        type: "about",
        sectionTitle: section.title,
        sectionHelp: section.help,
        questions: aboutQuestions,
        stepNumber: ++stepIndex,
      });
    } else {
      // Process questions individually
      for (let qIdx = 0; qIdx < questions.length; qIdx++) {
        const q = questions[qIdx];

        // Skip share_ok - it goes on the final step
        if (q.type === "consent") continue;

        // Skip the follow-up question in its normal place if we're showing it early
        if (followUpInfo && q.id === followUpInfo.question.id && shouldShowFollowUpEarly && followUpInsertedEarly) {
          continue;
        }

        // Check if this question should be grouped with the next one
        // (parent_requests + bring_next pattern)
        const nextQ = questions[qIdx + 1];
        if (q.id === "parent_requests" && nextQ?.id === "bring_next") {
          steps.push({
            type: "grouped",
            sectionTitle: section.title,
            questions: [q, nextQ],
            stepNumber: ++stepIndex,
          });
          qIdx++; // Skip the next question since we included it
          continue;
        }

        // Long answer questions get their own step
        if (q.type === "long") {
          // Check if this is the follow-up question being shown in normal place
          const isFollowUpQuestion = followUpInfo && q.id === followUpInfo.question.id;

          // Skip if follow-up was already shown early
          if (isFollowUpQuestion && followUpInsertedEarly) {
            continue;
          }

          steps.push({
            type: "long",
            sectionTitle: section.title,
            question: q,
            stepNumber: ++stepIndex,
            isFollowUp: false,
          });
          continue;
        }

        // All other questions
        steps.push({
          type: q.type,
          sectionTitle: section.title,
          question: q,
          stepNumber: ++stepIndex,
        });

        // Insert follow-up right after the ratings grid if needed
        if (q.type === "grid" && q.id === "ratings" && shouldShowFollowUpEarly && !followUpInsertedEarly) {
          // Build custom help text with low-rated items
          let helpText = followUpInfo.question.followUpFor.help;
          if (lowRatingInfo.lowItems.length > 0) {
            const itemNames = lowRatingInfo.lowItems.map(item => item.row).join(" and ");
            const starText = lowRatingInfo.lowItems.length === 1
              ? `${lowRatingInfo.lowItems[0].value} stars`
              : lowRatingInfo.lowItems.map(item => `${item.value} stars`).join(" and ");
            helpText = `You rated ${itemNames} ${lowRatingInfo.lowItems.length === 1 ? starText : "low"}. ${followUpInfo.question.followUpFor.help}`;
          }

          steps.push({
            type: "long",
            sectionTitle: followUpInfo.sectionTitle,
            question: {
              ...followUpInfo.question,
              label: followUpInfo.question.followUpFor.title,
            },
            customHelp: helpText,
            stepNumber: ++stepIndex,
            isFollowUp: true,
          });
          followUpInsertedEarly = true;
        }
      }
    }
  }

  // Add final "ready to send" step
  steps.push({
    type: "final",
    stepNumber: ++stepIndex,
  });

  return steps;
}

// Find name question for final step
function findNameQuestion(survey) {
  for (const section of survey.sections) {
    for (const q of section.questions) {
      if (q.id === "name") return q;
    }
  }
  return null;
}

// Count total questions for welcome screen
function countTotalQuestions(survey) {
  let count = 0;
  for (const section of survey.sections) {
    for (const q of section.questions) {
      if (q.type !== "consent") count++;
    }
  }
  return count;
}

// Find consent question
function findConsentQuestion(survey) {
  for (const section of survey.sections) {
    for (const q of section.questions) {
      if (q.type === "consent") return q;
    }
  }
  return null;
}

// Helper to load saved state from sessionStorage
function loadSavedState(storageKey) {
  if (typeof window === "undefined") return null;
  try {
    const saved = sessionStorage.getItem(storageKey);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

export default function SurveyClient({ survey, isClosed, isDraft, districtInfo = null }) {
  // Storage key for this survey (include district if present)
  const storageKey = districtInfo
    ? `${STORAGE_KEY_PREFIX}${survey.slug}-${districtInfo.linkSlug}`
    : `${STORAGE_KEY_PREFIX}${survey.slug}`;

  // Core state - initialize empty to avoid hydration mismatch, load from storage in effect
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [otherText, setOtherText] = useState({});
  const [hasLoadedSaved, setHasLoadedSaved] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pageLoadTime] = useState(() => Date.now());
  const [turnstileToken, setTurnstileToken] = useState("");
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back
  const [isAnimating, setIsAnimating] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Animation states
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [tappedStar, setTappedStar] = useState(null);
  const [tappedGridStar, setTappedGridStar] = useState(null);
  const [tappedScale, setTappedScale] = useState(null);
  const [okBtnReady, setOkBtnReady] = useState(false);
  const [shakeField, setShakeField] = useState(null);
  const [wasAnswered, setWasAnswered] = useState(false);

  // Refs
  const questionTitleRef = useRef(null);
  const honeypotRef = useRef(null);
  const prevAnsweredRef = useRef(false);

  // Build steps from config (reactive to rating answers for follow-up logic)
  const steps = useMemo(() => buildSteps(survey, answers), [survey, answers]);
  const totalQuestions = useMemo(() => countTotalQuestions(survey), [survey]);
  const consentQuestion = useMemo(() => findConsentQuestion(survey), [survey]);
  const nameQuestion = useMemo(() => findNameQuestion(survey), [survey]);

  // Set theme-color meta tag for this route
  useEffect(() => {
    const themeColor = document.querySelector('meta[name="theme-color"]');
    const originalColor = themeColor?.content;
    if (themeColor) {
      themeColor.content = "#142C6B";
    } else {
      const meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.content = "#142C6B";
      document.head.appendChild(meta);
    }
    return () => {
      if (themeColor && originalColor) {
        themeColor.content = originalColor;
      }
    };
  }, []);

  // Load saved state from sessionStorage after mount (avoids hydration mismatch)
  useEffect(() => {
    // Use requestAnimationFrame to defer state updates and satisfy linter
    requestAnimationFrame(() => {
      const saved = loadSavedState(storageKey);
      if (saved) {
        if (saved.step !== undefined) setCurrentStep(saved.step);
        if (saved.answers) setAnswers(saved.answers);
        if (saved.otherText) setOtherText(saved.otherText);
      }
      setHasLoadedSaved(true);
    });
  }, [storageKey]);

  // Save state to sessionStorage (only after initial load to avoid overwriting)
  useEffect(() => {
    if (!hasLoadedSaved) return; // Don't save until we've loaded initial state
    if (submitted) {
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        // Ignore
      }
      return;
    }
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ step: currentStep, answers, otherText })
      );
    } catch {
      // Ignore storage errors
    }
  }, [currentStep, answers, otherText, storageKey, submitted, hasLoadedSaved]);

  // Handle browser back button
  useEffect(() => {
    const handlePopState = (e) => {
      const step = e.state?.step;
      if (typeof step === "number" && !isAnimating) {
        setDirection(-1);
        setCurrentStep(step);
      }
    };

    window.addEventListener("popstate", handlePopState);

    // Set initial history state
    if (currentStep === 0 && !window.history.state?.step) {
      window.history.replaceState({ step: 0 }, "");
    }

    return () => window.removeEventListener("popstate", handlePopState);
  }, [currentStep, isAnimating]);

  // Check if current step is answered (for OK button state)
  const isCurrentStepAnswered = useCallback(() => {
    if (currentStep === 0) return true;
    const step = steps[currentStep - 1];
    if (!step) return true;

    if (step.type === "about") return true;
    if (step.type === "grouped") {
      return step.questions.some((q) => q.required && answers[q.id] !== undefined && answers[q.id] !== null && answers[q.id] !== "") ||
        step.questions.every((q) => !q.required);
    }
    if (step.type === "final") {
      // Check all required
      for (const section of survey.sections) {
        for (const q of section.questions) {
          if (q.required) {
            const val = answers[q.id];
            if (val === undefined || val === null || val === "") return false;
            if (q.type === "grid") {
              if (typeof val !== "object") return false;
              if (!q.rows.every((row) => val[row] !== undefined && val[row] !== null)) return false;
            }
          }
        }
      }
      return true;
    }
    if (step.question) {
      if (!step.question.required) return true;
      const val = answers[step.question.id];
      if (val === undefined || val === null || val === "") return false;
      if (step.question.type === "grid") {
        if (typeof val !== "object") return false;
        return step.question.rows.every((row) => val[row] !== undefined && val[row] !== null);
      }
      return true;
    }
    return true;
  }, [currentStep, steps, answers, survey.sections]);

  // Track when answer state changes from unanswered to answered
  useEffect(() => {
    const isAnswered = isCurrentStepAnswered();
    if (isAnswered && !prevAnsweredRef.current && currentStep > 0) {
      setOkBtnReady(true);
      setWasAnswered(true);
      setTimeout(() => setOkBtnReady(false), 250);
    }
    prevAnsweredRef.current = isAnswered;
  }, [isCurrentStepAnswered, currentStep]);

  // Navigate to a step
  const goToStep = useCallback(
    (newStep, pushHistory = true) => {
      if (isAnimating) return;
      setDirection(newStep > currentStep ? 1 : -1);
      setIsAnimating(true);

      if (pushHistory && newStep !== currentStep) {
        window.history.pushState({ step: newStep }, "");
      }

      setTimeout(() => {
        setCurrentStep(newStep);
        setIsAnimating(false);
        setErrors({});
        setSelectedChoice(null);
        setTappedStar(null);
        setTappedGridStar(null);
        setTappedScale(null);
        setWasAnswered(false);
        prevAnsweredRef.current = false;

        // Focus on question title for accessibility
        setTimeout(() => {
          questionTitleRef.current?.focus();
        }, 50);
      }, 50);
    },
    [currentStep, isAnimating]
  );

  // Go to next step
  const goNext = useCallback(() => {
    if (currentStep < steps.length) {
      goToStep(currentStep + 1);
    }
  }, [currentStep, steps.length, goToStep]);

  // Go to previous step
  const goBack = useCallback(() => {
    if (currentStep > 0 && !isAnimating) {
      goToStep(currentStep - 1);
    }
  }, [currentStep, goToStep, isAnimating]);

  // Check if a question is answered
  const isQuestionAnswered = useCallback((q, value) => {
    if (value === undefined || value === null || value === "") return false;
    if (q.type === "grid") {
      if (typeof value !== "object") return false;
      return q.rows.every((row) => value[row] !== undefined && value[row] !== null);
    }
    return true;
  }, []);

  // Validate current step
  const validateCurrentStep = useCallback(() => {
    if (currentStep === 0) return true; // Welcome screen

    const step = steps[currentStep - 1];
    if (!step) return true;

    const newErrors = {};

    if (step.type === "about") {
      // About step - all optional, always valid
      return true;
    }

    if (step.type === "grouped") {
      // Grouped questions - check required ones
      for (const q of step.questions) {
        if (q.required && !isQuestionAnswered(q, answers[q.id])) {
          newErrors[q.id] = "Please answer this question";
        }
      }
    } else if (step.type === "final") {
      // Final step - check all required from entire survey
      for (const section of survey.sections) {
        for (const q of section.questions) {
          if (q.required && !isQuestionAnswered(q, answers[q.id])) {
            newErrors[q.id] = "Please answer this question";
          }
        }
      }
    } else if (step.question) {
      const q = step.question;
      if (q.required && !isQuestionAnswered(q, answers[q.id])) {
        newErrors[q.id] = "Please pick one";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // Trigger shake animation
      const firstErrorId = Object.keys(newErrors)[0];
      setShakeField(firstErrorId);
      setTimeout(() => setShakeField(null), 300);
      return false;
    }

    return true;
  }, [currentStep, steps, answers, isQuestionAnswered, survey.sections]);

  // Handle next button click
  const handleNext = useCallback(() => {
    if (isAnimating) return;
    if (validateCurrentStep()) {
      goNext();
    }
  }, [validateCurrentStep, goNext, isAnimating]);

  // Check if current step can be skipped
  const canSkip = useCallback(() => {
    if (currentStep === 0) return false;
    const step = steps[currentStep - 1];
    if (!step) return false;

    if (step.type === "about") return true;
    if (step.type === "grouped") {
      return step.questions.every((q) => !q.required);
    }
    if (step.type === "final") return false;
    if (step.question) return !step.question.required;
    return false;
  }, [currentStep, steps]);

  // Update an answer
  const updateAnswer = useCallback(
    (questionId, value, autoAdvance = false) => {
      if (isAnimating) return;

      hapticFeedback();
      setAnswers((prev) => ({ ...prev, [questionId]: value }));
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[questionId];
        return newErrors;
      });

      if (autoAdvance) {
        setTimeout(() => {
          if (!isAnimating) {
            goNext();
          }
        }, AUTO_ADVANCE_DELAY);
      }
    },
    [goNext, isAnimating]
  );

  // Update grid answer
  const updateGridAnswer = useCallback((questionId, row, value) => {
    if (isAnimating) return;

    hapticFeedback();
    setTappedGridStar(`${row}-${value}`);
    setTimeout(() => setTappedGridStar(null), 250);

    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        [row]: value,
      },
    }));
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[questionId];
      return newErrors;
    });
  }, [isAnimating]);

  // Toggle checkbox
  const toggleCheckbox = useCallback((questionId, option) => {
    if (isAnimating) return;

    hapticFeedback();
    setAnswers((prev) => {
      const current = prev[questionId] || [];
      if (current.includes(option)) {
        return { ...prev, [questionId]: current.filter((o) => o !== option) };
      }
      return { ...prev, [questionId]: [...current, option] };
    });
  }, [isAnimating]);

  // Update other text
  const updateOtherText = useCallback((questionId, text) => {
    setOtherText((prev) => ({ ...prev, [questionId]: text }));
  }, []);

  // Build final answers
  const buildFinalAnswers = useCallback(() => {
    const finalAnswers = { ...answers };

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
  }, [answers, otherText, survey.sections]);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!validateCurrentStep()) return;

    setSubmitting(true);
    setErrors({});

    try {
      const response = await fetch(`/api/survey/${survey.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: buildFinalAnswers(),
          send: districtInfo?.linkSlug || null,
          _plt: pageLoadTime,
          _hp: honeypotRef.current?.value || "",
          "cf-turnstile-response": turnstileToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.errors) {
          setErrors(data.errors);
        } else if (data.error) {
          setErrors({ form: data.error });
        }
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
      window.history.replaceState({ step: "done" }, "");
    } catch (error) {
      console.error("Submit error:", error);
      setErrors({ form: "Something went wrong. Please try again." });
      setSubmitting(false);
    }
  }, [validateCurrentStep, survey.slug, buildFinalAnswers, pageLoadTime, turnstileToken, districtInfo]);

  // Keyboard navigation - fixed to allow Enter in textareas
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isAnimating || dropdownOpen) return;

      // Ignore events while IME is composing
      if (e.isComposing) return;

      const target = e.target;
      const isTextarea = target.tagName === "TEXTAREA";
      const isContentEditable = target.isContentEditable;
      const isTextInput = target.tagName === "INPUT" && (target.type === "text" || target.type === "search");

      // In textareas: Enter adds new line, Ctrl/Cmd+Enter continues
      if (isTextarea || isContentEditable) {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          handleNext();
        }
        // Regular Enter in textarea = new line (default behavior)
        return;
      }

      // In text inputs: Enter goes to next step (unless it's the dropdown search)
      if (isTextInput) {
        if (e.key === "Enter") {
          e.preventDefault();
          handleNext();
        }
        // Don't trigger letter/number shortcuts while typing
        return;
      }

      const step = currentStep > 0 ? steps[currentStep - 1] : null;

      switch (e.key) {
        case "Enter":
          e.preventDefault();
          if (currentStep === 0) {
            goNext();
          } else if (step?.type === "final") {
            handleSubmit();
          } else {
            handleNext();
          }
          break;

        case "Escape":
        case "Backspace":
          if (currentStep > 0) {
            e.preventDefault();
            goBack();
          }
          break;

        case "a":
        case "A":
        case "b":
        case "B":
        case "c":
        case "C":
        case "d":
        case "D":
        case "e":
        case "E":
        case "f":
        case "F":
          if (step?.type === "choice" && step.question) {
            const idx = e.key.toLowerCase().charCodeAt(0) - 97;
            const options = step.question.options;
            if (idx < options.length) {
              e.preventDefault();
              hapticFeedback();
              setSelectedChoice(options[idx]);
              updateAnswer(step.question.id, options[idx], true);
            }
          }
          break;

        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
          if (step?.type === "stars" && step.question) {
            e.preventDefault();
            hapticFeedback();
            const starVal = parseInt(e.key);
            setTappedStar(starVal);
            setTimeout(() => setTappedStar(null), 250);
            updateAnswer(step.question.id, starVal, true);
          }
          break;

        case "0":
        case "6":
        case "7":
        case "8":
        case "9":
          if (step?.type === "scale" && step.question) {
            e.preventDefault();
            hapticFeedback();
            const scaleVal = parseInt(e.key);
            setTappedScale(scaleVal);
            setTimeout(() => setTappedScale(null), 250);
            updateAnswer(step.question.id, scaleVal, true);
          }
          break;

        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentStep, steps, goNext, goBack, handleNext, handleSubmit, updateAnswer, isAnimating, dropdownOpen]);

  // Get current step data
  const stepData = currentStep > 0 && currentStep <= steps.length ? steps[currentStep - 1] : null;

  // Calculate progress
  const progress = currentStep === 0 ? 0 : (currentStep / steps.length) * 100;
  const isLastStep = currentStep === steps.length;

  // Progress label
  const progressLabel = isLastStep ? "Last one!" : `${currentStep} of ${steps.length}`;

  // Render closed/draft states
  if (isDraft) {
    return (
      <div className={styles.surveyContainer}>
        <header className={styles.header}>
          <div className={styles.headerTop}>
            <Link href="/" className={styles.logoLink}>
              <Image
                src="/Images/footer_logo_gold.webp"
                alt="Shape Your Destiny"
                width={120}
                height={36}
                className={styles.logo}
                priority
              />
            </Link>
          </div>
        </header>
        <div className={styles.closedScreen}>
          <div className={styles.closedIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          </div>
          <p className={styles.closedText}>This survey isn&apos;t open yet.</p>
        </div>
        <div /> {/* Empty grid row for bottom */}
      </div>
    );
  }

  if (isClosed) {
    return (
      <div className={styles.surveyContainer}>
        <header className={styles.header}>
          <div className={styles.headerTop}>
            <Link href="/" className={styles.logoLink}>
              <Image
                src="/Images/footer_logo_gold.webp"
                alt="Shape Your Destiny"
                width={120}
                height={36}
                className={styles.logo}
                priority
              />
            </Link>
          </div>
        </header>
        <div className={styles.closedScreen}>
          <div className={styles.closedIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          </div>
          <p className={styles.closedText}>This survey is closed. Thank you!</p>
        </div>
        <div /> {/* Empty grid row for bottom */}
      </div>
    );
  }

  // Thank you screen
  if (submitted) {
    return (
      <ThankYouScreen steps={steps} />
    );
  }

  // Welcome screen
  if (currentStep === 0) {
    return (
      <WelcomeScreen
        totalQuestions={totalQuestions}
        onStart={() => goToStep(1)}
        districtInfo={districtInfo}
      />
    );
  }

  // Question screens
  return (
    <div className={styles.surveyContainer}>
      {/* Honeypot */}
      <input
        ref={honeypotRef}
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className={styles.honeypot}
      />

      {/* Header with progress bar */}
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <Link href="/" className={styles.logoLink}>
            <Image
              src="/Images/footer_logo_gold.webp"
              alt="Shape Your Destiny"
              width={120}
              height={36}
              className={styles.logo}
            />
          </Link>
        </div>
        <div
          className={styles.progressWrapper}
          role="progressbar"
          aria-valuenow={currentStep}
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-label="Survey progress"
        >
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${Math.max(8, progress)}%` }} />
          </div>
          <span className={styles.progressLabel}>{progressLabel}</span>
        </div>
      </header>

      {/* Main content */}
      <main className={styles.mainContent}>
        <div className={styles.questionScreen}>
          <div
            className={`${styles.questionContent} ${direction > 0 ? styles.slideUp : styles.slideDown}`}
            key={currentStep}
          >
            {stepData && (
              <QuestionStep
                step={stepData}
                answers={answers}
                otherText={otherText}
                errors={errors}
                updateAnswer={updateAnswer}
                updateGridAnswer={updateGridAnswer}
                toggleCheckbox={toggleCheckbox}
                updateOtherText={updateOtherText}
                questionTitleRef={questionTitleRef}
                consentQuestion={consentQuestion}
                nameQuestion={nameQuestion}
                submitting={submitting}
                onSubmit={handleSubmit}
                setTurnstileToken={setTurnstileToken}
                selectedChoice={selectedChoice}
                setSelectedChoice={setSelectedChoice}
                tappedStar={tappedStar}
                setTappedStar={setTappedStar}
                tappedGridStar={tappedGridStar}
                tappedScale={tappedScale}
                setTappedScale={setTappedScale}
                shakeField={shakeField}
                isAnimating={isAnimating}
                setDropdownOpen={setDropdownOpen}
                districtSchools={districtInfo?.schools}
              />
            )}
          </div>
        </div>
      </main>

      {/* Bottom actions - OK button (in grid row, not fixed) */}
      {stepData?.type !== "final" && (
        <div className={`${styles.bottomActions} ${dropdownOpen ? styles.bottomActionsHidden : ""}`}>
          <button
            type="button"
            className={`${styles.okBtn} ${isCurrentStepAnswered() ? styles.okBtnReady : ""} ${okBtnReady ? styles.okBtnNudge : ""}`}
            onClick={handleNext}
            disabled={isAnimating}
          >
            <span>OK</span>
            {isCurrentStepAnswered() && <span>✓</span>}
          </button>
          {wasAnswered && isCurrentStepAnswered() && (
            <span className={styles.enterHintAction}>press Enter ↵</span>
          )}
          {canSkip() && (
            <button
              type="button"
              className={styles.skipBtn}
              onClick={goNext}
              disabled={isAnimating}
            >
              Skip
            </button>
          )}
        </div>
      )}

      {/* Empty div for final step to maintain grid */}
      {stepData?.type === "final" && <div />}

      {/* Navigation arrows */}
      <div className={`${styles.navArrows} ${dropdownOpen ? styles.navArrowsHidden : ""}`}>
        <button
          type="button"
          className={styles.navArrowBtn}
          onClick={goBack}
          disabled={currentStep < 1 || isAnimating}
          aria-label="Previous question"
        >
          ↑
        </button>
        <button
          type="button"
          className={styles.navArrowBtn}
          onClick={handleNext}
          disabled={isAnimating}
          aria-label="Next question"
        >
          ↓
        </button>
      </div>
    </div>
  );
}

// Welcome Screen Component - Premium Design
function WelcomeScreen({ totalQuestions: _totalQuestions, onStart, districtInfo }) {
  return (
    <div className={styles.welcomeContainer}>
      {/* Full-bleed background photo */}
      <div className={styles.welcomePhoto}>
        <Image
          src="/Images/soccer-manykids.JPG.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          style={{ objectFit: "cover", objectPosition: "62% 40%" }}
        />
      </div>

      {/* Navy gradient overlay */}
      <div className={styles.welcomeGradient} />

      {/* Soccer field lines decoration */}
      <svg
        className={styles.fieldLines}
        viewBox="0 0 760 760"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        aria-hidden="true"
      >
        <circle cx="380" cy="380" r="200" />
        <circle cx="380" cy="380" r="8" fill="#fff" />
        <path d="M380 0v760" />
        <circle cx="380" cy="380" r="360" />
      </svg>

      {/* Header */}
      <header className={`${styles.welcomeHeader} ${styles.wRise}`}>
        <Link href="/" className={styles.welcomeLogoLink}>
          <Image
            src="/Images/footer_logo_gold.webp"
            alt="Shape Your Destiny"
            width={138}
            height={46}
            className={styles.welcomeLogo}
            priority
          />
        </Link>
        <div className={styles.welcomeTag}>
          <span className={styles.welcomeTagDot} />
          Intramural soccer feedback
        </div>
      </header>

      {/* Main content */}
      <main className={styles.welcomeMain}>
        <div className={`${styles.welcomeEyebrow} ${styles.wRise} ${styles.wD1}`}>
          FOR OUR PARTNER SCHOOLS
        </div>

        {districtInfo?.name && (
          <div className={`${styles.welcomeDistrict} ${styles.wRise} ${styles.wD1}`}>
            {districtInfo.name}
          </div>
        )}

        <h1 className={`${styles.welcomeHeadline} ${styles.wRise} ${styles.wD2}`}>
          Thanks for an{" "}
          <span className={styles.welcomeHighlight}>
            amazing
            <svg viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true">
              <path
                d="M3 14 C 50 4, 120 4, 197 11"
                stroke="#F2C14E"
                strokeWidth="5"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </span>{" "}
          season!
        </h1>

        <p className={`${styles.welcomeLead} ${styles.wRise} ${styles.wD3}`}>
          You see our program every week. Tell us how it&apos;s going for your students, and help us make next season even better.
        </p>

        <div className={`${styles.welcomeMeta} ${styles.wRise} ${styles.wD4}`}>
          <div className={styles.welcomeMetaItem}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7FC7D3" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="13" r="8" />
              <path d="M12 9v4l2.5 2M9 2h6" />
            </svg>
            About 3 minutes
          </div>
          <div className={styles.welcomeMetaItem}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7FC7D3" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l4 4L19 6" />
            </svg>
            Mostly one tap
          </div>
          <div className={styles.welcomeMetaItem}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7FC7D3" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" />
            </svg>
            Anonymous is fine
          </div>
        </div>

        <div className={`${styles.welcomeCta} ${styles.wRise} ${styles.wD5}`}>
          <button type="button" className={styles.welcomeBtn} onClick={onStart}>
            Let&apos;s go
            <span className={styles.welcomeBtnArrow}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </button>
          <span className={styles.welcomeKbd}>
            or press <b>Enter ↵</b>
          </span>
        </div>
      </main>

      {/* Footer */}
      <div className={`${styles.welcomeFoot} ${styles.wRise} ${styles.wD6}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        Your answers go straight to the Shape Your Destiny team.
      </div>
    </div>
  );
}

// Thank You Screen Component
function ThankYouScreen({ steps: _steps }) {
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef(null);

  // Confetti effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check for reduced motion preference
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const ctx = canvas.getContext("2d");
    const width = canvas.width = canvas.offsetWidth * 2;
    const height = canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);

    // Gold, light teal, white, and teal pieces
    const colors = ["#F2C14E", "#7FC7D3", "#FFFFFF", "#007B93"];
    const confetti = [];
    const confettiCount = 60;

    // Create confetti particles
    for (let i = 0; i < confettiCount; i++) {
      confetti.push({
        x: width / 4 + Math.random() * width / 2,
        y: -20,
        w: 6 + Math.random() * 6,
        h: 4 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 3,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        opacity: 1,
      });
    }

    let frame = 0;
    const maxFrames = 90;

    const animate = () => {
      ctx.clearRect(0, 0, width / 2, height / 2);

      let stillActive = false;

      for (const p of confetti) {
        if (p.opacity <= 0) continue;
        stillActive = true;

        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1; // gravity
        p.rotation += p.rotationSpeed;

        // Fade out near the end
        if (frame > maxFrames * 0.6) {
          p.opacity -= 0.03;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      frame++;
      if (stillActive && frame < maxFrames * 1.5) {
        requestAnimationFrame(animate);
      }
    };

    // Start animation after a small delay
    const timer = setTimeout(animate, 400);
    return () => clearTimeout(timer);
  }, []);

  const handleShare = async () => {
    const url = "https://www.shapeyourdestiny.co";
    const title = "Shape Your Destiny";
    const text = "Check out Shape Your Destiny - an amazing program for kids!";

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch {
        // User cancelled or error, fall back to copy
        copyToClipboard(url);
      }
    } else {
      copyToClipboard(url);
    }
  };

  const copyToClipboard = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={styles.surveyContainer}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <Link href="/" className={styles.logoLink}>
            <Image
              src="/Images/footer_logo_gold.webp"
              alt="Shape Your Destiny"
              width={120}
              height={36}
              className={styles.logo}
            />
          </Link>
        </div>
        <div className={`${styles.progressWrapper} ${styles.progressFadeOut}`}>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: "100%" }} />
          </div>
          <span className={styles.progressLabel}>Done!</span>
        </div>
      </header>

      <main className={styles.mainContent}>
        <div className={styles.thankYouScreen}>
          <canvas ref={canvasRef} className={styles.confettiCanvas} />
          <div className={styles.checkCircle}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className={styles.thankYouTitle}>Thank you!</h1>
          <p className={styles.thankYouText}>
            Your feedback is on its way to our team. It helps us plan next season for your students.
          </p>

          <div className={styles.thankYouButtons}>
            <button
              type="button"
              className={styles.shareBtn}
              onClick={handleShare}
            >
              {copied ? "Link copied!" : "Share Shape Your Destiny"}
            </button>
            <a href="https://www.shapeyourdestiny.co" className={styles.visitBtn}>
              Visit our website
            </a>
          </div>

          <p className={styles.thankYouFooter}>
            Know another school that would love this? We&apos;d be honored if you passed our name along.
          </p>
        </div>
      </main>

      <div /> {/* Empty grid row for bottom */}
    </div>
  );
}

// Question Step Component
function QuestionStep({
  step,
  answers,
  otherText,
  errors,
  updateAnswer,
  updateGridAnswer,
  toggleCheckbox,
  updateOtherText,
  questionTitleRef,
  consentQuestion,
  nameQuestion,
  submitting,
  onSubmit,
  setTurnstileToken,
  selectedChoice,
  setSelectedChoice,
  tappedStar,
  setTappedStar,
  tappedGridStar,
  tappedScale,
  setTappedScale,
  shakeField,
  isAnimating,
  setDropdownOpen,
  districtSchools,
}) {
  // Final step - recap and submit
  if (step.type === "final") {
    return (
      <FinalStep
        answers={answers}
        consentQuestion={consentQuestion}
        nameQuestion={nameQuestion}
        updateAnswer={updateAnswer}
        errors={errors}
        submitting={submitting}
        onSubmit={onSubmit}
        questionTitleRef={questionTitleRef}
        setTurnstileToken={setTurnstileToken}
      />
    );
  }

  // About step - grouped intro questions
  if (step.type === "about") {
    return (
      <AboutStep
        step={step}
        answers={answers}
        otherText={otherText}
        updateAnswer={updateAnswer}
        updateOtherText={updateOtherText}
        questionTitleRef={questionTitleRef}
        setDropdownOpen={setDropdownOpen}
        districtSchools={districtSchools}
      />
    );
  }

  // Grouped questions step
  if (step.type === "grouped") {
    return (
      <GroupedStep
        step={step}
        answers={answers}
        otherText={otherText}
        errors={errors}
        updateAnswer={updateAnswer}
        toggleCheckbox={toggleCheckbox}
        updateOtherText={updateOtherText}
        questionTitleRef={questionTitleRef}
        shakeField={shakeField}
      />
    );
  }

  // Single question step
  const q = step.question;

  return (
    <div className={styles.questionWrapper}>
      <div className={`${styles.sectionTag} ${styles.staggerSection}`}>
        <span>{step.stepNumber}</span>
        <span>{step.sectionTitle}</span>
      </div>

      <h2
        ref={questionTitleRef}
        className={`${styles.questionTitle} ${styles.staggerTitle}`}
        tabIndex={-1}
      >
        {q.label}
      </h2>

      {(step.customHelp || q.help) && <p className={`${styles.questionHelp} ${styles.staggerTitle}`}>{step.customHelp || q.help}</p>}

      <div className={`${styles.questionField} ${styles.staggerContent} ${shakeField === q.id ? styles.shake : ""}`}>
        <QuestionField
          question={q}
          value={answers[q.id]}
          otherText={otherText[q.id] || ""}
          updateAnswer={updateAnswer}
          updateGridAnswer={updateGridAnswer}
          toggleCheckbox={toggleCheckbox}
          updateOtherText={updateOtherText}
          selectedChoice={selectedChoice}
          setSelectedChoice={setSelectedChoice}
          tappedStar={tappedStar}
          setTappedStar={setTappedStar}
          tappedGridStar={tappedGridStar}
          tappedScale={tappedScale}
          setTappedScale={setTappedScale}
          isAnimating={isAnimating}
        />
      </div>

      {errors[q.id] && (
        <p className={styles.fieldError}>{errors[q.id]}</p>
      )}
    </div>
  );
}

// About Step Component - without name field (name moved to final step)
function AboutStep({ step, answers, otherText, updateAnswer, updateOtherText, questionTitleRef, setDropdownOpen, districtSchools }) {
  const schoolQ = step.questions.find((q) => q.id === "school");
  const roleQ = step.questions.find((q) => q.id === "role");

  // Use district-specific schools if available, otherwise fall back to survey defaults
  const schoolOptions = districtSchools && districtSchools.length > 0
    ? ["Prefer not to say", ...districtSchools]
    : schoolQ?.options || [];

  return (
    <div className={styles.questionWrapper}>
      <div className={`${styles.sectionTag} ${styles.staggerSection}`}>
        <span>{step.stepNumber}</span>
        <span>{step.sectionTitle}</span>
      </div>

      <h2
        ref={questionTitleRef}
        className={`${styles.questionTitle} ${styles.staggerTitle}`}
        tabIndex={-1}
      >
        First, a little about you
      </h2>

      {step.sectionHelp && (
        <p className={`${styles.questionHelp} ${styles.staggerTitle}`}>{step.sectionHelp}</p>
      )}

      <div className={`${styles.aboutFields} ${styles.staggerContent}`}>
        {schoolQ && (
          <div className={styles.aboutField}>
            <label className={styles.aboutLabel}>Your school</label>
            <SearchableDropdown
              options={schoolOptions}
              value={answers[schoolQ.id] || ""}
              onChange={(v) => updateAnswer(schoolQ.id, v)}
              placeholder="Pick your school, or type to search"
              setDropdownOpen={setDropdownOpen}
            />
          </div>
        )}

        {roleQ && (
          <div className={styles.aboutField}>
            <label className={styles.aboutLabel}>Your role</label>
            <div className={styles.roleChips}>
              {roleQ.options.map((opt) => {
                const isActive = answers[roleQ.id] === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    className={`${styles.roleChip} ${isActive ? styles.roleChipActive : ""}`}
                    onClick={() => {
                      hapticFeedback();
                      updateAnswer(roleQ.id, opt);
                    }}
                  >
                    {isActive && <span className={styles.roleChipCheck}>✓</span>}
                    {opt}
                  </button>
                );
              })}
            </div>
            {roleQ.hasOtherText && answers[roleQ.id] === "Other" && (
              <input
                type="text"
                className={styles.otherInput}
                placeholder="Please specify..."
                value={otherText[roleQ.id] || ""}
                onChange={(e) => updateOtherText(roleQ.id, e.target.value)}
                maxLength={100}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Grouped Step Component (parent_requests + bring_next)
function GroupedStep({ step, answers, otherText, errors, updateAnswer, toggleCheckbox, updateOtherText, questionTitleRef, shakeField }) {
  return (
    <div className={styles.questionWrapper}>
      <div className={`${styles.sectionTag} ${styles.staggerSection}`}>
        <span>{step.stepNumber}</span>
        <span>{step.sectionTitle}</span>
      </div>

      {step.questions.map((q, idx) => (
        <div key={q.id} className={styles.groupedQuestion}>
          <h2
            ref={idx === 0 ? questionTitleRef : null}
            className={`${styles.questionTitle} ${idx === 0 ? styles.staggerTitle : ""}`}
            tabIndex={idx === 0 ? -1 : undefined}
          >
            {q.label}
          </h2>

          {q.help && <p className={styles.questionHelp}>{q.help}</p>}

          <div className={`${styles.questionField} ${shakeField === q.id ? styles.shake : ""}`}>
            <QuestionField
              question={q}
              value={answers[q.id]}
              otherText={otherText[q.id] || ""}
              updateAnswer={updateAnswer}
              toggleCheckbox={toggleCheckbox}
              updateOtherText={updateOtherText}
            />
          </div>

          {errors[q.id] && (
            <p className={styles.fieldError}>{errors[q.id]}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// Final Step Component - now includes name field
function FinalStep({ answers, consentQuestion, nameQuestion, updateAnswer, errors, submitting, onSubmit, questionTitleRef, setTurnstileToken }) {
  // Get recap values
  const overall = answers.overall;
  const attendance = answers.attendance;
  const recommend = answers.recommend;
  const school = answers.school && answers.school !== "Prefer not to say" ? answers.school : "Anonymous";

  return (
    <div className={styles.questionWrapper}>
      <h2
        ref={questionTitleRef}
        className={`${styles.questionTitle} ${styles.staggerTitle}`}
        tabIndex={-1}
      >
        Looks great. Ready to send?
      </h2>

      <div className={`${styles.recapGrid} ${styles.staggerContent}`}>
        <div className={styles.recapItem}>
          <span className={styles.recapLabel}>Overall</span>
          <span className={styles.recapValue}>
            {overall ? (
              <span className={styles.recapStars}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <svg key={s} viewBox="0 0 24 24" fill={s <= overall ? "#F2C14E" : "rgba(255,255,255,0.22)"}>
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ))}
              </span>
            ) : "—"}
          </span>
        </div>
        <div className={styles.recapItem}>
          <span className={styles.recapLabel}>Attendance</span>
          <span className={styles.recapValue}>{attendance || "—"}</span>
        </div>
        <div className={styles.recapItem}>
          <span className={styles.recapLabel}>Would recommend</span>
          <span className={styles.recapValue}>
            {recommend !== undefined ? `${recommend} out of 10` : "—"}
          </span>
        </div>
        <div className={styles.recapItem}>
          <span className={styles.recapLabel}>School</span>
          <span className={styles.recapValue}>{school}</span>
        </div>
      </div>

      {/* Name field - moved from About step */}
      {nameQuestion && (
        <div className={styles.nameFieldFinal}>
          <label className={styles.aboutLabel}>Add your name? (optional)</label>
          <input
            type="text"
            className={styles.filledInput}
            value={answers[nameQuestion.id] || ""}
            onChange={(e) => updateAnswer(nameQuestion.id, e.target.value)}
            placeholder="Type your name"
            maxLength={nameQuestion.maxLength || 100}
          />
          <span className={styles.fieldHint}>Leave blank to stay anonymous.</span>
        </div>
      )}

      {consentQuestion && (
        <label className={styles.consentCard}>
          <input
            type="checkbox"
            checked={answers[consentQuestion.id] || false}
            onChange={(e) => updateAnswer(consentQuestion.id, e.target.checked)}
          />
          <span className={styles.consentText}>{consentQuestion.label}</span>
        </label>
      )}

      {errors.form && (
        <p className={styles.formError}>{errors.form}</p>
      )}

      {errors.turnstile && (
        <p className={styles.fieldError}>{errors.turnstile}</p>
      )}

      <div className={styles.turnstileWrapper}>
        <Turnstile onVerify={setTurnstileToken} />
      </div>

      <button
        type="button"
        className={styles.submitBtn}
        onClick={onSubmit}
        disabled={submitting}
      >
        {submitting ? "Sending..." : "Send feedback"}
      </button>
    </div>
  );
}

// Question Field Component
function QuestionField({
  question,
  value,
  otherText,
  updateAnswer,
  updateGridAnswer,
  toggleCheckbox,
  updateOtherText,
  selectedChoice,
  setSelectedChoice,
  tappedStar,
  setTappedStar,
  tappedGridStar,
  tappedScale,
  setTappedScale,
  isAnimating,
}) {
  const q = question;

  switch (q.type) {
    case "choice":
      return (
        <div className={styles.choiceGrid}>
          {q.options.map((opt, idx) => {
            const letter = String.fromCharCode(65 + idx); // A, B, C, D...
            const isSelected = value === opt;
            const isBlinking = selectedChoice === opt;
            const isFaded = selectedChoice && selectedChoice !== opt;

            return (
              <button
                key={opt}
                type="button"
                className={`${styles.choiceTile} ${isSelected ? styles.choiceTileActive : ""} ${isBlinking ? styles.choiceTileBlink : ""} ${isFaded ? styles.choiceTileFaded : ""}`}
                onClick={() => {
                  if (isAnimating) return;
                  hapticFeedback();
                  setSelectedChoice?.(opt);
                  updateAnswer(q.id, opt, true);
                }}
                aria-pressed={isSelected}
                disabled={isAnimating}
              >
                <span className={styles.choiceLetter}>
                  {isSelected ? "✓" : letter}
                </span>
                <span className={styles.choiceText}>{opt}</span>
                <span className={styles.choiceCheck}>✓</span>
              </button>
            );
          })}
        </div>
      );

    case "stars":
      return (
        <div className={styles.starsWrapper}>
          <div className={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => {
              const isFilled = star <= (value || 0);
              const isPop = tappedStar === star;

              return (
                <button
                  key={star}
                  type="button"
                  className={`${styles.starTile} ${isFilled ? styles.starTileFilled : ""} ${isPop ? styles.starPop : ""}`}
                  onClick={() => {
                    if (isAnimating) return;
                    hapticFeedback();
                    setTappedStar?.(star);
                    setTimeout(() => setTappedStar?.(null), 250);
                    updateAnswer(q.id, star, true);
                  }}
                  aria-label={`${star} star${star > 1 ? "s" : ""}`}
                  aria-pressed={value === star}
                  disabled={isAnimating}
                >
                  <svg viewBox="0 0 24 24" fill={isFilled ? "#F2C14E" : "rgba(255,255,255,0.22)"}>
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </button>
              );
            })}
          </div>
          <span className={`${styles.starLabel} ${!value ? styles.starLabelEmpty : ""} ${value ? styles.starLabelAnim : ""}`} key={value}>
            {value ? STAR_LABELS[value - 1] : "Tap a star"}
          </span>
        </div>
      );

    case "grid":
      return (
        <div className={styles.gridCards}>
          {q.rows.map((row) => {
            const rowValue = value?.[row];
            const isComplete = rowValue !== undefined && rowValue !== null;
            return (
              <div key={row} className={`${styles.gridCard} ${isComplete ? styles.gridCardComplete : ""}`}>
                <div className={styles.gridCardHeader}>
                  <span className={styles.gridCardLabel}>{row}</span>
                  {isComplete && (
                    <span className={styles.gridCardCheck}>✓</span>
                  )}
                </div>
                <div className={styles.gridStars}>
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isFilled = star <= (rowValue || 0);
                    const isPop = tappedGridStar === `${row}-${star}`;

                    return (
                      <button
                        key={star}
                        type="button"
                        className={`${styles.gridStarBtn} ${isFilled ? styles.gridStarBtnFilled : ""} ${isPop ? styles.gridStarPop : ""}`}
                        onClick={() => updateGridAnswer(q.id, row, star)}
                        aria-label={`${star} star${star > 1 ? "s" : ""} for ${row}`}
                      >
                        <svg viewBox="0 0 24 24" fill={isFilled ? "#F2C14E" : "rgba(255,255,255,0.22)"}>
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      );

    case "scale":
      return (
        <div className={styles.scaleWrapper}>
          <div className={styles.scaleGrid}>
            {Array.from({ length: q.max - q.min + 1 }, (_, i) => q.min + i).map((num) => {
              const isActive = value === num;
              const isPop = tappedScale === num;

              return (
                <button
                  key={num}
                  type="button"
                  className={`${styles.scaleBtn} ${isActive ? styles.scaleBtnActive : ""} ${isPop ? styles.scaleBtnPop : ""}`}
                  onClick={() => {
                    if (isAnimating) return;
                    hapticFeedback();
                    setTappedScale?.(num);
                    setTimeout(() => setTappedScale?.(null), 250);
                    updateAnswer(q.id, num, true);
                  }}
                  aria-pressed={isActive}
                  disabled={isAnimating}
                >
                  {num}
                </button>
              );
            })}
          </div>
          <div className={styles.scaleLabels}>
            <span>{q.min} · {q.minLabel}</span>
            <span>{q.max} · {q.maxLabel}</span>
          </div>
        </div>
      );

    case "checkboxes":
      const hasOther = (value || []).includes("Other");
      return (
        <div className={styles.checkboxWrapper}>
          <div className={styles.checkboxChips}>
            {q.options.map((opt) => {
              const isChecked = (value || []).includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  className={`${styles.checkboxChip} ${isChecked ? styles.checkboxChipActive : ""}`}
                  onClick={() => toggleCheckbox(q.id, opt)}
                  aria-pressed={isChecked}
                >
                  <span className={`${styles.checkboxIcon} ${isChecked ? styles.checkboxIconRotate : ""}`}>
                    {isChecked ? "✓" : "+"}
                  </span>
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>
          {q.hasOtherText && hasOther && (
            <input
              type="text"
              className={styles.otherInput}
              placeholder="Please specify..."
              value={otherText || ""}
              onChange={(e) => updateOtherText(q.id, e.target.value)}
              maxLength={100}
            />
          )}
        </div>
      );

    case "long":
      const charCount = (value || "").length;
      const maxLength = q.maxLength || 1000;
      const showCharCount = charCount >= 800;
      const hintText = isMac ? "Press ⌘ Enter to continue" : "Press Ctrl + Enter to continue";

      return (
        <div className={styles.longWrapper}>
          <textarea
            className={styles.longTextarea}
            value={value || ""}
            onChange={(e) => updateAnswer(q.id, e.target.value)}
            placeholder="Type your answer here..."
            maxLength={maxLength}
            rows={4}
          />
          <p className={styles.textareaHint}>
            Please leave out names and personal details · {hintText}
          </p>
          <span className={`${styles.charCount} ${!showCharCount ? styles.charCountHidden : ""}`}>
            {charCount} / {maxLength}
          </span>
        </div>
      );

    default:
      return null;
  }
}

// Searchable Dropdown Component
function SearchableDropdown({ options, value, onChange, placeholder, setDropdownOpen }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Notify parent when dropdown opens/closes
  useEffect(() => {
    setDropdownOpen?.(isOpen);
  }, [isOpen, setDropdownOpen]);

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

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setHighlightedIndex(0);
  };

  const handleSelect = (opt) => {
    hapticFeedback();
    onChange(opt);
    setIsOpen(false);
    setSearch("");
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filtered[highlightedIndex]) {
          handleSelect(filtered[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setSearch("");
        break;
    }
  };

  // Scroll highlighted option into view
  useEffect(() => {
    if (listRef.current && isOpen) {
      const highlighted = listRef.current.children[highlightedIndex];
      if (highlighted) {
        highlighted.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, isOpen]);

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
        <svg className={`${styles.dropdownArrow} ${isOpen ? styles.dropdownArrowOpen : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className={styles.dropdownOverlay} onClick={() => { setIsOpen(false); setSearch(""); }} />
          <div className={styles.dropdownMenu}>
            <input
              ref={inputRef}
              type="text"
              className={styles.dropdownSearch}
              placeholder="Type to search..."
              value={search}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
            />
            <div className={styles.dropdownOptions} ref={listRef}>
              {filtered.length === 0 ? (
                <div className={styles.dropdownEmpty}>No matches</div>
              ) : (
                filtered.map((opt, idx) => (
                  <button
                    key={opt}
                    type="button"
                    className={`${styles.dropdownOption} ${value === opt ? styles.dropdownOptionActive : ""} ${idx === highlightedIndex ? styles.dropdownOptionActive : ""}`}
                    onClick={() => handleSelect(opt)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                  >
                    <span>{opt}</span>
                    {value === opt && <span className={styles.dropdownOptionCheck}>✓</span>}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
