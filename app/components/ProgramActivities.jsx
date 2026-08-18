import styles from "./ProgramActivities.module.css";
import ActivityCard from "./ActivityCard";

const ACTIVITIES = [
  {
    color: "#3FC0E8",
    title: "Yoga & Breathwork",
    summary: "Yoga and breathwork give kids practical tools to calm their minds and regulate emotions.",
    fullText:
      "Our instructors teach kids gentle poses and simple breathing techniques to help reduce stress, improve focus, and boost self-confidence. Studies show that even short, consistent practice can lower anxiety and improve classroom performance. For children, these skills provide a foundation of emotional regulation they can use every day.",
    illustrationSrc: "/images/yoga-illustration.png",
  },
  {
    color: "#6FCB55",
    title: "Group Fitness & Movement Games",
    summary: "Kids learn best when movement feels fun!",
    fullText:
      "With group fitness and interactive games led by our instructors, children build strength, coordination, and resilience while also practicing teamwork and communication. These activities give them a healthy outlet for stress and energy, teaching that physical movement is directly connected to how they feel emotionally.",
    illustrationSrc: "/images/movement-illustration.png",
  },
  {
    color: "#F2A65E",
    title: "Team Sports",
    summary:
      "Team sports teach life skills. Through soccer, basketball, pickleball, and more, kids practice communication, cooperation, and handling wins and losses with confidence.",
    fullText:
      "These activities strengthen not only the body, but also social-emotional skills like resilience, empathy, and leadership. By working toward shared goals, children build a sense of belonging and discover the confidence that comes from being part of something bigger than themselves.",
    illustrationSrc: "/images/team-illustration.png",
  },
];

export default function ProgramActivities() {
  return (
    <section className={styles.section} id="trail">
      <div className="wrap">
        <div className={styles.head}>
          <span className={styles.eyebrow}>Program Activities</span>
          <h2>How each session flows</h2>
          <p>Click a card to see how each activity actually helps.</p>
        </div>
        <div className={styles.grid}>
          {ACTIVITIES.map((a) => (
            <ActivityCard key={a.title} {...a} />
          ))}
        </div>
      </div>
    </section>
  );
}
