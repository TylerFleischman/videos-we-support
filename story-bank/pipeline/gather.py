"""Stage 1 of a story-bank refresh: collect every candidate story since the bank's last update.

    python3 story-bank/pipeline/gather.py story-bank/runs/<date>

Reads <run>/run.json, whose inputs are all optional (use whichever you have):
  since         first day to include, YYYY-MM-DD (the day after the last refresh)
  x_archive     the data/ folder of an @AISafetyMemes X account archive (tweets.js, note-tweet.js)
  tweet_list    a JSON list of {"id": "<status id>", "time": "<ISO time>"} for posts and reposts,
                e.g. scraped from an X search such as `from:AISafetyMemes since:<date>`
  mymind_csv    a CSV of saved tweets (columns: saved, posted, author, likes, views, text,
                quoted_author, quoted_text, url); rows count as the curator's own picks
  news_history  front-page-history.json from the AI news page; its top-tier headlines are added

Each candidate gets its full text (long posts from note-tweet.js, retweeted and quoted originals via
api.fxtwitter.com, cached in <run>/work/fx/). Anything whose tweet or link is already in the bank is
flagged in_bank. Numbers (`n`) stay stable across reruns so screening results keep lining up.
Writes <run>/work/candidates.json.
"""
import json, os, re, sys, time, csv, html, datetime as dt, urllib.request, urllib.error
from urllib.parse import urlsplit

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RUN = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else sys.exit(__doc__)
CFG = json.load(open(os.path.join(RUN, "run.json")))
WORK = os.path.join(RUN, "work"); FX = os.path.join(WORK, "fx")
os.makedirs(FX, exist_ok=True)
SINCE = dt.datetime.fromisoformat(CFG["since"]).replace(tzinfo=dt.timezone.utc)
UA = {"User-Agent": "story-bank-refresh/1.0 (open-source research project)"}
def path(k):   # relative paths in run.json are relative to the repo root
    if not CFG.get(k):
        return None
    p = os.path.expanduser(CFG[k])
    return p if os.path.isabs(p) else os.path.join(REPO, p)


def load_js(p):
    t = open(p, encoding="utf-8").read()
    return json.loads(t[t.index("["):])


def when(s):
    return dt.datetime.strptime(s, "%a %b %d %H:%M:%S %z %Y")


def norm(u):
    u = (u or "").strip()
    if not u:
        return ""
    p = urlsplit(u.lower()); h = p.netloc.replace("www.", "").replace("mobile.", "")
    if h in ("twitter.com", "x.com", "fxtwitter.com", "vxtwitter.com"):
        m = re.search(r"/status/(\d+)", p.path)
        return "x:" + m.group(1) if m else h + p.path
    if h == "youtu.be":
        return "yt:" + p.path.strip("/")
    if "youtube.com" in h:
        m = re.search(r"v=([\w-]+)", p.query)
        if m:
            return "yt:" + m.group(1)
    return h + p.path.rstrip("/")


def fx(tid):
    """api.fxtwitter.com JSON for a status id, cached. 401/403/404 are final (private or gone)."""
    p = os.path.join(FX, tid + ".json")
    if os.path.exists(p):
        return json.load(open(p))
    j = {"code": None}
    for k in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(
                    "https://api.fxtwitter.com/status/" + tid, headers=UA), timeout=30) as r:
                j = json.loads(r.read()); break
        except urllib.error.HTTPError as e:
            if e.code in (401, 403, 404):
                j = {"code": e.code}; break
            time.sleep(5 * (k + 1))
        except Exception as e:
            print("fx retry", tid, repr(e)[:80], file=sys.stderr); time.sleep(3 * (k + 1))
    json.dump(j, open(p, "w"), ensure_ascii=False)
    time.sleep(0.4)
    return j


def fx_fields(j):
    t = (j or {}).get("tweet") or {}
    q = t.get("quote") or {}
    out = {"text": t.get("text") or "", "author": (t.get("author") or {}).get("screen_name") or "",
           "created": t.get("created_at") or "", "likes": t.get("likes"), "views": t.get("views"),
           "url": t.get("url") or ""}
    if q:
        out["quote_author"] = (q.get("author") or {}).get("screen_name") or ""
        out["quote_text"] = q.get("text") or ""
        out["quote_url"] = q.get("url") or ""
    return out


