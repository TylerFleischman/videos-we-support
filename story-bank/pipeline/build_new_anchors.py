"""Turn checked stories into bank entries.

    python3 story-bank/pipeline/build_new_anchors.py story-bank/runs/<date>

Reads <run>/work/verify_items.json (what went to the checkers) and <run>/work/results/verify_*.json (their
verdicts), applies the hand decisions in <run>/manual_overrides.json, and writes <run>/work/new_anchors.json
in the bank's own shape. Dropped: verdict "false" or "dup", anything dropped by hand, anything with no link.
Stories the checkers could only confirm from a single first-hand post keep their hedge and get "check": true.
Nothing here touches the bank; add_to_bank.py does that.
"""
import json, os, re, glob, sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RUN = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else sys.exit(__doc__)
WORK = os.path.join(RUN, "work")
BANK = os.path.join(REPO, "backend", "sources.json")
ADDED = os.path.basename(RUN)                     # the run folder is named by its date
_op = os.path.join(RUN, "manual_overrides.json")
OVR = json.load(open(_op)) if os.path.exists(_op) else {}
DROP_K = {int(k) for k in OVR.get("drop", {})}
ESC_FIX = {int(k): v for k, v in OVR.get("esc", {}).items()}
TITLE_FIX = {int(k): v for k, v in OVR.get("title", {}).items()}   # titles that overstated a corrected fact

items = {x["k"]: x for x in json.load(open(os.path.join(WORK, "verify_items.json")))}
res = {}
for p in sorted(glob.glob(os.path.join(WORK, "results", "verify_*.json"))):
    for r in json.load(open(p)):
        res[r["k"]] = r
missing = sorted(set(items) - set(res))
if missing:
    sys.exit("no verdict yet for k=%s" % missing)

bank = json.load(open(BANK))
used_ids = {s["id"] for s in bank}
next_group = max(int(s.get("dgroup") or 0) for s in bank) + 1


def slug(t):
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")[:40].strip("-")


out, dropped = [], []
for k in sorted(items):
    it, r = items[k], res[k]
    v = r.get("verdict")
    if v in ("false", "dup") or k in DROP_K:
        dropped.append((k, OVR["drop"][str(k)] if k in DROP_K else v, it["title"]))
        continue
    shows = (r.get("shows") or it["shows"]).replace("—", ", ").replace("–", "-").strip()
    url = (r.get("url") or it["candidate"].get("url") or "").strip()
    if not url:
        dropped.append((k, "no link", it["title"])); continue
    date = r.get("date") or it["candidate"].get("date") or ""
    # a hand fix wins; then the checker's headline (written from the corrected sentence); then the screener's
    title = TITLE_FIX.get(k) or r.get("title") or it["title"]
    base = "%s-%s" % (it["cat"][:4], slug(title))
    sid, i = base, 2
    while sid in used_ids:
        sid = "%s-%d" % (base, i); i += 1
    used_ids.add(sid)
    a = {"id": sid, "title": title, "who": r.get("who") or "X post", "year": (date or ADDED)[:4],
         "url": url, "shows": shows, "cat": it["cat"], "kind": r.get("kind") or it.get("kind") or "tweet",
         "esc": int(ESC_FIX.get(k, it["esc"])), "grab": int(r.get("grab") or it["grab"]), "date": date,
         "dgroup": next_group, "added": ADDED}
    next_group += 1
    if v == "unconfirmed":
        a["check"] = True
    out.append(a)

json.dump(out, open(os.path.join(WORK, "new_anchors.json"), "w"), ensure_ascii=False, indent=1)
json.dump([{"k": k, "why": w, "title": t} for k, w, t in dropped],
          open(os.path.join(WORK, "dropped_at_check.json"), "w"), ensure_ascii=False, indent=1)
print("new anchors", len(out), "| dropped", len(dropped))
for d in dropped:
    print("  dropped k=%s (%s): %s" % d)
