import styles from "./page.module.css";
import Header from "../components/Header";
import Footer from "../components/Footer";

const PROGRAMS = [
  {
    icon: "yoga",
    color: "var(--teal)",
    title: "Yoga & Mobility Classes",
    body: "Relieve tension and improve focus with sessions built around the postures and joint mobility that a day on your feet, at a desk, or hunched over grading actually needs.",
  },
  {
    icon: "breath",
    color: "var(--navy)",
    title: "Breathwork Sessions",
    body: "Calm the nervous system and manage stress with guided breathing techniques staff can use in the moment, before a hard parent call, between periods, or at the end of a long day.",
  },
  {
    icon: "fitness",
    color: "var(--orange-dark)",
    title: "Functional Fitness & Body Fat Loss",
    body: "Increase energy and physical health with strength and conditioning programming that builds real world capacity, not just gym numbers. The kind of energy that carries through a full teaching day.",
  },
  {
    icon: "app",
    color: "var(--teal-dark)",
    title: "Customized App-Based Programs",
    body: "Accessible wellness tailored to individual schedules and goals, so staff who cannot make an in-person session still get a program built around their own time and priorities.",
  },
];

function ProgramIcon({ type }) {
  const icons = {
    yoga: <><circle cx="12" cy="5" r="2" /><path d="M5 21c0-4 3-6 7-6s7 2 7 6" /></>,
    breath: <path d="M9 18h6M10 22h4M12 2a6 6 0 00-3.7 10.7c.6.5.7 1 .7 1.8v.5h6v-.5c0-.8.1-1.3.7-1.8A6 6 0 0012 2z" />,
    fitness: <><circle cx="12" cy="12" r="9" /><path d="M12 3v18M3 12h18" /></>,
    app: <><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M11 18h2" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {icons[type]}
    </svg>
  );
}

export default function CorporateTraining() {
  return (
    <>
      <Header />

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <span className={styles.eyebrow}>Corporate Training</span>
          <h1>Wellness for Educators &amp; School Staff</h1>
          <p className={styles.dek}>Supporting Those Who Shape the Future</p>
          <p className={styles.lede}>
            Staff wellness matters. When educators are balanced and energized, students benefit too.
          </p>
          <a className="btn btnPrimary" href="/inquiry-form">Bring Wellness to My Staff</a>
        </div>
        <div className={styles.wave}>
          <svg viewBox="0 0 1440 100" preserveAspectRatio="none">
            <path fill="#EAF1FC" d="M0,60 C240,110 480,10 720,45 C960,80 1200,20 1440,55 L1440,100 L0,100 Z" />
          </svg>
        </div>
      </section>

      <section className={styles.why}>
        <div className="wrap">
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow}>Why It Matters</span>
            <h2>Burnout is not a mood. It is a staffing crisis</h2>
            <p>The people shaping your students&apos; futures are running on empty, and it is costing districts more than morale.</p>
          </div>

          <div className={styles.statRow}>
            <div className={styles.statCard}>
              <div className={styles.statNum}>53%</div>
              <div className={styles.statLabel}>of K-12 teachers report burnout, per RAND&apos;s 2025 State of the American Teacher survey</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statNum}>46% vs 13%</div>
              <div className={styles.statLabel}>of teachers say work leaves no room for a private life, compared to similar working adults (RAND, 2025)</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statNum}>$11.9k&ndash;$24.9k</div>
              <div className={styles.statLabel}>average cost to replace a single teacher, per the Learning Policy Institute (2024)</div>
            </div>
          </div>
          <p className={styles.statSource}>
            Sources: RAND 2025 State of the American Teacher Survey; Learning Policy Institute, 2024 Teacher Turnover Cost Update.
          </p>
        </div>
      </section>

      <section className={styles.programs}>
        <div className="wrap">
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow}>Programs Offered</span>
            <h2>Built for real school schedules</h2>
            <p>Every program is designed to fit around planning periods, after-school hours, and the reality of a school calendar, not against it.</p>
          </div>
          <div className={styles.programGrid}>
            {PROGRAMS.map((p) => (
              <div className={styles.programCard} key={p.title}>
                <div className={styles.programIcon} style={{ background: p.color }}>
                  <ProgramIcon type={p.icon} />
                </div>
                <div>
                  <h3>{p.title}</h3>
                  <p>{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.how}>
        <div className="wrap">
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow}>How It Works</span>
            <h2>Simple to bring in, easy to sustain</h2>
          </div>
          <div className={styles.howSteps}>
            <div className={styles.howStep}>
              <div className={styles.howNum}>1</div>
              <h3>We learn your staff&apos;s schedule</h3>
              <p>A short conversation about your calendar, staff size, and goals shapes a program that fits. You do not fit into it.</p>
            </div>
            <div className={styles.howStep}>
              <div className={styles.howNum}>2</div>
              <h3>Coaches lead sessions on your terms</h3>
              <p>In person, virtual, or a mix. Before school, during planning periods, or after hours, whatever actually works for your staff.</p>
            </div>
            <div className={styles.howStep}>
              <div className={styles.howNum}>3</div>
              <h3>Support continues between sessions</h3>
              <p>The app-based program keeps momentum going so wellness is not something staff only think about once a week.</p>
            </div>
          </div>

          <div className={styles.coachStrip}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21s-7-4.5-9.3-9A5 5 0 0112 6a5 5 0 019.3 6c-2.3 4.5-9.3 9-9.3 9z" />
            </svg>
            <p>
              <strong>Led by real wellness coaches</strong>, not a generic video library. Every program is guided
              by someone who helps your staff build habits that actually hold up under a school year schedule,
              not just a syllabus they forget by October.
            </p>
          </div>
        </div>
      </section>

      <div className={styles.ctaWrap}>
        <div className="wrap">
          <div className={styles.ctaBand}>
            <h2>Ready to invest in the people who invest in your students?</h2>
            <p>
              Bring a wellness program to your school or district that is built for the reality of the job,
              not a one-off workshop that fades by winter break.
            </p>
            <a className="btn btnPrimary" href="/inquiry-form">Bring Wellness to My Staff</a>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}
