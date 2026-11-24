"""Write <run>/REPORT.md: what a refresh looked at, what it added, and what it dropped and why.

    python3 story-bank/pipeline/report.py story-bank/runs/<date>

Reads the run's work files (candidates, screening results, groups, checker verdicts, hand decisions) and the
bank itself, so the report always matches what was actually added.
"""
import json, os, glob, sys
from collections import Counter

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RUN = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else sys.exit(__doc__)
WORK = os.path.join(RUN, "work"); DATE = os.path.basename(RUN)
cfg = json.load(open(os.path.join(RUN, "run.json")))
J = lambda *p: json.load(open(os.path.join(WORK, *p)))
cand = J("candidates.json")
screen = {}
for p in sorted(glob.glob(os.path.join(WORK, "results", "screen_*.json"))):
    for r in json.load(open(p)):
        screen[r["n"]] = r
screen = {n: r for n, r in screen.items() if n in {c["n"] for c in cand}}   # results for items a rerun removed
restored = {r["n"]: r for r in (J("results", "recheck_cuts.json") if os.path.exists(os.path.join(WORK, "results", "recheck_cuts.json")) else [])}
items = {x["k"]: x for x in J("verify_items.json")}
verdict = {}
for p in sorted(glob.glob(os.path.join(WORK, "results", "verify_*.json"))):
    for r in json.load(open(p)):
        verdict[r["k"]] = r
dropped = J("dropped_at_check.json") if os.path.exists(os.path.join(WORK, "dropped_at_check.json")) else []
bank = json.load(open(os.path.join(REPO, "backend", "sources.json")))
added = [s for s in bank if s.get("added") == DATE]
note_by_url_shows = {}
for k, r in verdict.items():
    note_by_url_shows[(r.get("url"), r.get("shows"))] = r.get("note", "")

cuts = Counter(r.get("cut_reason") for n, r in screen.items() if not r.get("keep") and n not in restored)
kept = sum(1 for r in screen.values() if r.get("keep")) + len(restored)
L = []
w = L.append
w("# Story-bank refresh %s" % DATE)
w("")
w("Stories dated %s onward. Process: [story-bank/README.md](../../README.md); rules: "
  "[screen_brief.md](../../pipeline/screen_brief.md), [verify_brief.md](../../pipeline/verify_brief.md)." % cfg["since"])
w("")
w("## Funnel")
w("")
w("| Step | Count |")
w("|---|---|")
w("| Candidates collected | %d (%s) |" % (len(cand), ", ".join("%s %d" % kv for kv in Counter(c["src"] for c in cand).most_common())))
w("| Already in the bank | %d |" % sum(1 for c in cand if c.get("in_bank")))
w("| Screened | %d |" % len(screen))
w("| Kept at screening | %d (incl. %d restored on recheck) |" % (kept, len(restored)))
w("| Cut at screening | %d (%s) |" % (sum(cuts.values()), ", ".join("%s %d" % kv for kv in cuts.most_common())))
w("| Distinct events sent to checking | %d |" % len(items))
w("| Checker verdicts | %s |" % ", ".join("%s %d" % kv for kv in Counter(r.get("verdict") for r in verdict.values()).most_common()))
w("| Dropped after checking | %d |" % len(dropped))
w("| **Added to the bank** | **%d** (%d marked check: single first-hand source) |" % (len(added), sum(1 for a in added if a.get("check"))))
w("")
w("Nothing is deleted: everything not added is listed below or in [SCREENED_OUT.md](SCREENED_OUT.md) with its reason.")
w("")
w("## Added")
w("")
w("Escalation / telling scores, then the checked sentence and the link. `check` = single first-hand source.")
w("")
for a in sorted(added, key=lambda a: (-min(a["esc"], a["grab"]), -a["esc"])):
    w("- **%s** (%d/%d%s) %s [%s](%s)" % (a["title"], a["esc"], a["grab"], ", check" if a.get("check") else "",
                                        a["shows"], a["who"], a["url"]))
    n = note_by_url_shows.get((a["url"], a["shows"]))
    if n:
        w("  - Checked: %s" % n)
w("")
w("## Dropped after checking")
w("")
for d in dropped:
    w("- %s: %s" % (d["title"], d["why"]))
w("")
w("## Cut at screening")
w("")
w("Counts by reason are in the funnel above. Reasons: `meme` (a joke with no checkable fact), `opinion` (a take "
  "with no event behind it), `off-topic`, `mundane` (scams, AI mistakes, energy, privacy gripes, product news), "
  "`ai-looks-dumb`, `race-frame`, `too-thin`, `in-bank` (same event already in the bank). Every cut except plain "
  "memes was rechecked by a second agent told to restore anything real.")
below = J("below_bar.json") if os.path.exists(os.path.join(WORK, "below_bar.json")) else []
if below:
    w("")
    w("## Kept but not checked (below the bar)")
    w("")
    w("Real stories that ranked below 5 on the lower of escalation and telling (and below 7 on escalation). "
      "They were not checked or added this run; a later run can pick them up.")
    w("")
    for g in sorted(below, key=lambda g: (-min(g["esc"], g["grab"]), -g["esc"])):
        w("- (%d/%d) %s" % (g["esc"], g["grab"], g["shows"]))
open(os.path.join(RUN, "REPORT.md"), "w").write("\n".join(L) + "\n")
# every screening cut, with its reason and link, so nothing leaves quietly
S = ["# Screened out, %s" % DATE, "",
     "Every candidate cut at screening and not restored on recheck, with the screener's reason. "
     "Reasons are defined in [screen_brief.md](../../pipeline/screen_brief.md).", ""]
by_reason = {}
for n, r in screen.items():
    if not r.get("keep") and n not in restored:
        by_reason.setdefault(r.get("cut_reason") or "?", []).append(n)
c_by_n = {c["n"]: c for c in cand}
# accounts that must never be named in this public repo: one handle per line in the gitignored
# story-bank/.private_handles (their posts are still screened, just not listed)
_ph = os.path.join(REPO, "story-bank", ".private_handles")
private = {l.strip().lower().lstrip("@") for l in open(_ph)} - {""} if os.path.exists(_ph) else set()
is_private = lambda c: any(h and (h == (c.get("author") or "").lower() or "/%s/" % h in (c.get("url") or "").lower()
                                  or "@" + h in (c.get("text") or "").lower()) for h in private)
hidden = 0
for reason, ns in sorted(by_reason.items(), key=lambda kv: -len(kv[1])):
    S.append("## %s (%d)" % (reason, len(ns))); S.append("")
    for n in sorted(ns):
        c = c_by_n[n]
        if is_private(c):
            hidden += 1; continue
        txt = " ".join((c.get("text") or "").split())[:160].replace("|", "/")
        S.append("- %s%s" % (txt, " [link](%s)" % c["url"] if c.get("url") else ""))
    S.append("")
if hidden:
    S.append("(%d posts from private accounts are not listed.)" % hidden)
open(os.path.join(RUN, "SCREENED_OUT.md"), "w").write("\n".join(S) + "\n")
print("wrote %s: %d added, %d dropped at check" % (os.path.join(RUN, "REPORT.md"), len(added), len(dropped)))
