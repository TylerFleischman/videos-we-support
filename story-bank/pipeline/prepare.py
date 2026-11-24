"""Make the batch files the screening, recheck, grouping and checking agents read.

    python3 story-bank/pipeline/prepare.py story-bank/runs/<date> screen      # after gather.py
    python3 story-bank/pipeline/prepare.py story-bank/runs/<date> recheck     # after the screen_*.json results
    python3 story-bank/pipeline/prepare.py story-bank/runs/<date> verify      # after recheck_cuts.json + clusters.json

Files go to <run>/work/batches/; agents write to <run>/work/results/ (see README.md for which brief each reads).
"""
import json, os, re, sys, glob
from collections import Counter

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if len(sys.argv) < 3:
    sys.exit(__doc__)
RUN, STEP = os.path.abspath(sys.argv[1]), sys.argv[2]
WORK = os.path.join(RUN, "work"); B = os.path.join(WORK, "batches"); RES = os.path.join(WORK, "results")
os.makedirs(B, exist_ok=True); os.makedirs(RES, exist_ok=True)
cand = {x["n"]: x for x in json.load(open(os.path.join(WORK, "candidates.json")))}
bank = json.load(open(os.path.join(REPO, "backend", "sources.json")))
FIELDS = ("n", "src", "date", "author", "text", "quote_author", "quote_text", "thread", "links", "heads",
          "likes", "views", "saved_by_owner", "url")
pick = lambda n, keys=FIELDS: {k: cand[n][k] for k in keys if k in cand[n]}


def screened():
    res = {}
    for p in sorted(glob.glob(os.path.join(RES, "screen_*.json"))):
        for r in json.load(open(p)):
            res[r["n"]] = r
    return {n: r for n, r in res.items() if n in cand and not cand[n].get("in_bank")}


