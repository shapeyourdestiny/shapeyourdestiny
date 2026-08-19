import styles from "./ResearchGrid.module.css";
import { RESEARCH_TOPICS } from "@/lib/research-data";

const ICONS = {
  yoga: <path d="M5 21c0-4 3-6 7-6s7 2 7 6M12 5a2 2 0 100 4 2 2 0 000-4z" />,
  sports: <><circle cx="8" cy="8" r="3" /><circle cx="17" cy="8" r="3" /><path d="M2 21c0-3.5 2.7-6 6-6s6 2.5 6 6M11 21c0-3.5 2.7-6 6-6s5 2.5 5 6" /></>,
  mindfulness: <><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
  confidence: <path d="M12 21s-7-4.5-9.3-9A5 5 0 0112 6a5 5 0 019.3 6c-2.3 4.5-9.3 9-9.3 9z" />,
  nutrition: <><path d="M12 3c4 0 7 3 7 8s-4 10-7 10-7-5-7-10 3-8 7-8z" /><path d="M12 3v4" /></>,
  hydration: <path d="M12 3s7 8 7 13a7 7 0 01-14 0c0-5 7-13 7-13z" />,
};

const TOPICS = [
  { slug: "yoga-breathwork", ...RESEARCH_TOPICS["yoga-breathwork"] },
  { slug: "mindfulness", ...RESEARCH_TOPICS["mindfulness"] },
  { slug: "confidence-building-skills", ...RESEARCH_TOPICS["confidence-building-skills"] },
  { slug: "foundations-of-fitness-sports", ...RESEARCH_TOPICS["foundations-of-fitness-sports"] },
  { slug: "nutrition", ...RESEARCH_TOPICS["nutrition"] },
  { slug: "hydration", ...RESEARCH_TOPICS["hydration"] },
];

export default function ResearchGrid() {
  return (
    <section className={styles.section} id="research">
      <div className="wrap">
        <div className={styles.head}>
          <span className={styles.eyebrow}>The Science Behind It</span>
          <h2>Supporting research</h2>
          <p>Every stop on the trail is backed by something real.</p>
        </div>
        <div className={styles.grid}>
          {TOPICS.map((t) => (
            <a className={styles.card} key={t.slug} href={`/youth-program/${t.slug}`}>
              <div className={styles.iconWrap} style={{ background: t.color }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {ICONS[t.icon]}
                </svg>
              </div>
              <div className={styles.cardContent}>
                <h4>{t.title}</h4>
                <p>{t.tldr[0]}</p>
                <div className={styles.stat}>
                  <span className={styles.statNum} style={{ color: t.colorDark }}>{t.stats[0].num}</span>
                  <span className={styles.statLabel}>{t.stats[0].label}</span>
                </div>
              </div>
              <span className={styles.link} style={{ color: t.colorDark }}>
                Read more
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
