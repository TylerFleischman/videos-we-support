#!/usr/bin/env python3
"""Check a creator page.json before it is built into a page.

    python3 ideation/check_page.py <page.json> --pool <video-pool.json> [--bank backend/sources.json]

Errors (exit 1) are things that must never ship; warnings are for the writer to look at.

Errors
  - a story whose anchor is not in the bank, or was cut by the curator
  - a story with no source link, or a TWEET as its source (the page links readers to the news version)
  - a number in the story text that the bank's checked `shows` sentence does not contain
  - a video that is not approved on the video master list (the pool), or whose details differ from it
  - a number in an idea that its story text does not contain (numbers are frozen, see brief.md)
  - an idea whose link is not its story's source link
  - an idea whose logline names the creator, or that uses a phrase brief.md bans
Warnings
  - an idea title over 70 characters, a logline outside 30 to 85 words, a sentence over 28 words
  - the same video used under more than one story
"""
import argparse, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# The generator's own bans (ANTI_SLOP and WORDING in backend/main.py), as patterns.
BANNED = [
    r"\bAI labs?\b", r"\bAI systems?\b", r"\bfrontier (AI|systems?|models?)\b", r"\blarge language models?\b",
    r"\bnot just\b", r"\bmore than just\b", r"\bnot \w+, but\b",
    r"\bdelves?\b", r"\bunderscor", r"\bshowcas", r"\btestament\b", r"\btapestry\b", r"\blandscape\b",
    r"\bcrucial\b", r"\bpivotal\b", r"\bgroundbreaking\b", r"\bprofound\b", r"\bseamless", r"\brobust\b",
    r"\bit'?s (important|worth) (to note|noting)\b", r"\bin today'?s world\b", r"\bin a world where\b",
    r"\blet that sink in\b", r"\bhere'?s the (thing|scary part|crazy part)\b", r"\bmake no mistake\b",
    r"\bexperts (say|argue|warn)\b", r"\bstudies (show|suggest)\b", r"\bmany believe\b",
    r"\byou (probably )?think\b", r"\bmost people (assume|think)\b",
    r"\bwalks? through\b", r"\bthink-piece\b", r"\bdeep dive\b",
]
NUM = re.compile(r"(?<![\w.])\$?\d[\d,]*(?:\.\d+)?%?")
WORD_NUMS = {"one": "1", "two": "2", "three": "3", "four": "4", "five": "5", "six": "6", "seven": "7",
             "eight": "8", "nine": "9", "ten": "10", "twelve": "12", "sixteen": "16", "hundred": "100"}


def nums(text):
    out = set()
    for m in NUM.findall(text):
        n = m.replace("$", "").replace(",", "").rstrip("%")
        if "." in n:
            n = n.rstrip("0").rstrip(".")
        if n:
            out.add(n)
    for w, d in WORD_NUMS.items():
        if re.search(rf"\b{w}\b", text, re.I):
            out.add(d)
    return out


def sentences(text):
    return [s for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("page")
    ap.add_argument("--pool", required=True)
    ap.add_argument("--bank", default=os.path.join(ROOT, "backend", "sources.json"))
    a = ap.parse_args()

    page = json.load(open(a.page, encoding="utf-8"))
    bank = {e["id"]: e for e in json.load(open(a.bank, encoding="utf-8"))}
    pool = {v["id"]: v for v in json.load(open(a.pool, encoding="utf-8"))["videos"]}
    creator = page["creator"]
    errors, warns, seen_videos = [], [], {}

    for c in page["categories"]:
        for s in c["stories"]:
            sid = s["anchor"]
            where = f"[{c['category']}] {sid}"
            e = bank.get(sid)
            if not e:
                errors.append(f"{where}: anchor not in the story bank")
                continue
            if e.get("cut"):
                errors.append(f"{where}: anchor was cut by the curator")
            src = s.get("source") or {}
            if not src.get("url"):
                errors.append(f"{where}: story has no source link")
            elif re.search(r"//(x|twitter)\.com/", src["url"]):
                errors.append(f"{where}: source is a post; link the news or official version")
            # Every number in the story must be in the checked sentence, or be its date.
            allowed = nums(e.get("shows", "")) | nums(e.get("date", "") or "") | nums(e.get("year", "") or "") | nums(src.get("date", "") or "")
            extra = nums(s["text"]) - allowed
            if extra:
                errors.append(f"{where}: story text has numbers the bank sentence does not: {sorted(extra)}")
            story_nums = nums(s["text"]) | allowed
            for v in s["videos"]:
                p = pool.get(v["id"])
                if not p:
                    errors.append(f"{where}: video {v['id']} ({v.get('title')}) is not in the approved video pool")
                else:
                    for k in ("title", "channel", "views", "date", "secs"):
                        if v.get(k) != p.get(k):
                            errors.append(f"{where}: video {v['id']} {k} is {v.get(k)!r}, pool says {p.get(k)!r}")
                seen_videos.setdefault(v["id"], []).append(sid)
                for i in v["ideas"]:
                    t, l = i["title"], i["logline"]
                    label = f"{where}: idea \"{t}\""
                    if i.get("link") != src.get("url"):
                        errors.append(f"{label}: link is not the story's source link")
                    extra = nums(t + " " + l) - story_nums
                    if extra:
                        errors.append(f"{label}: numbers not in its story: {sorted(extra)}")
                    # Titles may use the channel's own format ("The Dark Science of X"); loglines never name it.
                    if re.search(re.escape(creator), l, re.I):
                        errors.append(f"{label}: logline names the creator; talk about the world, not the channel")
                    for b in BANNED:
                        m = re.search(b, t + " " + l, re.I)
                        if m:
                            errors.append(f"{label}: banned phrase \"{m.group(0)}\"")
                    if len(t) > 70:
                        warns.append(f"{label}: title is {len(t)} characters")
                    w = len(l.split())
                    if not 30 <= w <= 85:
                        warns.append(f"{label}: logline is {w} words")
                    for sen in sentences(l):
                        if len(sen.split()) > 28:
                            warns.append(f"{label}: long sentence ({len(sen.split())} words): {sen[:60]}...")

    for vid, sids in seen_videos.items():
        if len(sids) > 1:
            warns.append(f"video {vid} is used under {len(sids)} stories: {', '.join(sids)}")

    n_st = sum(len(c["stories"]) for c in page["categories"])
    n_id = sum(len(v["ideas"]) for c in page["categories"] for s in c["stories"] for v in s["videos"])
    for w in warns:
        print("warn ", w)
    for e in errors:
        print("ERROR", e)
    print(f"{a.page}: {len(page['categories'])} categories, {n_st} stories, {n_id} ideas; {len(errors)} errors, {len(warns)} warnings")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
