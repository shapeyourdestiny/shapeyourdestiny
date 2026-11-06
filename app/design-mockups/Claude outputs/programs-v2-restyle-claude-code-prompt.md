# Programs page v2: calmer layout + school popup

Read `AGENTS.md` first. This repo's Next.js version has breaking changes, so check `node_modules/next/dist/docs/` before changing pages or server actions.

## Goal

The admin Programs page (`app/admin/programs`) works, but it's cluttered and hard to look at. Restyle the **Districts, schools & classes** view so it's calmer and easier to scan. Then replace the school slide-out panel with a centered popup.

**This is a visual and layout change.** Keep everything else exactly as it is:
- the data loading and server actions
- the session math (`lib/schedule/sessions.js`)
- the class panel (`ClassPanel.jsx`)
- the Holidays & days off tab content

Use the navy/teal theme from commit 176019a and the tokens in `app/globals.css` (`--navy`, `--navy-deep`, `--navy-mid`, `--teal`, `--teal-dark`, `--red`, `--tint`, `--ink`, `--ink-soft`). No gold or orange. Baloo 2 for headings, Nunito for body text, CSS Modules.

Files involved: `ProgramsClient.jsx` and `ProgramsClient.module.css` (header, filters, `DistrictCard`, `SchoolSection`, `ClassRow`), `SchoolPanel.jsx` and `SchoolPanel.module.css` (becomes the popup), and `app/admin/components/SchoolDetailsFields.jsx` (reused inside the popup).

## 1. Only show schools that have classes

- A school appears only if at least one of its classes matches the current filter, program and search.
- A district appears only if it has at least one school showing.
- Schools with no classes don't appear on the page at all. There's no note or link listing them. They're still available in the class panel's School dropdown, so I can add a class to one whenever I'm ready.
- Schools with only ended classes show up in the **Ended** view.

## 2. Header

- **Left:** H1 "Programs". Under it, a live subtitle: "{N} classes at {M} schools. Click any class to edit it." Count current (not ended) classes and the schools they're at.
- **Right, in this order:**
  - "Holidays & days off": a ghost button (no background, navy text, calendar icon, light tint on hover). It switches to the Holidays tab. Remove the old tab bar. The Holidays view gets a "← Back to classes" link at the top.
  - "+ Add school": a ghost button that opens the school popup (section 6).
  - "+ Add class": the one solid button, navy background, white text, 12px radius, soft navy shadow.
- **Adding districts:** remove the "+ Add district" button and the inline add-district card. Districts are now added from inside the school popup.

## 3. Filter bar (replaces the four stat cards)

One row, left to right:

- **Segmented control** on a white rounded track with 4px padding. Each segment shows a count pill.
  - Segments: **Current · Needs instructor · Starting soon · Ended**.
  - **Selected segment:** navy background, white text, count pill `rgba(255,255,255,0.2)`.
  - **Unselected segments:** ink text, count pill `--tint`.
  - **Needs instructor** with a count above 0 (and not selected): the pill turns light red (`#FBE3E1` background, `#C2463B` text).
  - "Starting soon" is new: classes whose start date is after today.
- **Program chips:** All · Wellness · Soccer. Small rounded pills, each with a colored dot (gray for All, teal for Wellness, `--navy-mid` for Soccer). The selected chip gets a white background and a navy 1px border.
- **Search box**, pushed to the right, about 280px wide, white, with a search icon: "Search school or instructor".

## 4. Districts and schools

**District heading** (no card or box around it): a 10px dot in the district color, the name in Baloo 2 at 20px, then "{n} schools · {n} classes" in muted 14px. A 1px `#DCE4F3` line fills the rest of the row.

Keep the district "…" menu (Rename, Change color, Delete). Put it at the end of the heading row, and only show it on hover or keyboard focus. Drop the collapse feature and its localStorage.

**Schools in a 2-column grid** under the heading (14px gap, a single column below about 1100px wide). Each school is a white card: 16px radius, a soft shadow (`0 1px 3px rgba(20,44,107,0.06), 0 8px 24px rgba(20,44,107,0.05)`) and no border.

- **Card top:**
  - The school name (Baloo 2, 18px) with the address under it (13px, muted).
  - On the right, two 34px icon buttons with a light tint on hover:
    - "+": opens the class panel with this school picked. Its `aria-label` is "Add a class at {school}".
    - "⋯": opens the school popup in edit mode. Its `aria-label` is "Edit {school}".
- **Class rows:** each one is a full-width button, separated by 1px `#EEF2F9` lines (section 5).
- **Card bottom, only if the school has no instructions:** a soft row with a `#FAFBFE` background and teal-dark text, "+ Add arrival instructions for instructors". It opens the school popup in edit mode. This replaces the "No instructions yet" pill. Hide it in the Ended view.

## 5. Class row

`display: flex`, 12px vertical padding, hover background `#F5F8FE`, 60% opacity for ended classes. Left to right:

