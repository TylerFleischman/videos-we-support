# Ideation: from the story bank to a creator page

This folder is how a channel gets a page of video ideas built on the story bank. It joins the two halves
of the work:

- **This repo** has the process and the material: the story bank (`backend/sources.json`, see
  [`../story-bank/`](../story-bank/README.md)), the generator's writing rules (`backend/main.py`), and the
  scripts here.
- **The CAIS ideation demo repo** (`cais-ideation-demo`) is the presentation: one static page per creator,
  built from a `page.json` with `tools/build-creator-page.js`, plus the pool of approved example videos.

```
channel.json ──► shortlist.py ──► shortlist.md ──► (write ideas, brief.md) ──► page.json
                     ▲                                       ▲                    │
           backend/sources.json                    video-pool.json          check_page.py
                                                (demo: tools/video-pool.js)       │
                                                                                   ▼
                                                     demo: tools/build-creator-page.js ──► <slug>-<token>.html
```

**Keep every channel's files in the demo repo, never here.** This repo is public, and which channels are
being pitched, and what was written for them, must not be (see `.gitignore`). Only the channel-neutral
process lives in this folder.

## Steps

Paths below assume the two repos sit side by side; `DEMO` is the demo repo.

1. **Profile the channel.** Make `DEMO/ideation/<slug>/channel.json`: who the channel is, its audience,
   its format and a dozen real titles, then the *lens*: weighted keywords for the stories that fit it,
   bank categories to favour, and patterns to avoid. Base it on recent transcripts where you can get them
   (the backend's `_build_profile` and `_build_voice` do this for the live app); at minimum, on the real
   video list. The format is in the docstring of `shortlist.py`.
2. **Refresh the video pool.** `node DEMO/tools/video-pool.js` writes `DEMO/ideation/video-pool.json`:
   the approved videos on the video master list (`DEMO/ideation/videos.json`), each with the pages it is
   already on.
3. **Shortlist stories.**
   `python3 ideation/shortlist.py DEMO/ideation/<slug>/channel.json --out DEMO/ideation/<slug>/shortlist.md`
   ranks every uncut bank story that fits the lens, one per real event, on the generator's own bar
   (the lower of `esc` and `grab`), plus lens fit and a bonus for the last 45 days. Read it and pick about
   10 to 18 stories in 3 to 5 groups that would make sense to the creator. Skip anything flagged CHECK;
   for a TWEET, use the news or official version of the event.
4. **Write the ideas** into `DEMO/ideation/<slug>/page.json`, following [`brief.md`](brief.md). Shape:
   `{creator, handle, pulled, categories: [{category, stories: [{anchor, text, source, videos: [{id,
   title, channel, views, secs, date, funded, ideas: [{title, logline, link}]}]}]}]}`. `source` is
   `{url, publisher, headline, date, icon, tier: "card", image?}`; `pulled` is the video list's `pulled`
   date. Copy each video's fields from the pool exactly.
5. **Check it.**
   `python3 ideation/check_page.py DEMO/ideation/<slug>/page.json --pool DEMO/ideation/video-pool.json`
   must report 0 errors. Then a person reads every idea against rules 2, 3, 5 and 8 of the brief.
6. **Build the page.** In the demo repo, `node tools/build-creator-page.js ideation/<slug>/page.json <slug>`,
   then add the creator's card to `index.html`. Rebuilding keeps the page's link. Rebuild the team's
   Story and Video Bank too (`node tools/build-bank-page.js`), so it shows the new page's stories as used.

## When the bank changes

Rerun step 3 after a story-bank refresh: a story the curator cuts drops out of the shortlist, and
`check_page.py` fails any page still using it, so rebuild that page without it.
