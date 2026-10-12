import Image from "next/image";
import Link from "next/link";
import Header from "../components/Header";
import Footer from "../components/Footer";
import styles from "./page.module.css";

export const metadata = {
  title: "Intramural Sports | Shape Your Destiny",
  description:
    "Soccer and basketball intramurals run right on your school campus, with flag football coming soon. Every kid gets on a team, coached by trained Shape instructors.",
  openGraph: {
    title: "Intramural Sports | Shape Your Destiny",
    description:
      "Soccer and basketball intramurals run right on your school campus, with flag football coming soon. Every kid gets on a team, coached by trained Shape instructors.",
    images: ["/Images/intramurals/soccer-group.jpg"],
  },
};

// SVG Icons
function SoccerIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
      <path d="M2 12h20" />
    </svg>
  );
}

function BasketballIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07" />
      <path d="M12 2v20M2 12h20" />
    </svg>
  );
}

function RunningIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="17" cy="4" r="2" />
      <path d="M15 21l-2-4-4-1 2-5 5-1 2 4" />
      <path d="M7 12l-4 2" />
      <path d="M17 17l4 2" />
    </svg>
  );
}

function JerseyIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6l3-2h10l3 2v5l-3 1v10H7V12l-3-1V6z" />
      <path d="M12 4v6" />
    </svg>
  );
}

function StarIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function HandshakeIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 17l-1.5 1.5a2.12 2.12 0 01-3 0 2.12 2.12 0 010-3L11 11" />
      <path d="M14 7l1.5-1.5a2.12 2.12 0 013 0 2.12 2.12 0 010 3L14 13" />
      <path d="M7 8l3 3M17 16l-3-3" />
      <path d="M3 12h4M17 12h4" />
    </svg>
  );
}

function WhistleIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="14" r="5" />
      <path d="M13 14h8M13 9l8-5" />
      <circle cx="8" cy="14" r="2" />
    </svg>
  );
}

function HouseIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10l9-7 9 7v11a1 1 0 01-1 1H4a1 1 0 01-1-1V10z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

function ShieldIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

