# Screenshots for the demo page

Drop the five files below into this folder, named exactly as listed. The page picks
them up automatically; any that are missing render as a dashed "Screenshot pending"
frame instead of a broken image, so the page stays presentable while you work.

| File | What to capture |
|---|---|
| `grid.png` | The weekly planner, full week, all three rooms, with bookings seeded |
| `booking.png` | Mid-booking: a time range selected and the confirmation panel open |
| `recommendations.png` | "Recommended rooms for my meetings", showing a meeting with no room and the free rooms |
| `slack.png` | The Slack DM confirming a booking |
| `dashboard.png` | The live availability dashboard (`?page=dashboard`) |

## How to capture them

**Hide the browser chrome first.** Chrome → ⋮ → Cast, save and share → Create shortcut
→ tick "Open as window". No address bar, no tabs, no bookmarks — it reads as an
application rather than a web page, and the Apps Script URL never appears.

- Shoot at **1440px wide or more**, on a Retina display if you have one. Wide shots get
  scaled down on the page, so more pixels means sharper.
- macOS: `⌘ + Shift + 4`, then `Space` to capture a whole window with its shadow.
- Seed believable data first. A near-empty grid looks broken even when it works.
- Check nothing private is on screen — the recommendations section reads your personal
  calendar and shows real meeting titles.

Keep each file under ~500 KB. PNG for interface shots; run them through an optimiser
such as ImageOptim or Squoosh if they come out large.
