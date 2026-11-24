"""Master list of every approved story in the Videos We Support tool.

    python3 story-bank/pipeline/build_master.py [out.csv]      (default story-bank/master-list.csv)


Approved = in the idea generator's anchor bank (backend/sources.json) and not cut by Drew in anchors.html
(his votes are baked into the bank as `cut`), plus the leads library (frontend/leads_ranked.json) minus any
link Drew cut. One row per bank story (several stories can share one report's link), then one row per
leads-only link. Bank stories first, best-first as anchors.html ranks them; leads-only after, in Elo order.
"""
import json, csv, re, os, sys
from collections import Counter
from urllib.parse import urlsplit

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.expanduser(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(REPO, "story-bank", "master-list.csv")
BATCH = {"harvest2", "fresh", "expand", "meme", "other", ""}

def norm(u):
    u = (u or "").strip()
    if not u: return ""
    p = urlsplit(u.lower()); h = p.netloc.replace("www.", "").replace("mobile.", "")
    if h in ("twitter.com", "x.com"):
        m = re.search(r"/status/(\d+)", p.path); return "x:" + m.group(1) if m else h + p.path
    if h == "youtu.be": return "yt:" + p.path.strip("/")
    if "youtube.com" in h:
        m = re.search(r"v=([\w-]+)", p.query)
        if m: return "yt:" + m.group(1)
    return h + p.path.rstrip("/")

bank = json.load(open(f"{REPO}/backend/sources.json"))
leads = json.load(open(f"{REPO}/frontend/leads_ranked.json"))
cut_ids = {s["id"] for s in bank if s.get("cut")}
cut_urls = {norm(s["url"]) for s in bank if s.get("id") in cut_ids}

def bank_rank(s):  # same formula as tools/build_anchor_page.py
    e = s["esc"] if isinstance(s.get("esc"), int) else 5
    g = s["grab"] if isinstance(s.get("grab"), int) else None
    return min(e, g if g is not None else min(e, 6)) + (s.get("bump") or 0), (g or 0)

lead_rank = {}
for i, x in enumerate(leads, 1):
    k = norm(x.get("url"))
    if k and k not in lead_rank: lead_rank[k] = (i, x)

rows, seen = [], set()
for s in sorted((s for s in bank if s.get("id") not in cut_ids), key=lambda s: tuple(-v for v in bank_rank(s))):
    k = norm(s["url"])
    if not k or (k, s.get("shows")) in seen or k in cut_urls: continue  # repeat, or a copy of a story Drew cut
    seen.add((k, s.get("shows"))); seen.add(k)
    lr = lead_rank.get(k)
    rows.append({"score": bank_rank(s)[0], "lrank": lr[0] if lr else "", "title": s.get("title", ""),
                 "shows": s.get("shows", ""), "who": s.get("who", ""), "year": s.get("year", ""),
                 "url": s["url"], "topic": s.get("cat", ""), "kind": s.get("kind", ""),
                 "where": "Both" if lr else "Idea generator", "date": s.get("date", ""),
                 "new": s.get("added", ""),
                 "tweet": "single source, check" if s.get("check") else
                          ("yes" if s.get("kind") == "tweet" or k.startswith("x:") else "")})
for k, (i, x) in sorted(lead_rank.items(), key=lambda kv: kv[1][0]):
    if k in seen or k in cut_urls: continue
    seen.add(k)
    rows.append({"score": "", "lrank": i, "title": "", "shows": x["l"], "who": x.get("who", ""),
                 "year": x.get("y", ""), "url": x["url"], "topic": "" if x.get("cat") in BATCH else x["cat"],
                 "kind": "tweet" if x.get("x") or k.startswith("x:") else "",
                 "where": "Leads library", "date": "", "new": "", "tweet": "yes" if x.get("x") or k.startswith("x:") else ""})

with open(OUT, "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f)
    w.writerow(["#", "Score (higher = better)", "Leads rank (1 = best)", "Headline", "What it shows",
                "Source", "Year", "Date", "Link", "Topic", "Type", "Where it's used", "Added in refresh",
                "From a tweet (check before citing)"])
    for n, r in enumerate(rows, 1):
        w.writerow([n, r["score"], r["lrank"], r["title"], r["shows"], r["who"], r["year"], r["date"], r["url"],
                    r["topic"].replace("-", " "), r["kind"].replace("-", " "), r["where"], r["new"], r["tweet"]])
print("rows", len(rows), "| cut ids", len(cut_ids), "| bank kept", sum(r["where"] != "Leads library" for r in rows),
      "| both", sum(r["where"] == "Both" for r in rows), "| leads-only", sum(r["where"] == "Leads library" for r in rows),
      "| tweets", sum(bool(r["tweet"]) for r in rows), "| from refreshes", dict(Counter(r["new"] for r in rows if r["new"])))
