# Story-bank refresh: verify one batch of new anchors

These are candidate "anchors" (one real AI event each) for a tool that pitches AI-risk video ideas to YouTube creators. Creators will build videos on them, so a wrong fact burns all trust. Each item has the candidate's raw text (`text`, maybe `quote_text`, `thread`, `heads`), the sentence we plan to store (`shows`), and links. Your job: make sure every stored sentence is TRUE and SUPPORTED, and give each one the best link.

Read your batch file (path in your task). Write your results file (path in your task) as a JSON array, one object per item, with `"k"` copied. Return only a 1-line summary (counts). Never paste results in the reply.

## For each item

1. **Faithful to the candidate?** Every specific in `shows` (company, model, number, date, mechanism, quote) must appear in the candidate's own text. If `shows` adds anything, rewrite it to drop the addition. Keep hedges ("reportedly") that the source has.
2. **True in the world?** Find the primary or a reputable report of the event:
   - Use the candidate's own links first (`links`, `source_hint`, `quote_url`).
   - Otherwise web search the specifics (WebSearch, mode "standard"; at most 3 searches per item).
   - Confirm by reading the RAW page text: fetch with `curl -sL -A 'Mozilla/5.0' URL | python3 -c "import sys,html,re;t=re.sub(r'<script.*?</script>|<style.*?</style>','',sys.stdin.read(),flags=re.S);print(html.unescape(re.sub(r'<[^>]+>',' ',t)))" | grep -i -C2 'keyword'`. Do NOT trust a summarizer (WebFetch) for wording or numbers: summarizers have invented quotes before. Tweets: `curl -s https://api.fxtwitter.com/status/<id>` gives the real text.
   - X/Twitter-only claims by a credible primary (the lab, the researcher who ran it, an official) count as confirmed if you read the tweet text itself.
3. **Verdict** per item:
   - `ok`: confirmed; `shows` stands (or your corrected version).
   - `fixed`: confirmed after you corrected `shows` (say what changed in `note`).
   - `unconfirmed`: you could not find support beyond the candidate itself. Fine for a credible first-hand post (keep the hedge), but say so.
   - `false`: the source contradicts it, or it is satire/misattributed. It will be dropped.
   - `dup`: it is the same event as an earlier item in YOUR batch (give `dup_of` = that item's k).
4. **Best link** (`url`): the page a non-expert YouTuber would actually read and that states the fact: a news article (BBC/TIME/Reuters/AP/Fortune/NPR/Ars/Verge tier), the company's official post, or the primary tweet if that is where it lives. A paper only if nothing readable exists. Give `who` (outlet or account, e.g. "Reuters", "OpenAI", "X post") and `kind` (news, official-report, research-paper, blog, primary-doc, tweet, video, expert-quote, data). Give `date` (YYYY-MM-DD, the event's or the report's date).
5. Re-check `grab` only if you rewrote `shows` (same scale: would a normal person stop scrolling at this sentence, 1-10).

No em dashes in `shows`. Keep it event-first and plain, max ~45 words.

## Output object

`{"k":..,"verdict":"ok|fixed|unconfirmed|false|dup","shows":"..","url":"..","who":"..","kind":"..","date":"YYYY-MM-DD","grab":8,"note":"what you checked, 1 line","dup_of":null}`

Write valid JSON (validate with python before finishing).

## Also return a headline (added after the Oct 30 2026 run)
Add `"title"`: max 9 words, no colon or dash, written FROM your final `shows`. Keep attribution ("X says", "report says"), hedges ("may", "allegedly", "estimated", "if ..."), scope (one website is not a country; three members are not Congress) and numbers exactly. A question stays a question. 69 of 122 headlines failed this the first time because nobody re-derived them after the sentence was corrected.
