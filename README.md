# Shape Your Destiny, React build

Everything below is ready to drop into your existing `~/Developer/syd` project.

## What is in this zip

- `app/page.jsx` and `app/globals.css`, the home page (Youth Wellness Program)
- `app/components/`, every reusable section (Header, Hero, ProgramActivities, ResearchArticle, etc.)
- `app/corporate-training/page.jsx`, the Corporate Training page
- `app/youth-program/[slug]/page.jsx`, one dynamic route that renders all six research pages
- `lib/research-data.js`, the content for all six research topics in one file. Edit text here, not in the component.

## Steps to ship

1. **Copy files in.** Copy `app/`, `lib/`, and `README.md` into your `syd` project, overwriting the placeholder `app/page.tsx` (delete the .tsx version if you copy in `page.jsx`).
2. **Install locally and check it.** Run `npm run dev` and click through all eight pages (home, corporate training, and all six research topics under `/youth-program/[slug]`).
3. **Add real photos.** Every image path is a placeholder right now (`/images/hero-kids.jpg`, `/images/partner-1.png` through `partner-7.png`, etc). Drop real files into `public/images/` with those exact names and they will just work. Nothing broke if you skip this, images just will not show yet.
4. **Decide on the backend for the inquiry form.** Right now the "Bring This Program to My School" buttons link to `/inquiry-form`, a page that does not exist yet. Simplest option: a single `app/api/inquiry/route.js` that emails you the submission through Resend. If you want submissions stored somewhere too, that is when you add a database. This is exactly the kind of thing to hand Claude Code once the design is locked.
5. **Push it.** `git add . && git commit -m "react build" && git push`. Since GitHub is already connected to Vercel, this deploys automatically. Check the Vercel dashboard for the new deployment.
6. **Test the live preview URL**, not just localhost, before touching your real domain.
7. **Swap the domain last.** Once everything above checks out on the `.vercel.app` URL, that is when you point `shapeyourdestiny.co` at Vercel (Project Settings, Domains). Not before.

## What is real vs placeholder right now

- Copy and text: real, pulled from your actual site content and the research documents you provided.
- Colors, fonts, layout: matches the navy, orange, teal, gold design we landed on.
- Photos and logos: placeholders. Swap the `src` paths once you have real files.
- Program Activities: real flip card interaction, matching the live site's behavior, not just an accordion.
- Inquiry form: the button exists, the actual form and backend do not yet. That is the next real build task.
