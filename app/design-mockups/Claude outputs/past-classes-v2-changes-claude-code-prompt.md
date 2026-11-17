# Past classes v2: changes to the note form (stars instead of rating and tags)

This follows up on the Past classes v2 prompt you're already working on. Keep everything else from that prompt as it is: the header, the "Your last class" card, the class list, the absent and sub labels, and the thank-you flow. **Only the class note changes.**

Read `AGENTS.md` first. The updated design is on my canvas, in "Past classes v2: thank your team, tell us how it went". Open the "Add a note" and "After a note and thanks" boards.

## What changed

**Old:** a Great / Good / Tough rating, plus quick tags: "Kids loved it", "Needed supplies", "Behavior was tough", "Ran short on time", "Lesson needs a tweak".

**New:**
- **Three star rows, 1 to 5 stars each:**
  - **"How did class go?"** (overall). Required.
  - **"Kept their attention"**. Optional.
  - **"Behavior"**. Optional.
- **One checkbox:** "We need more supplies".
- **No tags at all.** Remove every tag chip.

The textarea, "What worked, and what could be better?", stays the same.

## 1. Note form

- Remove the Great / Good / Tough buttons and all the tag chips.
- Remove the separate "How did class go?" heading above the rating. That label is now the first star row.
- **Each star row:**
  - The label is on the left, and 5 stars are on the right.
  - Filled stars are amber (`#F2A93B`) and empty ones are light gray (`#DCE3F1`).
  - Tapping a star sets the rating. Tapping the same star again clears it.
  - Each star is a button at least 44px tall, with an aria-label like "Kept their attention: 3 of 5" and `aria-pressed`.
  - Each row is a labelled group.
- **"Save note"** is disabled until the overall row has a rating.
- The footer stays the same: "Only the admin team sees this.", Cancel, and "Save note".

## 2. Saved note on the card

Replace the rating pill with:
- **Top line:** "Your note", with the **Edit** link on the right.
- **Small star rows:** "Overall ★★★★☆ · Attention ★★★☆☆ · Behavior ★★★★☆", with 12px stars, wrapping if needed. Leave out any row they skipped.
- **A small amber "Needs supplies" pill,** if they checked it.
- **The note text.**

**Edit** reopens the form with the stars and checkbox already filled in.

## 3. Database

**Check whether `add-class-notes.sql` has been run yet.** Tell me which case applies.

**If it hasn't been run:** edit `add-class-notes.sql` so the table has the columns below instead of `rating` and `tags`.

**If it has been run:** leave that file alone, and write `supabase/migrations/update-class-notes.sql`. Make it idempotent, and tell me when to run it.

```sql
ALTER TABLE class_notes ADD COLUMN IF NOT EXISTS overall SMALLINT CHECK (overall BETWEEN 1 AND 5);
ALTER TABLE class_notes ADD COLUMN IF NOT EXISTS attention SMALLINT CHECK (attention BETWEEN 1 AND 5);
ALTER TABLE class_notes ADD COLUMN IF NOT EXISTS behavior SMALLINT CHECK (behavior BETWEEN 1 AND 5);
ALTER TABLE class_notes ADD COLUMN IF NOT EXISTS needs_supplies BOOLEAN NOT NULL DEFAULT false;

-- Carry over any notes already saved
UPDATE class_notes SET overall = CASE rating WHEN 'great' THEN 5 WHEN 'good' THEN 4 WHEN 'tough' THEN 2 END
  WHERE overall IS NULL AND rating IS NOT NULL;
UPDATE class_notes SET needs_supplies = true
  WHERE 'Needed supplies' = ANY(tags) AND needs_supplies = false;
UPDATE class_notes SET behavior = 2
  WHERE behavior IS NULL AND ('Behavior was tough' = ANY(tags) OR 'Behavior issues' = ANY(tags));

-- Make old columns optional so new notes don't need them
ALTER TABLE class_notes ALTER COLUMN rating DROP NOT NULL;
```

After the carry-over:
- Make `overall` required (`SET NOT NULL`), but only if every row has a value. Otherwise tell me how many don't.
- **Don't drop `rating` or `tags`.** Stop using them in the code, and list them for me to remove later.
- If any saved note used "Ran short on time" or "Lesson needs a tweak", copy that tag onto the end of the note text. For example: "(Ran short on time)". That way nothing is lost.

**Server validation:**
- `overall` is required and must be 1 to 5.
- `attention` and `behavior` are optional, 1 to 5.
- `needs_supplies` is a boolean.
- Reject any request that still sends `rating` or `tags`.

The access rules (RLS) and the "only for classes they actually taught or subbed" check stay the same.

## 4. Admin side

- **Programs class panel, "Class notes" section:**
  - Each note shows its star rows, the instructor's first name, the date, "Needs supplies" if they checked it, and the text. No rating pill.
  - **New:** at the top of the section, show the class's averages over the last 30 days, for example "Overall 4.3 · Attention 3.6 · Behavior 4.1". Each average only counts notes that rated that row. Hide a row that has no ratings.
- **Instructor page, "Class notes":** the same note display.
- **Admin Inbox:** the trigger rules change.
  - **Old:** a Tough rating, or the Needed supplies or behavior tags.
  - **New:** any star row at 2 or lower, or "We need more supplies" checked. Example wording:
    - "Shadow Hills, Thu Nov 5: Maleyna rated attention 2 of 5."
    - "Shadow Hills, Thu Nov 5: Maleyna needs supplies."
  - If one note sets off more than one trigger, make one Inbox item that lists them all: "rated attention 2 of 5 · needs supplies".
  - Editing a note doesn't create a second item. Update the existing item instead.

## 5. Thank-you quick picks

Change the quick-pick chips in the thank form. Keep them about coaching kids, not about a specific activity.
- **Normal classes:** "Great energy with the kids", "You kept them engaged", "Great teamwork". These replace the old three.
- **Subs:** "Thanks for covering", "The kids were in good hands", "You saved the day". These replace the old three.

Update the server-side list of allowed quick picks too, if there is one. Shout-outs already sent stay as they are.

## 6. Clean up

Search for anything left over from the old version and remove it:
- "Great / Good / Tough" and any `rating` labels or colors in the UI
- tag lists or tag constants
- "The kids loved your game", "Kids said you were awesome", "Thanks for the help"
- "Kids loved it", "Behavior was tough", "Behavior issues", "Ran short on time", "Lesson needs a tweak"
- rating pill styles in the CSS Modules

## When you're done

1. Tell me which database case applied, list the files you changed, and give me the SQL to run.
2. Run `npm run build` and `npm run lint` and show me the results.
3. Give me a click-through on a phone-sized screen:
   - The form shows three star rows and the supplies checkbox, with no tags. "Save note" stays disabled until Overall is set.
   - Save 5 / 3 / 4 with supplies checked. The card shows the stars and "Needs supplies". Edit reopens it with everything filled in.
   - A note with attention at 2 makes one admin Inbox item, and editing it doesn't make a second.
   - The class panel shows the 30-day averages.
   - Any notes saved before the change still show correctly after the carry-over.

Don't commit or push. I'll review first.
