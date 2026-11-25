#!/usr/bin/env python3
"""Shortlist story-bank stories for one channel.

    python3 ideation/shortlist.py <channel.json> [--bank backend/sources.json] [--out shortlist.md] [--top 60]

<channel.json> is the channel's lens (kept wherever that channel's page is kept, never in this repo):

    {"creator": "...", "handle": "@...",
     "lens": {"<keyword or regex>": <weight>, ...},     fit words, matched in the title and `shows`
     "cats": {"<bank cat>": <weight>, ...},             optional bonus per bank category
     "avoid": ["<regex>", ...],                         optional: never shortlist a story matching these
     "used": ["<anchor id>", ...]}                      optional: anchors already used on this page

A story is shortlisted when it fits the lens (fit > 0) and is not cut. It is ranked on
min(esc, grab), the same bar the idea generator draws on, plus its lens fit, plus a bonus for the
last 45 days (the generator's recency shelf). One story per `dgroup` (one real event), keeping the
best told version and preferring a news or official source over a tweet.
"""
import argparse, datetime as dt, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def is_tweet(e):
    return e.get("kind") == "tweet" or re.search(r"//(x|twitter)\.com/", e.get("url", "")) is not None


def story_date(e):
    d = e.get("date") or ""
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", d):
        return dt.date.fromisoformat(d)
    m = re.search(r"/(20\d\d)/(\d\d)/(\d\d)/", e.get("url", ""))
    return dt.date(int(m[1]), int(m[2]), int(m[3])) if m else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("channel")
    ap.add_argument("--bank", default=os.path.join(ROOT, "backend", "sources.json"))
    ap.add_argument("--out")
    ap.add_argument("--top", type=int, default=60)
    ap.add_argument("--today", default=dt.date.today().isoformat())
    a = ap.parse_args()

    ch = load(a.channel)
    lens = [(re.compile(k, re.I), float(w)) for k, w in ch["lens"].items()]
    cats = ch.get("cats", {})
    avoid = [re.compile(r, re.I) for r in ch.get("avoid", [])]
    used = set(ch.get("used", []))
    today = dt.date.fromisoformat(a.today)

    rows = []
    for e in load(a.bank):
        if e.get("cut"):
            continue
        text = f"{e.get('title', '')} {e.get('shows', '')}"
        if any(r.search(text) for r in avoid):
            continue
        fit = sum(w for r, w in lens if r.search(text)) + float(cats.get(e.get("cat"), 0))
        if fit <= 0:
            continue
        bar = min(e.get("esc", 0), e.get("grab", 0))
        d = story_date(e)
        recent = bool(d and (today - d).days <= 45)
        score = bar + min(fit, 4) + (2 if recent else 0) - (1 if is_tweet(e) else 0) - (1 if e.get("check") else 0)
        rows.append({"score": round(score, 1), "bar": bar, "fit": fit, "recent": recent, "tweet": is_tweet(e), "e": e})

    # One per real event: best score, news before tweet on ties.
    best = {}
    for r in sorted(rows, key=lambda r: (-r["score"], r["tweet"])):
        g = r["e"].get("dgroup", r["e"]["id"])
        best.setdefault(g, r)
    picks = sorted(best.values(), key=lambda r: -r["score"])[: a.top]

    out = [f"# Shortlist for {ch['creator']} ({ch['handle']})", "",
           f"{len(picks)} of {len(rows)} fitting stories, one per event. Bank: {os.path.relpath(a.bank, ROOT)}. "
           "Flags: NEW = last 45 days, TWEET = the bank's source is a post (find the news version before using it), "
           "CHECK = rests on a single unconfirmed post, USED = already on the page.", "",
           "| # | Score | esc | grab | Flags | Anchor | Shows |", "|---|---|---|---|---|---|---|"]
    for i, r in enumerate(picks, 1):
        e = r["e"]
        flags = " ".join(f for f, on in (("NEW", r["recent"]), ("TWEET", r["tweet"]), ("CHECK", e.get("check")), ("USED", e["id"] in used)) if on)
        shows = e.get("shows", "").replace("|", "/").replace("\n", " ")
        out.append(f"| {i} | {r['score']} | {e.get('esc')} | {e.get('grab')} | {flags} | `{e['id']}` | {shows} [{e.get('who', '')}]({e.get('url', '')}) |")
    text = "\n".join(out) + "\n"
    if a.out:
        with open(a.out, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"wrote {a.out}: {len(picks)} stories", file=sys.stderr)
    else:
        sys.stdout.write(text)


if __name__ == "__main__":
    main()
