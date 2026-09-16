# Screenshots for the demo page

Drop the five files below into this folder, named exactly as listed. The page picks
them up automatically; any that are missing render as a dashed "Screenshot pending"
frame instead of a broken image, so the page stays presentable while you work.

| File | What to capture |
|---|---|
| `grid.mp4` | **Clip.** The planner scrolling across the week, all three rooms, with bookings seeded |
| `booking.mp4` | **Clip.** Dragging across a free slot, naming the meeting, and the block appearing |
| `recommendations.png` | "Recommended rooms for my meetings" — **with a room picked in the dropdown**, not left on "Choose room" |
| `slack.png` | The Slack DM confirming a booking |
| `dashboard.png` | The live availability dashboard (`?page=dashboard`) |

## The two clips

Motion earns its place on these two: the week is a continuous horizontal scroll, and
booking is a drag. Neither reads from a still frame.

Keep them **4–8 seconds**, one gesture each, no cursor hunting. They autoplay muted on
a loop, so they need no beginning or end — just the movement.

**Record** with QuickTime (File → New Screen Recording), then convert:

```bash
ffmpeg -i raw.mov -vf "scale=1440:-2" -c:v libx264 -crf 28 -preset slow \
       -movflags +faststart -an -pix_fmt yuv420p grid.mp4
```

`-an` strips audio, `+faststart` lets playback begin before the file finishes loading.
Aim for **under 2 MB**; raise `-crf` to 30 if it comes out heavier.

> **Not GIF.** The same clip as a GIF runs 10–20x larger and looks worse. If you would
> rather use a still for either slot, say so and the markup swaps back to an image.

## How to capture them

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
