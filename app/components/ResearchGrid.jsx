import styles from "./ResearchGrid.module.css";

const TOPICS = [
  { href: "/youth-program/yoga-breathwork", color: "#3E8FA0", title: "Yoga & Breathwork", blurb: "Poses and breathing tools help kids manage stress, focus, and feel calm." },
  { href: "/youth-program/mindfulness", color: "#1F3F91", title: "Mindfulness", blurb: "Mindfulness teaches kids how to notice their feelings and reset their energy." },
  { href: "/youth-program/confidence-building-skills", color: "#E08A3C", title: "Confidence Building", blurb: "Confidence grows when kids practice new skills, set goals, and see what they're capable of." },
  { href: "/youth-program/foundations-of-fitness-sports", color: "#2C6E7D", title: "Foundations of Team Sports", blurb: "Team sports build strength, resilience, and the confidence that comes from belonging." },
  { href: "/youth-program/nutrition", color: "#2B4FA3", title: "Nutrition", blurb: "Healthy food habits give kids the energy, focus, and confidence they need to thrive." },
  { href: "/youth-program/hydration", color: "#F2A65E", title: "Hydration", blurb: "Staying hydrated boosts focus, mood, and energy so kids feel and perform their best." },
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
            <a className={styles.card} key={t.title} href={t.href}>
              <div className={styles.icon} style={{ background: t.color }} />
              <h4>{t.title}</h4>
              <p>{t.blurb}</p>
              <span className={styles.link}>Read more &rarr;</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
