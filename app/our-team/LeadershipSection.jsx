import Image from "next/image";
import styles from "./our-team.module.css";

function PlaceholderAvatar() {
  return (
    <div className={styles.placeholder}>
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M12 14c-5 0-8 2.5-8 5v1h16v-1c0-2.5-3-5-8-5z" />
      </svg>
    </div>
  );
}

function LeaderCard({ member }) {
  return (
    <article className={styles.leaderCard}>
      <div className={styles.leaderPhoto}>
        {member.headshotUrl ? (
          <Image
            src={member.headshotUrl}
            alt={member.display_name}
            width={180}
            height={180}
            style={{ objectFit: "cover" }}
          />
        ) : (
          <PlaceholderAvatar />
        )}
      </div>
      <div className={styles.leaderContent}>
        {member.title && (
          <div className={styles.leaderTitle}>{member.title}</div>
        )}
        <h3 className={styles.leaderName}>{member.display_name}</h3>
        {member.bio && <p className={styles.leaderBio}>{member.bio}</p>}
        {member.staff_quote && (
          <blockquote className={styles.leaderQuote}>
            &ldquo;{member.staff_quote}&rdquo;
          </blockquote>
        )}
      </div>
    </article>
  );
}

export default function LeadershipSection({ members }) {
  if (!members || members.length === 0) {
    return null;
  }

  return (
    <section className={styles.leadership}>
      <div className={styles.sectionInner}>
        <div className={styles.sectionEyebrow}>Leadership</div>
        <h2 className={styles.sectionHeading}>
          The Team Behind Shape Your Destiny
        </h2>
        <div className={styles.leadershipGrid}>
          {members.map((member) => (
            <LeaderCard key={member.id} member={member} />
          ))}
        </div>
      </div>
    </section>
  );
}
