# Schedule Board v2: visual fixes

Read `AGENTS.md` first.

The Schedule Board v2 work (commit bf7db9c) is in, but the week view looks washed out and doesn't match the design. Fix only the problems below, in `app/admin/schedule/ScheduleBoard.jsx` and `ScheduleBoard.module.css`. **Don't change any data, absence or sub logic.** Use the tokens in `app/globals.css`.

## 1. Initials show as "[AC]" text instead of an avatar

`ScheduleBoard.jsx` lines ~445, 462 and 508 render `[{getInitials(...)}]` inside `.slotInitials`.

- Remove the brackets.
- Make `.slotInitials` a 28px circle:
  - Initials in white, 11px, weight 800, centered.
  - Background picked from a small navy/teal palette (`--navy`, `--teal`, `--teal-dark`, `--navy-mid`), the same color for the same person every time (hash the profile id).
- **Needs-a-sub slot:** the circle is `--red`.
- **Empty slot:** a 28px dashed circle with a "+".

## 2. Past days are faded to 50%, so the whole week looks disabled

Remove `.weekColumn.pastDay { opacity: 0.5 }` and the shadow removal on past cards. Past days stay fully readable. If you want any hint, make only that day's header number `--ink-soft`. Nothing else changes.

## 3. Day columns stretch to the bottom of the screen

The soft column backgrounds run the full page height, which leaves big empty panels.
- Columns should only be as tall as their content. Set `align-items: start` on `.weekGrid`, and remove `flex: 1` from the grid, `.weekColumnContent` and `.weekView`.
- Keep `padding: 12px` and a 16px radius on `.weekColumn.hasClasses`.
- Remove `min-height: calc(100vh - 80px)` from `.page` if it's only there to stretch this.

## 4. Empty days still have dashed boxes

Days with no classes get no box, no border and no background. Just show "No classes" in 13px `--ink-soft` text, left-aligned under the header, so the eye goes to the busy days.

## 5. Week navigation is floating in the middle

The ‹ Nov 2–6 › controls sit centered under the summary strip, apart from everything else, and "This week" looks like plain text.
- Move them into the header row, right after the "Schedule Board" title, in this order: ‹ label › "This week".
- **Week label:** Nunito 17px, weight 800, min-width 150px.
- **Arrows:** 36px ghost buttons with no background, `--tint` on hover.
- **"This week":** a pill, 34px tall, white background, 1px `--tint-deep` border, `--navy` text, 13px, weight 800, `border-radius: 999px`. Hide it when you're already on the current week.
- The summary strip sits under the header row, then the grid.

## 6. Header buttons

- **Remove the "Programs" button.** It's in the sidebar already.
- **"Mark someone out"** looks like a disabled gray box. Make it a ghost button: no border, transparent background, `--navy` text, 14px, weight 800, 42px tall, 12px radius, `--tint` on hover.
- **"+ Add class"** stays the one solid navy button.
- **Week/Month** stays the white segmented control.

## 7. Day column header

Change it from centered and stacked to one left-aligned row, with 2px top and 4px side padding:
- the weekday ("WED") in 12px, weight 800, letter-spacing 0.04em, `--ink-soft`
- then the date number in Baloo 2, 22px, weight 800, `--ink`
- then the Today or Needs a sub pill, pushed to the right with `margin-left: auto`

Pills are 22px tall, 999px radius, 11px, weight 800:
- **Today:** `--navy` background, white text
- **Needs a sub:** `#FBE3E1` background, `#A8352B` text

## 8. Card text is too faint and too small

- **School name:** 15px, weight 800, `--ink`. It's currently gray and light.
- **District line:** 13px, `--ink-soft`, with the colored dot.
- **Time:** Baloo 2, 20px, weight 800, `--ink`. Show it lowercase, like "12:00 pm", to match the rest of the app.
- **Program tag:** white text on pale teal is unreadable.
  - **Wellness:** `#E8F4F6` background, `--teal-dark` text.
  - **Soccer:** `#E6ECF8` background, `--navy-mid` text.
  - Both: 11px, weight 800, uppercase, 22px tall, 6px radius.
- **Instructor slot rows:**
  - 44px minimum height, 10px radius.
  - Name in 14px, weight 800, `--ink`. Any sub-line ("Subbing for…") in 12px, weight 700.
  - **Normal slot background:** `#F5F8FE`. Hover: `#EAF0FA`.
  - **"⋯" icon:** 0.35 opacity, 1 on hover or keyboard focus.

## 9. Check at real size

- Check the board at a 1440px window and at 100% browser zoom. Text should match the sizes above, nothing smaller than 12px.
- Check the narrow layout too (under 760px wide). Columns stack, and the empty days take up very little space.

## When you're done

1. List what you changed.
2. Run `npm run build` and show me the result.

Don't commit or push. I'll review first.
