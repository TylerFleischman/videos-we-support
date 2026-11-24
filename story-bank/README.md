# Story bank

The idea generator at videos-we-support.web.app builds every video pitch on real, documented events. Those
events are the **story bank** (the code calls them "anchors"): [`backend/sources.json`](../backend/sources.json),
one entry per story. This folder is how stories get into it.

## What an entry is

```json
{"id": "inci-mythos-5-tried-to-slip-malware-into-developers",
 "title": "Mythos 5 tried to slip malware into developers' code",
 "shows": "Anthropic says Claude Mythos 5 tried to sneak malicious code into a GitHub project run by real developers during a UK AISI cyber test.",
 "who": "Anthropic", "url": "https://www.anthropic.com/research/alignment-assessment-ukaisi",
 "kind": "official-report", "cat": "incidents", "date": "2026-10-23", "year": "2026",
 "esc": 9, "grab": 9, "dgroup": 1644, "added": "2026-10-30"}
```

- `shows` is the checked sentence the generator reads. Every specific in it (who, numbers, quotes) must be in the source at `url`.
- `esc` (1-10) is how far the AI went: breaking out into someone else's systems or the internet, or blackmail and sabotage to survive, score highest; benchmark numbers score lowest. If the model did not know it was a test, it counts as real. Deduct only when the model was told or trained to misbehave.
- `grab` (1-10) is whether a normal person would stop scrolling at the `shows` sentence. It ignores how important the event is.
- The generator ranks on the lower of the two, so a huge event told badly sits low. Stories dated in the last 45 days get reserved slots (`anchor_block` in `backend/main.py`).
- `cut: true` means the curator removed it on [anchors.html](https://videos-we-support.web.app/anchors.html). Nothing is ever deleted from the file; cut stories just stop being drawn.
- `check: true` means the story rests on a single first-hand post that nobody else confirmed. Treat it with care.

## How stories are chosen

The rules live in two briefs that every screening and checking agent reads:

- [`pipeline/screen_brief.md`](pipeline/screen_brief.md): keep or cut, then write the sentence and score it.
  Keep a concrete, real event that people who work on AI risk would say the public needs to know. Cut jokes,
  opinions with no event behind them, scams and AI mistakes, energy and privacy gripes, product news, anything
  that makes AI look dumb or overhyped, and anything framed as a race to win.
- [`pipeline/verify_brief.md`](pipeline/verify_brief.md): check every specific against the raw source text (never a
  summarizer, they invent quotes), fix the sentence, find the most readable link, and write a headline that keeps
  the sentence's attribution, hedges, scope and numbers.

Each refresh leaves a folder in `runs/` with its settings, its hand decisions and a `REPORT.md` listing what was
added, what was dropped and why.

## Running a refresh

Needs Python 3 and Claude (Claude Code) for the judging steps. Steps 2-5 are done by agents following the briefs;
each reads a batch file and writes a results file, so they can be run by any agent setup.

1. **Make a run folder** `runs/<today>/run.json`:
   ```json
   {"since": "2026-10-30",
    "x_archive": null,
    "tweet_list": "story-bank/runs/<today>/work/x_ids.json",
    "mymind_csv": null,
    "news_history": null}
   ```
   `since` is the day after the last run. The inputs are optional: an @AISafetyMemes X archive (`data/` folder),
   a list of post ids scraped from X (`[{"id": "...", "time": "..."}]`), a CSV of the curator's saved tweets, or
   the AI news page's history file.
2. **Collect:** `python3 story-bank/pipeline/gather.py story-bank/runs/<today>` writes `work/candidates.json`
   with the full text of every post, retweet and quoted post. `python3 story-bank/pipeline/test_gather.py <run>`
   checks it.
3. **Screen:** `prepare.py <run> screen` splits the candidates into `work/batches/screen_N.json` (about 75
   each); give each to an agent with `screen_brief.md`, writing `work/results/screen_N.json`.
   `prepare.py <run> recheck` then writes `batches/recheck_cuts.json` (every cut except plain memes) and
   `batches/cluster_in.json` (every keeper). One agent restores anything real from the cuts (default keep) into
   `results/recheck_cuts.json`, listing only restored items with the same fields as a screening keep; another
   groups the keepers by event into `results/clusters.json` (`{"best": n, "others": [...], "in_bank": null}`).
4. **Check:** `prepare.py <run> verify` picks each group's best-told version, keeps groups ranked 5+ (or
   escalation 7+), and writes `batches/verify_N.json` (15 each); give each to an agent with `verify_brief.md`,
   writing `results/verify_N.json`. Groups below the bar go to `work/below_bar.json`. Read the checkers' notes and
   put hand decisions (drop, escalation fix, headline fix) in `runs/<today>/manual_overrides.json`, keyed by `k`.
5. **Headline check:** have a fresh agent read every new title next to its `shows` and flag any that claim more.
6. **Build and add:** `build_new_anchors.py <run>` then `add_to_bank.py <run>` (safe to rerun; it never
   duplicates or deletes). `python3 backend/test_anchors.py` must pass.
7. **Report and list:** `report.py <run>` writes `REPORT.md`; `build_master.py` writes `master-list.csv`, every
   approved story with its link.
8. **Deploy:** `./deploy.sh --backend` from the repo root. It first copies the curator's live cuts and moves into
   the bank, so nothing on the server is lost.

## The curator's cuts and moves

anchors.html sends every cut or move to the backend, which applies it at once and keeps it on the server's disk.
`tools/apply_anchor_votes.py` (run by `deploy.sh`) copies them into `sources.json` and
`tools/votes/anchor_votes.jsonl`, so the repo always matches what is live.

## History

`history/` holds the original July-August 2026 agent scripts that built and scored the first ~1,500 entries
(source sweeps, the AI Safety Memes mining, the escalation and telling scores). They ran in a workflow tool and
are kept as a record of how the bank was made, not to be run as-is.
