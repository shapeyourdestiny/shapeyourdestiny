/**
 * Static staff data for the /our-team page.
 * Edit this file directly to add or remove team members.
 */
const STATIC_STAFF = {
  leadership: [
    {
      id: "destiny",
      display_name: "Destiny",
      title: "Founder",
      bio: "Destiny founded Camp Shape after seeing firsthand how many kids in her community lacked access to basic wellness education. A yoga master and youth advocate, she holds certifications in youth fitness, nutrition, and health coaching, and is CASEL certified. For over a decade, she has built programs that meet kids where they are, with no judgment, no barriers, and a whole lot of energy.",
      headshotUrl: "/Images/destiny.png",
      programs: [],
    },
    {
      id: "heather",
      display_name: "Heather",
      title: "Director of Operations",
      bio: "Heather Swear is the Director of Operations at Shape Your Destiny, where she oversees the programs, instructors, and school partnerships behind our children's wellness and intramural sports offerings. With ten years of coaching experience, she still teaches yoga and health to kids herself. She also builds the systems that keep everything running, including our website and admin tools for scheduling, payroll, and instructor compliance, so every program launches smoothly and instructors can focus on the kids.",
      headshotUrl: "/Images/heather.png",
      programs: ["wellness"],
    },
  ],
  instructors: [
    {
      id: "alexis",
      display_name: "Alexis",
      title: "Instructor",
      bio: null,
      headshotUrl: "/Images/alexis.png",
      programs: ["soccer", "wellness"],
    },
    {
      id: "maylena",
      display_name: "Maylena",
      title: "Instructor",
      bio: "A former collegiate soccer player, Maylena is passionate about helping young athletes learn and grow. She specializes in teaching technique, building speed, and improving ball control while creating a fun, supportive environment where kids can build confidence, teamwork, and a love for soccer.",
      headshotUrl: "/Images/maylena.png",
      programs: ["soccer", "wellness"],
    },
    {
      id: "leila",
      display_name: "Leila",
      title: "Soccer Coach",
      bio: "Leila played soccer throughout her childhood and went on to compete at the collegiate level at CSUSB. She has coached high school soccer, led private training sessions, and holds a 9v9 coaching license from U.S. Soccer. Through camps, fundraisers, and work with nonprofits, Leila has gained experience with children of all ages — helping them find a safe space to have fun with sports, just as she did growing up.",
      headshotUrl: "/Images/leila.png",
      programs: ["soccer"],
    },
    {
      id: "jose",
      display_name: "Jose",
      title: "Soccer Coach",
      bio: "Jose holds a U.S. Soccer National 'A' License and Grassroots Educator Certification, with over 15 years of experience coaching boys and girls club soccer — including in Spain. He has served as a Director of Coaching and Technical Director, and currently coaches Varsity Girls Soccer at Diamond Ranch High School while scouting for SoCal and national programs. Jose specializes in youth soccer methodology and brings a wealth of knowledge from his background in Spain, where soccer is a way of life.",
      headshotUrl: "/Images/jose.png",
      programs: ["soccer"],
    },
    {
      id: "luis",
      display_name: "Luis",
      title: "Soccer Coach",
      bio: "Luis has dedicated 15 years to coaching and developing soccer players from ages 6 to 19 — guiding athletes from their very first touches to top-tier club competition. He believes in teaching the game with attention to detail, giving players the exact tools they need to master their craft. Beyond building better players, Luis is committed to mentoring strong, disciplined individuals who succeed both on and off the field.",
      headshotUrl: "/Images/luis.png",
      programs: ["soccer"],
    },
    {
      id: "dan",
      display_name: "Dan",
      title: "Soccer Coach",
      bio: "Dan brings seven years of experience teaching a wide range of sports to children ages 1–16. He has served as a high school head soccer coach for two years and spent additional time as an assistant coach for both soccer and football programs.",
      headshotUrl: "/Images/dan.png",
      programs: ["soccer"],
    },
    {
      id: "eihab",
      display_name: "Eihab",
      title: "Soccer Coach",
      bio: "A former professional soccer player and youth coach with over 22 years of playing and coaching experience. Eihab holds AFC B & C Coaching Licenses, AFC Physical Fitness certifications, and FIFA Guardians certification. He has worked with youth players through the Manchester City Soccer Schools program and is passionate about developing technical skills, confidence, teamwork, and a love for the game.",
      headshotUrl: "/Images/eihab.png",
      programs: ["soccer"],
    },
  ],
};

/**
 * Get public staff data for the /our-team page.
 * Returns static staff data with local images.
 */
export async function getPublicStaff() {
  const { leadership, instructors } = STATIC_STAFF;

  // Collect unique programs that are in use
  const programSet = new Set();
  instructors.forEach((p) => {
    (p.programs || []).forEach((prog) => programSet.add(prog));
  });
  const programs = Array.from(programSet).sort();

  return { leadership, instructors, programs };
}