def from_fx(tid, src, date):
    """A candidate built from the fxtwitter copy of a post (used for retweets and scraped lists)."""
    f = fx_fields(fx(tid))
    if not (f["text"] or f.get("quote_text")):
        print("dropped %s: private or image only with no text" % tid, file=sys.stderr)
        return None
    c = {"src": src, "id": tid, "url": f["url"] or "https://x.com/i/status/" + tid, "author": f["author"],
         "date": date, "text": f["text"] or "[image only; see the quoted post]",
         "likes": f["likes"], "views": f["views"]}
    for k in ("quote_author", "quote_text", "quote_url"):
        if f.get(k):
            c[k] = f[k]
    return c


bank = json.load(open(os.path.join(REPO, "backend", "sources.json")))
have = {norm(s.get("url")) for s in bank} - {""}
cands, folded, thread_root_saved = [], {}, set()

# ---- lane 1: an X account archive ----
if path("x_archive"):
    tw = [x["tweet"] for x in load_js(os.path.join(path("x_archive"), "tweets.js"))]
    note_list = []
    np_ = os.path.join(path("x_archive"), "note-tweet.js")
    for n in (load_js(np_) if os.path.exists(np_) else []):
        nt = n["noteTweet"]
        note_list.append((dt.datetime.strptime(nt["createdAt"][:19], "%Y-%m-%dT%H:%M:%S")
                          .replace(tzinfo=dt.timezone.utc), nt["core"]["text"]))
    new = [x for x in tw if when(x["created_at"]) >= SINCE]
    by_id = {x["id_str"]: x for x in tw}
    me = (load_js(os.path.join(path("x_archive"), "account.js"))[0]["account"]["username"]
          if os.path.exists(os.path.join(path("x_archive"), "account.js")) else "AISafetyMemes")

    def _squash(s):
        return re.sub(r"\s+", " ", html.unescape(s or "")).strip()

    def full_text(x):
        """A long post is stored truncated in tweets.js and whole in note-tweet.js. The two timestamps can
        differ by a second, so match within 3 s AND on the opening words (two posts can share a second)."""
        t0 = when(x["created_at"])
        head = _squash(re.sub(r"…?\s*https://t\.co/\S+\s*$", "", x["full_text"]))[:60]
        for nt_when, text in note_list:
            if abs((nt_when - t0).total_seconds()) <= 3 and _squash(text).startswith(head):
                return text
        return x["full_text"]

    def links(x):
        return [u["expanded_url"] for u in (x.get("entities") or {}).get("urls") or [] if u.get("expanded_url")]

    thread = {}   # self-replies continue a thread: fold them into the root post
    for x in new:
        if x.get("in_reply_to_screen_name") == me and x.get("in_reply_to_status_id_str"):
            root = x["in_reply_to_status_id_str"]
            while root in by_id and by_id[root].get("in_reply_to_screen_name") == me \
                    and by_id[root].get("in_reply_to_status_id_str"):
                root = by_id[root]["in_reply_to_status_id_str"]
            thread.setdefault(root, []).append(x)
    folded = {r["id_str"]: root for root, rs in thread.items() for r in rs}

    for x in new:
        t, tid = x["full_text"], x["id_str"]
        if x.get("in_reply_to_status_id_str"):
            continue
        if t.startswith("RT @"):
            if t.lower().startswith("rt @" + me.lower()):
                continue
            c = from_fx(tid, "aism-retweet", when(x["created_at"]).date().isoformat())
            if c:
                cands.append(c)
            continue
        c = {"src": "aism-post", "id": tid, "url": "https://x.com/%s/status/%s" % (me, tid), "author": me,
             "date": when(x["created_at"]).date().isoformat(), "text": full_text(x),
             "likes": int(x.get("favorite_count") or 0), "links": [u for u in links(x) if norm(u) != "x:" + tid]}
        if any(norm(u).startswith("x:") for u in c["links"]):
            f = fx_fields(fx(tid))
            for k in ("quote_author", "quote_text", "quote_url"):
                if f.get(k):
                    c[k] = f[k]
        more = sorted(thread.get(tid, []), key=lambda r: when(r["created_at"]))
        if more:
            c["thread"] = [full_text(r) for r in more][:6]
            c["links"] += [u for r in more for u in links(r)]
        cands.append(c)

