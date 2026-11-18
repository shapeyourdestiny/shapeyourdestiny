"use client";

import { useState, useEffect } from "react";
import { CONTACTS } from "@/lib/contacts";
import styles from "./page.module.css";

const StarIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

const ChevronIcon = ({ open }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`${styles.faqChevron} ${open ? styles.open : ""}`}
  >
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const RocketIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" />
    <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
  </svg>
);

const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const UsersIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
);

const InboxIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
  </svg>
);

const HelpIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const SmartphoneIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
  </svg>
);

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const BookIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
  </svg>
);

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
);

const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
  </svg>
);

const FAQ_SECTIONS = [
  {
    title: "Getting Started",
    icon: RocketIcon,
    items: [
      {
        q: "How do I see my schedule?",
        a: "Open the Schedule tab to see your upcoming classes. Each card shows the school, time, program, and who you're teaching with. Tap a class for full details and directions.",
      },
      {
        q: "How do I get directions to a school?",
        a: "Tap any class card, then tap the Directions button. The first time, you'll choose your preferred maps app (Apple Maps, Google Maps, or Waze). After that, directions open automatically in your chosen app.",
      },
      {
        q: "Can I sync my schedule to my phone calendar?",
        a: "Yes! Go to Profile, then Calendar sync, and tap \"Enable calendar sync.\" You'll get a link to add to Apple Calendar, Google Calendar, or any app that supports calendar subscriptions. Classes, sub requests, and team events will all appear in your calendar.",
      },
    ],
  },
  {
    title: "Your Schedule",
    icon: CalendarIcon,
    items: [
      {
        q: "How do I know who I'm teaching with?",
        a: "Each class card on your Schedule shows your co-teacher's name and photo. If you're teaching alone, it will say \"Teaching alone.\"",
      },
      {
        q: "What if I can't make it to a class?",
        a: "Message the office in WhatsApp as soon as possible so we can find coverage. Reliable attendance is important for the kids and your co-teachers.",
      },
      {
        q: "What does \"Sub\" mean on a class?",
        a: "It means you're filling in for another instructor on that day. The class card will show who you're covering for.",
      },
    ],
  },
  {
    title: "After Each Class",
    icon: CheckCircleIcon,
    items: [
      {
        q: "What's a class review?",
        a: "After you teach, you can rate how the class went using star ratings for overall experience, student attention, and behavior. You can also note if supplies are needed. This helps us support you and track how classes are going.",
      },
      {
        q: "Do I have to review every class?",
        a: "We encourage a quick review after each class while it's fresh in your mind. It only takes a few seconds. Just tap the star ratings. Add notes if something notable happened.",
      },
      {
        q: "What's a shout-out?",
        a: "A shout-out is a quick way to recognize your co-teacher for something they did well. Pick a tag like \"Great energy\" or \"Handled a tough moment,\" optionally add a note, and send it. We aim for at least one shout-out every two weeks.",
      },
      {
        q: "Why give shout-outs?",
        a: "Shout-outs help us recognize great work and build a supportive team culture. They also help the office know who's doing well. Your co-teacher will see the shout-out you send!",
      },
    ],
  },
  {
    title: "Team Events",
    icon: UsersIcon,
    items: [
      {
        q: "What are team events?",
        a: "Team events include meetings, trainings, and socials. Required events are important for staying up to date on curriculum and policies. Social events are optional but a great way to connect with the team.",
      },
      {
        q: "How do I RSVP to an event?",
        a: "Team events appear in your Inbox and on your Schedule. Tap the event, then tap \"I'll be there\" or \"Can't make it.\" For required events you can't attend, you'll need to explain why.",
      },
      {
        q: "Do I get paid for team events?",
        a: "Some events are paid. You'll see \"Paid\" on the event card. Attendance is tracked for paid events.",
      },
    ],
  },
  {
    title: "Your Inbox",
    icon: InboxIcon,
    items: [
      {
        q: "What shows up in my Inbox?",
        a: "Your Inbox shows things that need your attention: semester reviews to complete, team events to RSVP to, notes from the office, and shout-outs you've received.",
      },
      {
        q: "What's a semester review?",
        a: "At the end of your semester at a school, you'll complete a quick review reflecting on the whole experience. This includes overall ratings for the semester, what went well, and what you'd change.",
      },
      {
        q: "When do I complete a semester review?",
        a: "Semester reviews appear on your last class day at a school and are due within 7 days. You'll see it in your Inbox with a due date.",
      },
    ],
  },
  {
    title: "Troubleshooting",
    icon: HelpIcon,
    items: [
      {
        q: "My calendar isn't syncing",
        a: "Calendar sync can take up to an hour to update. If classes still aren't appearing, try removing and re-adding the calendar subscription. Make sure you're using the subscription URL (not downloading the file).",
      },
      {
        q: "I'm not seeing my classes",
        a: "Classes appear on your Schedule starting 7 days before the class date. If you should have classes assigned but don't see them, message the office.",
      },
      {
        q: "The app isn't loading correctly",
        a: "Try refreshing the page or closing and reopening the app. If issues persist, try clearing your browser cache or using a different browser. Message us if problems continue.",
      },
    ],
  },
];