if STEP == "screen":
    todo = [n for n in sorted(cand) if not cand[n].get("in_bank")]
    recent = sorted({"%s: %s" % (s.get("date"), s.get("title") or s["shows"][:90]) for s in bank
                     if not s.get("cut") and s.get("added")})
    size = 75
    for i in range(0, len(todo), size):
        json.dump({"already_in_bank_recent": recent,
                   "note": "If a candidate is the SAME event as one in already_in_bank_recent, cut it with cut_reason "
                           "'in-bank'. News headlines (src news-top) often repeat one story in several wordings; "
                           "screen each, the grouping step merges them.",
                   "candidates": [pick(n) for n in todo[i:i + size]]},
                  open(os.path.join(B, "screen_%d.json" % (i // size + 1)), "w"), ensure_ascii=False, indent=1)
    print("%d candidates in %d screening batches" % (len(todo), -(-len(todo) // size)))

elif STEP == "recheck":
    res = screened()
    missing = [n for n in cand if n not in res and not cand[n].get("in_bank")]
    if missing:
        sys.exit("not screened yet: %s" % missing[:10])
    keep = [r for r in res.values() if r.get("keep")]
    cut = [r for r in res.values() if not r.get("keep")]
    json.dump([dict(pick(r["n"]), first_cut_reason=r["cut_reason"]) for r in cut if r["cut_reason"] != "meme"],
              open(os.path.join(B, "recheck_cuts.json"), "w"), ensure_ascii=False, indent=1)
    b26 = [{"id": s["id"], "title": s.get("title", ""), "shows": s["shows"][:200], "date": s.get("date") or s.get("year")}
           for s in bank if int((re.search(r"20\d\d", str(s.get("year") or "")) or [0])[0]) >= 2026 and not s.get("cut")]
    json.dump({"bank_2026": b26, "keepers": [dict(n=r["n"], date=cand[r["n"]]["date"], src=cand[r["n"]]["src"],
                                                   **{k: r[k] for k in ("title", "shows", "event_key", "esc", "grab")})
                                              for r in keep]},
              open(os.path.join(B, "cluster_in.json"), "w"), ensure_ascii=False, indent=1)
    print("kept %d, cut %d %s; recheck batch %d" % (len(keep), len(cut), dict(Counter(r["cut_reason"] for r in cut)),
                                                    sum(1 for r in cut if r["cut_reason"] != "meme")))

elif STEP == "verify":
    res = screened()
    need = ("shows", "title", "cat", "esc", "grab")
    restored = [r for r in json.load(open(os.path.join(RES, "recheck_cuts.json")))
                if r.get("keep") and all(k in r for k in need)]          # only real restores, complete ones
    for r in restored:
        res[r["n"]] = r
    groups, placed = [], set()
    for g in json.load(open(os.path.join(RES, "clusters.json"))):
        mem = [n for n in [g["best"]] + g["others"] if n not in placed and n in res and res[n].get("keep")]
        placed.update([g["best"]] + g["others"])
        if mem and not g.get("in_bank"):   # an n listed twice counts once; an in-bank group is dropped whole
            groups.append({"best": mem[0], "others": mem[1:], "label": g.get("label")})
    # restored items the grouping agent never saw: join the group they share the most words with (Jaccard
    # >= 0.3 over event_key + title + sentence), else start a new group that later restores can join
    stop = set("the a an and or of to in on for with that this it is are was were be as at by from its into "
               "after over has have had says said new ai".split())
    sig = lambda n: {w for w in re.findall(r"[a-z0-9]{3,}", (res[n].get("event_key", "") + " " + res[n]["title"]
                                                             + " " + res[n]["shows"]).lower()) if w not in stop}
    for r in restored:
        if r["n"] in placed:
            continue
        s, best, bj = sig(r["n"]), None, 0.0
        for g in groups:
            for n in [g["best"]] + g["others"]:
                o = sig(n); j = len(s & o) / max(1, len(s | o))
                if j > bj:
                    bj, best = j, g
        if best is not None and bj >= 0.3:
            best["others"].append(r["n"])
        else:
            groups.append({"best": r["n"], "others": [], "label": r.get("event_key", "")})
        placed.add(r["n"])
    rank = lambda n: min(res[n]["esc"], res[n]["grab"])
    for g in groups:   # best = the strongest telling in the group
        mem = [g["best"]] + g["others"]
        g["best"] = max(mem, key=lambda n: (rank(n), res[n]["grab"], res[n]["esc"]))
        g["others"] = [n for n in mem if n != g["best"]]
    # the bar from the Oct 30 2026 run: rank >= 5, or a big event (esc >= 7) told badly enough to fix
    inc = [g for g in groups if rank(g["best"]) >= 5 or res[g["best"]]["esc"] >= 7]
    skipped = [g for g in groups if g not in inc]
    inc.sort(key=lambda g: (-rank(g["best"]), -res[g["best"]]["esc"]))
    keys = ("src", "date", "author", "text", "quote_author", "quote_text", "thread", "links", "heads", "url", "saved_by_owner")
    items = []
    for k, g in enumerate(inc, 1):
        b = res[g["best"]]
        items.append({"k": k, "shows": b["shows"], "title": b["title"], "cat": b["cat"], "kind": b.get("kind"),
                      "esc": b["esc"], "grab": b["grab"], "source_hint": b.get("source_hint", ""),
                      "candidate": pick(g["best"], keys),
                      "other_tellings": [pick(n, ("src", "author", "text", "quote_text", "links", "url", "heads"))
                                         for n in g["others"]][:4],
                      "best_n": g["best"], "member_ns": [g["best"]] + g["others"]})
    json.dump(items, open(os.path.join(WORK, "verify_items.json"), "w"), ensure_ascii=False, indent=1)
    json.dump([{"label": g.get("label"), "shows": res[g["best"]]["shows"], "esc": res[g["best"]]["esc"],
                "grab": res[g["best"]]["grab"]} for g in skipped],
              open(os.path.join(WORK, "below_bar.json"), "w"), ensure_ascii=False, indent=1)
    for p in glob.glob(os.path.join(B, "verify_*.json")):
        os.remove(p)
    size = 15
    for i in range(0, len(items), size):
        json.dump(items[i:i + size], open(os.path.join(B, "verify_%d.json" % (i // size + 1)), "w"),
                  ensure_ascii=False, indent=1)
    print("%d groups to check in %d batches; %d below the bar (work/below_bar.json)"
          % (len(items), -(-len(items) // size), len(skipped)))
else:
    sys.exit(__doc__)