// Sport card component with optional image
function SportCard({ sport, description, skills, image, imageAlt, isReversed }) {
  const Icon = sport === "Soccer" ? SoccerIcon : BasketballIcon;
  const colorClass = sport === "Soccer" ? styles.accentOrange : styles.accentTeal;

  return (
    <div className={`${styles.sportRow} ${isReversed ? styles.sportRowReversed : ""}`}>
      <div className={styles.sportImageWrap}>
        {image ? (
          <>
            <div className={`${styles.sportImageOffset} ${colorClass}`} />
            <Image
              src={image}
              alt={imageAlt}
              width={480}
              height={320}
              className={styles.sportImage}
            />
          </>
        ) : (
          <>
            <div className={`${styles.sportImageOffset} ${colorClass}`} />
            <div className={styles.sportPlaceholder}>
              <BasketballIcon className={styles.placeholderIcon} />
              <span>Basketball photo</span>
            </div>
          </>
        )}
      </div>

      <div className={styles.sportContent}>
        <div className={styles.sportIconCircle}>
          <Icon className={styles.sportIcon} />
        </div>
        <h3 className={styles.sportTitle}>{sport}</h3>
        <p className={styles.sportDesc}>{description}</p>
        <div className={styles.skillChips}>
          {skills.map((skill) => (
            <span key={skill} className={styles.skillChip}>
              {skill}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// Benefits grid item
function BenefitItem({ icon: Icon, title, text }) {
  return (
    <div className={styles.benefitItem}>
      <div className={styles.benefitIcon}>
        <Icon className={styles.benefitIconSvg} />
      </div>
      <h4 className={styles.benefitTitle}>{title}</h4>
      <p className={styles.benefitText}>{text}</p>
    </div>
  );
}

// School benefit item
function SchoolBenefitItem({ icon: Icon, title, text }) {
  return (
    <div className={styles.schoolItem}>
      <div className={styles.schoolIcon}>
        <Icon className={styles.schoolIconSvg} />
      </div>
      <div>
        <h4 className={styles.schoolItemTitle}>{title}</h4>
        <p className={styles.schoolItemText}>{text}</p>
      </div>
    </div>
  );
}

export default function IntramuralSportsPage() {
  return (
    <>
      <Header />

      <main>
        {/* 1. Hero Section */}
        <section className={styles.hero}>
          <div className={styles.heroGrid}>
            <div className={styles.heroText}>
              <p className={styles.heroEyebrow}>School Intramural Sports</p>
              <h1 className={styles.heroTitle}>Game Day for Every Kid</h1>
              <p className={styles.heroBody}>
                We run intramural sports right on your campus. Kids of every skill level get on a team, learn the game, and practice communication, cooperation and handling wins and losses with confidence.
              </p>
              <div className={styles.heroCtas}>
                <Link href="/contact?topic=intramurals" className="btn btnPrimary">
                  Bring intramurals to my school
                </Link>
                <a href="#sports" className={styles.heroTextLink}>
                  See our sports
                </a>
              </div>
            </div>

            <div className={styles.heroPhotos}>
              {/* Decorative blobs */}
              <div className={`${styles.blob} ${styles.blobNavy}`} />
              <div className={`${styles.blob} ${styles.blobTeal}`} />
              <div className={`${styles.blob} ${styles.blobOrange}`} />

              {/* Large circle photo */}
              <div className={styles.heroPhotoLarge}>
                <Image
                  src="/Images/intramurals/soccer-chase.jpg"
                  alt="Young students chasing a soccer ball across the grass"
                  width={380}
                  height={380}
                  className={styles.heroPhotoImg}
                  priority
                />
              </div>

              {/* Small circle photo */}
              <div className={styles.heroPhotoSmall}>
                <Image
                  src="/Images/intramurals/soccer-duel.jpg"
                  alt="Two students going for the same soccer ball"
                  width={180}
                  height={180}
                  className={styles.heroPhotoImg}
                  priority
                />
              </div>
            </div>
          </div>

          <div className={styles.heroWave}>
            <svg viewBox="0 0 1440 100" preserveAspectRatio="none">
              <path fill="#E7EFFC" d="M0,60 C240,110 480,10 720,45 C960,80 1200,20 1440,55 L1440,100 L0,100 Z" />
            </svg>
          </div>
        </section>

        {/* 2. Our Sports Section */}
        <section id="sports" className={styles.sportsSection}>
          <div className="wrap">
            <div className={styles.sportsHeader}>
              <span className={styles.sectionLabel}>Our sports</span>
              <h2 className={styles.sportsHeading}>
                <span className={styles.textRoyal}>Soccer,</span>{" "}
                basketball,{" "}
                <span className={styles.textOrange}>and more on the way.</span>
              </h2>
              <p className={styles.sportsSubtext}>Flag football is coming soon.</p>
            </div>

            <SportCard
              sport="Soccer"
              description="Dribbling, passing and moving as a team. Small-sided games keep every kid involved and touching the ball, whether it&apos;s their first time or they play every weekend."
              skills={["Footwork", "Passing", "Spacing", "Teamwork"]}
              image="/Images/intramurals/soccer-group.jpg"
              imageAlt="Kids playing intramural soccer on a school field"
            />

            <SportCard
              sport="Basketball"
              description="Dribbling, passing and shooting fundamentals, with games where every player gets touches and learns to read the court."
              skills={["Ball handling", "Shooting form", "Defense", "Teamwork"]}
              imageAlt="Basketball placeholder"
              isReversed
            />
          </div>
        </section>

        {/* 3. Photo Band 1 */}
        <section
          className={styles.photoBand}
          role="img"
          aria-label="A full field of students playing soccer"
        >
          <div
            className={styles.photoBandBg}
            style={{ backgroundImage: "url(/Images/intramurals/soccer-field.jpg)" }}
          />
          <div className={styles.photoBandOverlay} />
          <div className={styles.photoBandContent}>
            <div className={styles.photoBandBox}>
              <span className={styles.photoBandLabel}>On the field</span>
              <p className={styles.photoBandHeadline}>
                Every kid plays. Every kid has a team.
              </p>
              <p className={styles.photoBandText}>
                Beginners and kids who play every weekend share the same field, and everybody gets the ball.
              </p>
            </div>
          </div>
        </section>

        {/* 4. How Intramurals Work */}
        <section className={styles.howSection}>
          <div className="wrap">
            <div className={styles.howHeader}>
              <span className={styles.sectionLabel}>For schools</span>
              <h2 className={styles.howHeading}>
                How intramurals <span className={styles.textOrange}>work</span>
              </h2>
            </div>

            <div className={styles.howSteps}>
              <div className={styles.howDashedLine} />

              <div className={styles.howStep}>
                <div className={`${styles.howNum} ${styles.howNumOrange}`}>1</div>
                <h3 className={styles.howStepTitle}>We come to your campus</h3>
                <p className={styles.howStepText}>
                  Games run right at your school, so there are no buses and no extra trips for families.
                </p>
              </div>

              <div className={styles.howStep}>
                <div className={`${styles.howNum} ${styles.howNumTeal}`}>2</div>
                <h3 className={styles.howStepTitle}>Every kid gets on a team</h3>
                <p className={styles.howStepText}>
                  Kids of every skill level play together, so everyone gets time with the ball and a team to belong to.
                </p>
              </div>

              <div className={styles.howStep}>
                <div className={`${styles.howNum} ${styles.howNumRoyal}`}>3</div>
                <h3 className={styles.howStepTitle}>Coached by Shape instructors</h3>
                <p className={styles.howStepText}>
                  Our instructors are trained to create a safe, encouraging space, and they teach the game along with good sportsmanship.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Photo Band 2 */}
        <section
          className={`${styles.photoBand} ${styles.photoBand2}`}
          role="img"
          aria-label="A student dribbling the ball"
        >
          <div
            className={styles.photoBandBg}
            style={{ backgroundImage: "url(/Images/intramurals/soccer-feet.jpg)" }}
          />
          <div className={`${styles.photoBandOverlay} ${styles.photoBandOverlayDark}`} />
          <div className={styles.photoBand2Content}>
            <p className={styles.photoBand2Headline}>Learn it. Miss it. Try again.</p>
            <p className={styles.photoBand2Subtext}>That&apos;s how confidence gets built.</p>
          </div>
        </section>

        {/* 6. Benefits Section */}
        <section className={styles.benefitsSection}>
          <div className="wrap">
            <div className={styles.benefitsGrid}>
              {/* Left column */}
              <div className={styles.benefitsLeft}>
                <span className={styles.sectionLabel}>The benefits</span>
                <h2 className={styles.benefitsHeading}>
                  More than a <span className={styles.textOrange}>game</span>
                </h2>
                <p className={styles.benefitsIntro}>
                  Kids come for the game. What they take home lasts a lot longer than the season.
                </p>

                <div className={styles.researchCard}>
                  <h4 className={styles.researchTitle}>Backed by research</h4>
                  <p className={styles.researchText}>
                    Kids in structured physical activity tend to have lower body fat and a lower risk of obesity, and research links that to higher self-confidence.
                  </p>
                  <Link href="/youth-program/foundations-of-fitness-sports" className={styles.researchLink}>
                    See the research
                  </Link>
                </div>
              </div>

              {/* Right column - 2x2 grid */}
              <div className={styles.benefitsRight}>
                <span className={styles.benefitsRightLabel}>For kids</span>
                <div className={styles.benefitsItems}>
                  <BenefitItem
                    icon={RunningIcon}
                    title="More time moving"
                    text="A lot of kids sit for most of the school day. Intramurals give them a real reason to run around, and they actually enjoy it."
                  />
                  <BenefitItem
                    icon={JerseyIcon}
                    title="A team at their own school"
                    text="Not every kid can make a club team or get a ride to practice across town. Here they play with their classmates on their own campus."
                  />
                  <BenefitItem
                    icon={StarIcon}
                    title="Confidence they can see"
                    text="They learn a skill, try it in a game, miss, and try again. Watching themselves get better at something hard sticks with them."
                  />
                  <BenefitItem
                    icon={HandshakeIcon}
                    title="Learning to get along"
                    text="Calling for the ball, cheering on a teammate, shaking hands after a loss. The same stuff helps in the classroom too."
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 7. For Your School Section */}
        <section className={styles.schoolSection}>
          <div className="wrap">
            <div className={styles.schoolPanel}>
              <div className={styles.schoolPhoto}>
                <Image
                  src="/Images/intramurals/soccer-little-ones.jpg"
                  alt="Younger students playing soccer at school"
                  width={400}
                  height={300}
                  className={styles.schoolPhotoImg}
                />
              </div>
              <div className={styles.schoolContent}>
                <SchoolBenefitItem
                  icon={WhistleIcon}
                  title="We bring the coaches"
                  text="Our instructors run every session, so your teachers don&apos;t have to give up their time."
                />
                <SchoolBenefitItem
                  icon={HouseIcon}
                  title="Easy on families"
                  text="Games happen on campus, so parents don&apos;t have to drive anywhere extra."
                />
                <SchoolBenefitItem
                  icon={ShieldIcon}
                  title="A safe, organized setting"
                  text="Kids are with trained adults who plan every session and know how to keep things positive."
                />
              </div>
            </div>
          </div>
        </section>

        {/* 8. Contact Section */}
        <section id="contact" className={styles.contactSection}>
          <div className="wrap">
            <div className={styles.contactPanel}>
              <span className={styles.contactLabel}>For principals &amp; school staff</span>
              <h2 className={styles.contactHeading}>Bring intramurals to your school</h2>
              <p className={styles.contactText}>
                Tell us about your campus and which sports you&apos;re interested in, and we&apos;ll put together a plan that fits your schedule.
              </p>
              <Link href="/contact?topic=intramurals" className="btn btnPrimary">
                Contact us
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
