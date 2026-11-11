"use client";

import { useState } from "react";
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

const FAQ_SECTIONS = [
  {
    title: "Getting Started",
    icon: RocketIcon,
    items: [
      {
        q: "How do I see my class schedule?",
        a: "Your upcoming classes appear on your Dashboard. Each card shows the school, time, and who you're teaching with. Tap a class to see full details including directions to the school.",
      },
      {
        q: "How do I get directions to a school?",
        a: "Tap any class card, then tap the Directions button. The first time, you'll choose your preferred maps app (Apple Maps, Google Maps, or Waze). After that, directions open automatically in your chosen app.",
      },
      {
        q: "Can I sync my classes to my phone calendar?",
        a: "Yes! Go to Profile → Calendar sync and tap \"Enable calendar sync.\" You'll get a link to add to Apple Calendar, Google Calendar, or any app that supports calendar subscriptions. Classes, sub requests, and team events will all appear in your calendar.",
      },
    ],
  },
  {
    title: "Your Schedule",
    icon: CalendarIcon,
    items: [
      {
        q: "How do I know who I'm teaching with?",
        a: "Each class card on your Dashboard shows your co-teacher's name and photo. If you're teaching alone, it will say \"Teaching alone.\"",
      },
      {
        q: "What if I can't make it to a class?",
        a: "Contact the office as soon as possible so we can find coverage. Reliable attendance is important for the kids and your co-teachers.",
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
        q: "Do I have to do a review after every class?",
        a: "We encourage a quick review after each class while it's fresh in your mind. It only takes a few seconds—just tap the star ratings. Add notes if something notable happened.",
      },
      {
        q: "What's a shout-out?",
        a: "A shout-out is a quick way to recognize your co-teacher for something they did well. Pick a tag like \"Great energy\" or \"Handled a tough moment well,\" optionally add a note, and send it. We aim for at least one shout-out every two weeks.",
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
        a: "Some events are paid—you'll see \"Paid\" on the event card. Attendance is tracked for paid events.",
      },
    ],
  },
  {
    title: "Your Inbox",
    icon: InboxIcon,
    items: [
      {
        q: "What shows up in my Inbox?",
        a: "Your Inbox shows things that need your attention: session reviews to complete, team events to RSVP to, notes from the office, and shout-outs you've received.",
      },
      {
        q: "What's a session review?",
        a: "At the end of a teaching session (usually after 10-12 classes), you'll complete a fuller review reflecting on the whole experience. This includes overall ratings, what went well, what you'd change, and feedback on your co-teachers.",
      },
      {
        q: "When do I need to complete a session review?",
        a: "Session reviews appear in your Inbox when they're due. Complete them before the deadline shown—usually within a few days of your last class in that session.",
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
        a: "Classes appear on your Dashboard starting 7 days before the class date. If you should have classes assigned but don't see them, contact the office.",
      },
      {
        q: "The app isn't loading correctly",
        a: "Try refreshing the page or closing and reopening the app. If issues persist, try clearing your browser cache or using a different browser. Contact us if problems continue.",
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

export default function HelpClient() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Help & FAQ</h1>
        <p>How to use the app and our recommended workflow.</p>
      </div>

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
                <h3 className={styles.stepTitle}>Check your schedule</h3>
                <p className={styles.stepDesc}>
                  Open the app to see your upcoming classes. Tap a class for details and directions to the school.
                </p>
              </div>
            </div>

            <div className={styles.workflowStep}>
              <div className={styles.stepNumber}>2</div>
              <div className={styles.stepContent}>
                <h3 className={styles.stepTitle}>After each class</h3>
                <p className={styles.stepDesc}>
                  Do a quick class review—just tap the stars. Then send a shout-out to your co-teacher for something they did well.
                </p>
                <span className={styles.stepHint}>
                  Aim for at least 1 shout-out every 2 weeks
                </span>
              </div>
            </div>

            <div className={styles.workflowStep}>
              <div className={styles.stepNumber}>3</div>
              <div className={styles.stepContent}>
                <h3 className={styles.stepTitle}>End of session review</h3>
                <p className={styles.stepDesc}>
                  When your session ends, complete the full session review in your Inbox. Reflect on the whole experience and give feedback.
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

      {/* Contact Card */}
      <div className={styles.contactCard}>
        <h3 className={styles.contactTitle}>Still have questions?</h3>
        <p className={styles.contactText}>
          Reach out to the office and we&apos;ll help you out.
        </p>
      </div>
    </div>
  );
}
