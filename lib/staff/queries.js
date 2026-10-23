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
      bio: "Destiny founded Camp Shape after seeing firsthand how many kids in her community lacked access to basic wellness education. A certified health coach and youth advocate, she has spent over a decade building programs that meet kids where they are — with no judgment, no barriers, and a whole lot of energy.",
      headshotUrl: "/Images/destiny.png",
      programs: [],
    },
    {
      id: "heather",
      display_name: "Heather",
      title: "Director of Operations",
      bio: null,
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
      bio: null,
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
      bio: null,
      headshotUrl: "/Images/jose.png",
      programs: ["soccer"],
    },
    {
      id: "luis",
      display_name: "Luis",
      title: "Soccer Coach",
      bio: null,
      headshotUrl: "/Images/luis.png",
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