# ---- lane 2: a scraped list of posts and reposts (no archive needed) ----
if path("tweet_list"):
    for x in json.load(open(path("tweet_list"))):
        d = dt.datetime.fromisoformat(x["time"].replace("Z", "+00:00"))
        if d.tzinfo is None:
            d = d.replace(tzinfo=dt.timezone.utc)
        if d >= SINCE:
            c = from_fx(str(x["id"]), "aism-list", d.date().isoformat())
            if c:
                cands.append(c)

# ---- lane 3: the curator's own saves ----
if path("mymind_csv"):
    for r in csv.DictReader(open(path("mymind_csv"), encoding="utf-8")):
        m = re.search(r"/status/(\d+)", r.get("url") or "")
        if not m:
            continue
        try:
            d = when(r["posted"])
        except Exception:   # blank date: a tweet id encodes its own timestamp
            d = dt.datetime.fromtimestamp(((int(m.group(1)) >> 22) + 1288834974657) / 1000, dt.timezone.utc)
        if d < SINCE:
            continue
        if m.group(1) in folded:
            thread_root_saved.add(folded[m.group(1)]); continue
        c = {"src": "mymind-save", "id": m.group(1), "url": r["url"], "author": r.get("author") or "",
             "date": d.date().isoformat(), "text": r.get("text") or "", "likes": r.get("likes"), "views": r.get("views")}
        if r.get("quoted_text"):
            c["quote_author"] = r.get("quoted_author") or ""; c["quote_text"] = r["quoted_text"]
        cands.append(c)

# ---- lane 4: the AI news page's top-tier stories (headlines only; the verify stage finds the article) ----
if path("news_history"):
    seen_t = set()
    for run_ in json.load(open(path("news_history")))["runs"]:
        day = dt.datetime.fromtimestamp(run_["at"] / 1000, dt.timezone.utc)
        if day < SINCE:
            continue
        for s in run_["stories"]:
            if s.get("tier") == "top" and s["title"] not in seen_t:
                seen_t.add(s["title"])
                cands.append({"src": "news-top", "id": "news-%s-%d" % (day.date().isoformat(), len(seen_t)),
                              "url": "", "author": "", "date": day.date().isoformat(), "text": s["title"],
                              "heads": (s.get("heads") or [])[:4]})

# ---- flag what the bank already holds; merge repeats across lanes ----
out, seen = [], {}
for c in cands:
    keys = {norm(c["url"])} | ({"x:" + c["id"]} if c["id"].isdigit() else set())
    if c.get("quote_url"):
        keys.add(norm(c["quote_url"]))
    if keys & have:
        c["in_bank"] = True
    k = norm(c["url"]) or c["id"]
    if c["id"].isdigit() and "x:" + c["id"] in seen:
        k = "x:" + c["id"]
    if k in seen:
        if c["src"] == "mymind-save":
            seen[k]["saved_by_owner"] = True   # the curator saved it: the strongest taste signal we have
        continue
    seen[k] = c
    if c["id"].isdigit():
        seen["x:" + c["id"]] = c
    out.append(c)
for c in out:
    if c["id"] in thread_root_saved:
        c["saved_by_owner"] = True
prev_path = os.path.join(WORK, "candidates.json")
prev = {(p.get("url") or p["id"]): p["n"] for p in json.load(open(prev_path))} if os.path.exists(prev_path) else {}
nxt = max(prev.values(), default=0)
for c in out:
    k = c["url"] or c["id"]
    if k in prev:
        c["n"] = prev[k]
    else:
        nxt += 1; c["n"] = nxt
json.dump(out, open(prev_path, "w"), ensure_ascii=False, indent=1)
from collections import Counter
print("candidates", len(out), dict(Counter(c["src"] for c in out)), "already in bank:", sum(1 for c in out if c.get("in_bank")))
