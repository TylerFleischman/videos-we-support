# How the first ~1,500 stories were made (July-August 2026)

These are the original agent scripts, kept as a record. They ran in a workflow tool that fanned each step out
to many agents; paths to temporary files are shown as `<scratch>`. They are not meant to be run as-is: the
current, runnable process is in [`../pipeline`](../pipeline) and [`../README.md`](../README.md).

| Script | What it did |
|---|---|
| `species-source-bank.js` | First build: collected the sources Species videos had cited plus a research sweep, one sentence per source, live-checked links. |
| `source-bank-curation.js`, `weak-idea-sources.js`, `bank-sources-repair.js` | Matched sources to the idea bank, found readable sources for ideas that lacked them, repaired broken ones. |
| `tweet-source-hunt.js`, `tweet-gateway-sources.js` | Traced AI Safety Memes posts (mostly screenshots) back to the real article behind each one. |
| `fresh-source-sweep.js` | Swept for newer material (2025-2026) so the bank was not stuck on old examples. |
| `score-escalation.js` | Scored every story 1-10 on how far the AI went (the `esc` field). |
| `score-grab.js` | Scored the sentence 1-10 on whether a normal person would stop scrolling (the `grab` field). |
| `score-aism.js`, `score-aism-recent.js` | Scored and verified AI Safety Memes posts for the bank, including the August top-up. |