1. **Program stripe:** 4px wide, full height, rounded. Teal for Wellness, `--navy-mid` for Soccer. This replaces the program pill.
2. **Main column:**
   - **First line:** the days and time in bold 15px ("Tue & Thu · 2:30 pm", with `time` exactly as stored). After it, the program name in 13px bold, in the stripe color.
   - **Second line:**
     - **With instructors:** overlapping 24px avatars (2px white ring, -6px overlap, initials, navy/teal shades) followed by short names in 13px muted text, like "Roger W., Jane D.".
     - **With nobody assigned:** a red dot and "Needs an instructor" in `#C2463B`, 13px bold. This replaces the "No instructor" chip.
3. **Right column** (about 132px, right-aligned):
   - **Top line, 13px bold:**
     - Running fixed-length: "Ends Nov 3"
     - Ongoing: "Ongoing since Aug 26"
     - Starting soon: "Starts Nov 10", in navy
     - Ended: "Ended Oct 16"
   - **Under it, for fixed-length classes that have started:** a 64px × 5px progress bar (teal fill on a `#E6ECF7` track) and "6 of 8" in 12px muted text.
4. **A light gray chevron.**

**Remove the "Running" pill entirely.** Starting soon and ended are already clear from the date line and the fading.

## 6. School popup (replaces the slide-out panel)

Turn `SchoolPanel` into a centered popup. Use the existing `app/admin/components/Modal.jsx` if it supports this size and behavior. If not, extend it rather than writing a second modal.

- **Overlay:** `rgba(15,28,66,0.45)`, with the dialog centered. Closes with the X, Cancel, clicking the overlay or Escape.
- **Accessibility:** `role="dialog"`, `aria-modal`, labelled by the title. Focus moves to the first field on open, stays inside the popup, and returns to the button that opened it on close. The page behind doesn't scroll.
- **Dialog:** 900px wide (`max-width: calc(100vw - 48px)`), white, 20px radius, shadow `0 30px 80px rgba(15,28,66,0.35)`. Body scrolls inside if the window is short.
- **Header:**
  - Title in Baloo 2, 26px: "Add a school", or the school's name when editing.
  - Subtitle in 14px muted text:
    - Add: "Only schools with classes show on Programs. Add a class here after you save."
    - Edit: "Edit school details. Changes show for instructors right away."
  - A 40px rounded X button.
- **Body:** two columns.
  - **Left (fields):**
    - "School name" and a "District" select, side by side. The district select lists every district, then "+ New district". Choosing "+ New district" shows a light tint row underneath with a "New district name" input and the color swatches from `DISTRICT_COLORS`. On save, create the district first with `createDistrictAction`, then the school in it.
    - Then `SchoolDetailsFields`: address ("Powers the Directions button."), arrival instructions marked "(optional)", and front office contact and phone side by side, both marked "(optional)".
  - **Right column (320px):** a `#F5F8FE` background with a left border, headed "WHAT INSTRUCTORS SEE". Move the live preview out of `SchoolDetailsFields` into this column. Add a `showPreview` prop to `SchoolDetailsFields` so the fields and preview can be laid out apart.
    - **The preview card:** a white card with the school name (or "School name" in gray) and the address (or "Address shows here"). Below that, a navy "Directions" button, only when there's an address.
    - **Under the card:** the instructions box in light teal (`#E8F4F6` background, `#BFE0E6` border, teal numbered circles). Restyle the preview to teal everywhere it's used.
    - **Only show what's filled in:** keep the existing rule. Call appears only with a phone, and "Ask for…" only with a contact. When there are no instructions, contact or phone, show "No instructions yet. Instructors just get the address and Directions."
- **Footer:**
  - **Edit mode only:** "Delete school" on the left, as red text. Keep the existing delete confirmation, which says how many classes go with the school.
  - **On the right:** "Cancel" (white with a light border), then the save button. It's solid navy and reads "Add school" or "Save school". It stays disabled and faded (`#9AA8CF`) until there's a name.
- **After adding a school:** close the popup and show the usual small "Saved" message. Make it say "{School} added. It'll show here once it has a class." Don't open the class panel automatically.

Remove the old inline "Add school" row inside districts, and any code only the slide-out used.

## 7. Clean up

- Delete the CSS for everything this replaces:
  - stat cards
  - tabs
  - district card borders and collapse
  - "No instructions yet" pill
  - status pills
  - the program pill in rows
  - the inline add district/school forms
  - slide-out panel styles
- Keep the Holidays & days off tab content as is. Restyle only its buttons and pills to match navy/teal.
- **Copy:** no em dashes anywhere (en dashes in date ranges are fine). Use the exact copy above.

## When you're done

1. List the files you changed and the CSS classes you removed.
2. Run `npm run build` and `npm run lint` and show me the results.
3. Tell me what to click to check it:
   - each filter
   - a search
   - the Wellness and Soccer chips
   - a school with only ended classes
   - adding a school with a new district (it shouldn't appear on the page until it has a class, and it should be in the class panel's School dropdown)
   - editing a school's instructions with and without a phone
   - Escape and focus in the popup
   - the layout at a narrow window width

Don't commit or push. I'll review first.
