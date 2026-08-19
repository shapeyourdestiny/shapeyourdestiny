import styles from "./ResearchArticle.module.css";

const ICONS = {
  yoga: <path d="M5 21c0-4 3-6 7-6s7 2 7 6M12 5a2 2 0 100 4 2 2 0 000-4z" />,
  sports: <><circle cx="8" cy="8" r="3" /><circle cx="17" cy="8" r="3" /><path d="M2 21c0-3.5 2.7-6 6-6s6 2.5 6 6M11 21c0-3.5 2.7-6 6-6s5 2.5 5 6" /></>,
  mindfulness: <><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
  confidence: <path d="M12 21s-7-4.5-9.3-9A5 5 0 0112 6a5 5 0 019.3 6c-2.3 4.5-9.3 9-9.3 9z" />,
  nutrition: <><path d="M12 3c4 0 7 3 7 8s-4 10-7 10-7-5-7-10 3-8 7-8z" /><path d="M12 3v4" /></>,
  hydration: <path d="M12 3s7 8 7 13a7 7 0 01-14 0c0-5 7-13 7-13z" />,
};

/**
 * Renders any topic from lib/research-data.js.
 * Used by app/youth-program/[slug]/page.jsx
 */
export default function ResearchArticle({ topic, allSlugs }) {
  return (
    <>
      <div className={styles.backbar}>
        <div className="wrap">
          <a href="/#research">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back to Youth Wellness Program
          </a>
        </div>
      </div>

      <section className={styles.topicHero}>
        <div className={styles.topicHeroInner}>
          <div className={styles.topicIcon} style={{ background: topic.color }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              {ICONS[topic.icon]}
            </svg>
          </div>
          <span className={styles.eyebrow}>The Science Behind It</span>
          <h1>{topic.title}</h1>
          <p className={styles.dek}>{topic.dek}</p>
        </div>
      </section>

      <div className={styles.wave}>
        <svg viewBox="0 0 1440 100" preserveAspectRatio="none">
          <path fill="#EAF1FC" d="M0,60 C240,110 480,10 720,45 C960,80 1200,20 1440,55 L1440,100 L0,100 Z" />
        </svg>
      </div>

      <section className={styles.content}>
        <div className="wrap">
          <div className={styles.tldr} style={{ borderTop: `5px solid ${topic.color}` }}>
            <h2 style={{ color: topic.colorDark }}>The 30 Second Version</h2>
            <ul>
              {topic.tldr.map((line, i) => (
                <li key={i}>
                  <svg viewBox="0 0 24 24" fill="none" stroke={topic.color} strokeWidth="2.4" strokeLinecap="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <article className={styles.article}>
            <div className={styles.statRow}>
              {topic.stats.map((s, i) => (
                <div className={styles.statCard} key={i}>
                  <div className={styles.statNum} style={{ color: topic.colorDark }}>{s.num}</div>
                  <div className={styles.statLabel}>{s.label}</div>
                </div>
              ))}
            </div>

            {topic.sections.map((section, i) => (
              <div key={i}>
                <h2>{section.heading}</h2>
                <p>{section.body}</p>
                {topic.pullQuote && i === 0 && (
                  <p className={styles.pullQuote}>{topic.pullQuote}</p>
                )}
              </div>
            ))}
          </article>

          <details className={styles.sources}>
            <summary>
              View Sources
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <div className={styles.sourcesList}>
              <ol>
                {topic.sources.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </div>
          </details>
        </div>
      </section>

      <section className={styles.nextTopics}>
        <div className={`wrap ${styles.inner}`}>
          <h3>Explore The Rest Of The Research</h3>
          <div className={styles.chipRow}>
            {allSlugs.map((slug) => (
              <a className={styles.chip} href={`/youth-program/${slug}`} key={slug}>
                {slug
                  .split("-")
                  .map((w) => w[0].toUpperCase() + w.slice(1))
                  .join(" ")}
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