function FAQItem({ question, answer }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={styles.faqItem}>
      <button
        className={styles.faqQuestion}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span>{question}</span>
        <ChevronIcon open={isOpen} />
      </button>
      {isOpen && (
        <div className={styles.faqAnswer}>
          <p>{answer}</p>
        </div>
      )}
    </div>
  );
}

function FAQGroup({ title, icon: Icon, items }) {
  return (
    <div className={styles.faqGroup}>
      <div className={styles.faqGroupTitle}>
        <Icon />
        <span>{title}</span>
      </div>
      {items.map((item, i) => (
        <FAQItem key={i} question={item.q} answer={item.a} />
      ))}
    </div>
  );
}

function InstallCard() {
  const [isInstalled] = useState(() => {
    // Check if already installed (runs once on mount)
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  });
  const [platform] = useState(() => {
    // Detect platform (runs once on mount)
    if (typeof window === "undefined") return null;
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) return "ios";
    if (/Android/.test(ua)) return "android";
    return "desktop";
  });
  const [showSteps, setShowSteps] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    // Listen for install prompt (Chrome/Android)
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + "/instructor/dashboard");
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = window.location.origin + "/instructor/dashboard";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  if (isInstalled) return null;

  return (
    <div className={styles.installCard}>
      <div className={styles.installHeader}>
        <div className={styles.installIcon}>
          <SmartphoneIcon />
        </div>
        <h2 className={styles.installTitle}>Add to your phone</h2>
      </div>
      <p className={styles.installText}>
        Add this app to your home screen for quick access and a better experience.
      </p>

      {platform === "ios" && showSteps && (
        <>
          <ol className={styles.installSteps}>
            <li>Tap the <strong>Share</strong> button at the bottom of Safari</li>
            <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
            <li>Tap <strong>Add</strong> in the top right</li>
          </ol>
          <button
            className={styles.installToggle}
            onClick={() => setShowSteps(false)}
          >
            Not using Safari?
          </button>
        </>
      )}

      {platform === "ios" && !showSteps && (
        <div className={styles.installWarning}>
          <p className={styles.installWarningText}>
            To add to your home screen, open this page in Safari.
          </p>
          <button className={styles.copyLinkBtn} onClick={handleCopyLink}>
            <CopyIcon />
            {linkCopied ? "Copied!" : "Copy link"}
          </button>
        </div>
      )}

      {platform === "android" && deferredPrompt && (
        <button className={styles.installBtn} onClick={handleInstall}>
          <DownloadIcon />
          Add to Home Screen
        </button>
      )}

      {platform === "android" && !deferredPrompt && showSteps && (
        <>
          <ol className={styles.installSteps}>
            <li>Tap the <strong>menu</strong> (three dots) in Chrome</li>
            <li>Tap <strong>Add to Home screen</strong></li>
            <li>Tap <strong>Add</strong></li>
          </ol>
          <button
            className={styles.installToggle}
            onClick={() => setShowSteps(false)}
          >
            Not using Chrome?
          </button>
        </>
      )}

      {platform === "android" && !deferredPrompt && !showSteps && (
        <div className={styles.installWarning}>
          <p className={styles.installWarningText}>
            To add to your home screen, open this page in Chrome.
          </p>
          <button className={styles.copyLinkBtn} onClick={handleCopyLink}>
            <CopyIcon />
            {linkCopied ? "Copied!" : "Copy link"}
          </button>
        </div>
      )}

      {platform === "desktop" && (
        <p className={styles.installText} style={{ marginBottom: 0 }}>
          Open this page on your phone to add it to your home screen.
        </p>
      )}
    </div>
  );
}

