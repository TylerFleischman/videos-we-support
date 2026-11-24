"""Checks on a run's candidates.json (run after gather.py).

    python3 story-bank/pipeline/test_gather.py story-bank/runs/<date>

Guards the defects QA found in the Oct 30 2026 run: long posts cut to the ~280-character stub, image-only
reposts dropped silently, duplicate items, and anything older than the run's start date.
"""
import json, os, re, sys

RUN = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else sys.exit(__doc__)
since = json.load(open(os.path.join(RUN, "run.json")))["since"]
c = json.load(open(os.path.join(RUN, "work", "candidates.json")))
by_id = {x["id"]: x for x in c}
fail = []
# a long post kept as its truncated stub ends in an ellipsis plus a t.co link
stubs = [x["id"] for x in c if x["src"] == "aism-post" and re.search(r"…\s*https://t\.co/\S+\s*$", x["text"])]
if stubs:
    fail.append("%d long posts truncated, e.g. %s" % (len(stubs), stubs[:3]))
if any(not (x.get("text") or "").strip() for x in c):
    fail.append("a candidate has no text")
old = [x["id"] for x in c if x["date"] < since]
if old:
    fail.append("%d candidates before %s" % (len(old), since))
ids = [x["id"] for x in c]
if len(ids) != len(set(ids)) or len({x["n"] for x in c}) != len(c):
    fail.append("duplicate id or n")
# the Oct 30 2026 regressions, checked whenever those posts are in range
for tid in ("2093186094120783914", "2096785004101832845", "2096090691541545235"):
    if tid in by_id and len(by_id[tid]["text"]) < 400:
        fail.append("long post %s truncated" % tid)
if "2104746236465287306" in by_id and "stopped cheating" not in (by_id["2104746236465287306"].get("quote_text") or ""):
    fail.append("image-only repost 2104746236465287306 lost its quote")
print("FAIL: " + "; ".join(fail) if fail else "ok: %d candidates, checks pass" % len(c))
sys.exit(1 if fail else 0)
