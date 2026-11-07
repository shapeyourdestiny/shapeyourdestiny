# Instructor Inbox: visual polish and empty states

Read `AGENTS.md` first. Change only the look and the empty states of `/instructor/inbox` and the active state of the bottom nav. Don't change any data or logic. Use the navy/teal tokens in `app/globals.css`, with Baloo 2 headings and Nunito body text.

## 1. Bottom nav active tab

The active tab is navy text on a slightly lighter navy pill, which is hard to read. Make the active tab **`--teal` (`#3E8FA0`) background with white icon and label**. Inactive tabs stay `#DCE6FA`. Apply this everywhere the floating nav is used.

## 2. Header

- "Inbox" (Baloo 2, 32px).
- Under it:
  - **When there's nothing unread:** a teal-dark line with a small check icon, "All caught up".
  - **Otherwise:** "{n} new updates" in `--ink-soft`.
- "Mark all read" is a small ghost link on the right, only when there's something unread.

## 3. Tabs

**Remove the "+ Send one" button from the tab row.** The tabs get the full width:
- **Track:** white, 16px radius, 4px padding, soft shadow.
- **Each tab:** 44px tall, 12px radius, `flex: 1`.
- **Selected tab:** solid `--navy` with white text.
- **Unselected tabs:** transparent, with `--ink-soft` text.
- **Unread counts:** keep them as they are, red on Updates and light teal on Shout-outs, white on the selected tab.

## 4. Shout-outs tab, empty state

Instead of a single line of gray text, show two cards.

**Card 1: the hero**
- **Card:** 24px radius, background `linear-gradient(160deg, #DFF1F4 0%, #fff 70%)`, centered text, 30px top padding.
- **Decorations:** three tiny `aria-hidden` shapes in the corners, two soft dots and one small rounded square (`#9FD4DE`, `#C9D5EE`).
- **Illustration** (`aria-hidden`, about 96×80, made in CSS): two overlapping rounded tiles.
  - **Behind:** a white 58px tile rotated -10°, with a navy-mid heart icon.
  - **In front:** a teal 62px tile rotated 8°, with a white star and a soft teal shadow.
- **Heading:** "No shout-outs yet" (Baloo 2, 24px).
- **Text:** "When a teammate thanks you, it lands here. Parent thank-yous too." (15px, `--ink-soft`, max-width 270px).

**Card 2: "From your recent classes"** (lets them go back to a past class and thank whoever was there)
- **Card:** white, 20px radius.
- **Title:** "From your recent classes" (Baloo 2, 19px).
- **Line under it:** "Thank someone you taught with or who covered for you."
- **One row per past session** in the last 45 days where someone else was involved, newest first, showing 3 to start. Use `getSessionStaff` on past dates. A session counts when:
  - they co-taught it
  - someone subbed for them
  - or they subbed and someone else was teaching

  Skip sessions they taught alone. If they had several people in one session, make one row per person.
- **Each row** (thin divider between rows):
  - **Left:** a 48px date tile: the weekday in small caps over the day number in Baloo 2, 20px, on a light tint.
  - **Middle:** the school name in bold. Under it, a 20px avatar plus "with {full name}", "{first name} subbed for you" or "you subbed with {first name}".
  - **Right:** a teal "Thank" pill with a star icon. It opens the compose sheet for that person, with that class and date as the context, so the shout-out shows "Palmetto, Wed Nov 4".
- **Already thanked:** if they've already sent that person a shout-out for that session, show "✓ Thanked" in teal-dark text instead of the button.
- **More rows:** a "Show older classes" button at the bottom loads the next 5 (up to 45 days back), then changes to "Show less".
- **Nothing to show:** hide the card.

**When there are shout-outs, keep this card** at the bottom of the Shout-outs list, so sending is always one tap away.

**Also on My Schedule:** under the "My classes" section, add a small ghost link, "Past classes ›". It opens a sheet with the same list, so they can go back to a previous class from their schedule too.

## 5. Updates tab, empty state

**Card 1: the hero**
- **Card:** same style, with background `linear-gradient(160deg, #E4EBF9 0%, #fff 70%)`.
- **Icon:** a 72px navy rounded square (22px radius, navy shadow) with a white inbox-tray icon.
- **Heading:** "You're all caught up".
- **Text:** "Classes you're covering, time off, reviews and notes from the office show up here."

**Below it: "YOUR NEXT CLASS"**
- **Label:** small uppercase, `--ink-soft`.
- **One white card:**
  - **Left:** a navy date tile with the weekday in light caps over the day number in white Baloo 2, 24px.
  - **Middle:** the school name in bold, with "{Program} · {time}" under it.
  - **Right:** a chevron. Tapping opens the class details sheet.
- **No upcoming class:** hide this section.

## When you're done

1. Run `npm run build` and show me the result.
2. Tell me how it looks at 390px wide. Nothing should sit behind the floating nav.

Don't commit or push.