export default function HelpClient() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Help & FAQ</h1>
        <p>
          How to use the app. See the{" "}
          <a
            href="https://docs.google.com/document/d/1ePQnQBhWdoKlxD6BXjnB86P-dVqXFb1jSmjdJgwLpvY"
            target="_blank"
            rel="noopener noreferrer"
          >
            Employee Handbook
          </a>{" "}
          for policies.
        </p>
      </div>

      {/* WhatsApp Card */}
      <div className={styles.whatsappCard}>
        <div className={styles.whatsappHeader}>
          <div className={styles.whatsappIcon}>
            <WhatsAppIcon />
          </div>
          <h2 className={styles.whatsappTitle}>Keep it in WhatsApp</h2>
        </div>
        <p className={styles.whatsappText}>
          Questions about your schedule, running late, or need to call out? Message us in WhatsApp. We check it throughout the day.
        </p>
        <a
          href={CONTACTS.heather.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.whatsappBtn}
        >
          <WhatsAppIcon />
          Message the office
        </a>
        <p className={styles.whatsappNote}>
          For serious incidents, call instead. See contacts below.
        </p>
      </div>

      {/* Install Card */}
      <InstallCard />

      {/* Workflow Section */}
      <div className={styles.workflowSection}>
        <div className={styles.workflowCard}>
          <h2 className={styles.workflowTitle}>
            <StarIcon />
            How we use the app
          </h2>
          <div className={styles.workflowSteps}>
            <div className={styles.workflowStep}>
              <div className={styles.stepNumber}>1</div>
              <div className={styles.stepContent}>
                <h3 className={styles.stepTitle}>Before class</h3>
                <p className={styles.stepDesc}>
                  Check your Schedule for upcoming classes. Tap a class for details and directions to the school.
                </p>
              </div>
            </div>

            <div className={styles.workflowStep}>
              <div className={styles.stepNumber}>2</div>
              <div className={styles.stepContent}>
                <h3 className={styles.stepTitle}>After class</h3>
                <p className={styles.stepDesc}>
                  Do a quick class review. Just tap the stars. Then send a shout-out to your co-teacher for something they did well.
                </p>
                <span className={styles.stepHint}>
                  Aim for at least 1 shout-out every 2 weeks
                </span>
              </div>
            </div>

            <div className={styles.workflowStep}>
              <div className={styles.stepNumber}>3</div>
              <div className={styles.stepContent}>
                <h3 className={styles.stepTitle}>Final class of the semester</h3>
                <p className={styles.stepDesc}>
                  Complete your semester review. It takes about 2 minutes and helps us plan for next semester.
                </p>
              </div>
            </div>

            <div className={styles.workflowStep}>
              <div className={styles.stepNumber}>4</div>
              <div className={styles.stepContent}>
                <h3 className={styles.stepTitle}>Something happened?</h3>
                <p className={styles.stepDesc}>
                  For injuries, safety issues, or anything you need to document, tap Report an Incident in your Profile.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className={styles.faqSection}>
        <span className={styles.sectionLabel}>Frequently Asked Questions</span>
        {FAQ_SECTIONS.map((section) => (
          <FAQGroup
            key={section.title}
            title={section.title}
            icon={section.icon}
            items={section.items}
          />
        ))}
      </div>

      {/* Handbook Card */}
      <div className={styles.handbookCard}>
        <div className={styles.handbookIcon}>
          <BookIcon />
        </div>
        <div className={styles.handbookContent}>
          <h3 className={styles.handbookTitle}>Anything else?</h3>
          <p className={styles.handbookText}>
            Check the{" "}
            <a
              href="https://docs.google.com/document/d/1ePQnQBhWdoKlxD6BXjnB86P-dVqXFb1jSmjdJgwLpvY"
              target="_blank"
              rel="noopener noreferrer"
            >
              Employee Handbook
            </a>{" "}
            for policies, procedures, and more.
          </p>
        </div>
      </div>

      {/* Contact Card */}
      <div className={styles.contactCard}>
        <h3 className={styles.contactTitle}>Contact</h3>

        <div className={styles.contactRow}>
          <div className={styles.contactInfo}>
            <span className={styles.contactName}>{CONTACTS.heather.name}</span>
            <span className={styles.contactRole}>{CONTACTS.heather.responsibilities}</span>
          </div>
          <div className={styles.contactActions}>
            <a href={CONTACTS.heather.whatsappUrl} className={styles.contactBtn} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon />
            </a>
            <a href={CONTACTS.heather.telUrl} className={styles.contactBtn}>
              <PhoneIcon />
            </a>
          </div>
        </div>

        <div className={styles.contactRow}>
          <div className={styles.contactInfo}>
            <span className={styles.contactName}>{CONTACTS.destiny.name}</span>
            <span className={styles.contactRole}>{CONTACTS.destiny.responsibilities}</span>
          </div>
          <div className={styles.contactActions}>
            <a href={CONTACTS.destiny.whatsappUrl} className={styles.contactBtn} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon />
            </a>
            <a href={CONTACTS.destiny.telUrl} className={styles.contactBtn}>
              <PhoneIcon />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
