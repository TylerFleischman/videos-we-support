export const meta = {
  name: 'tweet-source-hunt',
  description: 'Mine AISafetyMemes tweets: find + verify the real readable articles behind them',
  phases: [
    { title: 'Hunt', detail: '16 agents x 40 tweets: identify claims, search for readable articles' },
    { title: 'Verify', detail: 'live-check every new URL' },
    { title: 'Write', detail: 'save verified candidates' },
  ],
}

const SP = '<scratch>/source-bank'
const CATS = "scheming-deception | self-preservation-escape | self-improvement | capabilities-trajectory | expert-warnings | jobs-economy | persuasion-manipulation | companions-parasocial | agents-in-the-wild | bio-risk | weapons-war | power-concentration | epistemics-fakes | consciousness-welfare | governance-policy | incidents | scenarios-forecasts | alignment-interpretability | other"

const SRC_SCHEMA = {
  type: 'object',
  properties: { sources: { type: 'array', items: { type: 'object', properties: {
    title: { type: 'string' }, who: { type: 'string', description: 'outlet or author, e.g. BBC, TIME, Anthropic' },
    year: { type: 'string' }, url: { type: 'string', description: 'EXACT url from a search result or fetched page you confirmed. NEVER invented.' },
    shows: { type: 'string', description: 'one INTERESTING plain sentence with the wow detail, written for a random YouTuber, no em dashes, no hyphens' },
    cat: { type: 'string', description: 'one of: ' + CATS },
    kind: { type: 'string', description: 'news | video | blog | official-report | research-paper | data | incident | expert-quote' }
  }, required: ['title','who','url','shows','cat'] } } },
  required: ['sources']
}

phase('Hunt')
const BATCHES = 16, PER = 40
const hunts = await parallel(Array.from({length: BATCHES}, (_, i) => () => agent(
`Read ${SP}/tweets_clean.json with Bash (python3: load JSON, print entries [${i*PER}:${(i+1)*PER}] with their text, views, date). These are viral tweets from @AISafetyMemes, each referencing a real AI event, study, quote, or incident, usually WITHOUT a link (screenshots).

For each tweet that makes a CONCRETE factual claim (skip pure jokes, vibes, or opinions with no factual referent): figure out what real event/study/statement it refers to, then use WebSearch to find the ACTUAL article covering it. CRITICAL SELECTION RULE: the audience is random YouTubers, NOT academics. They will never read a paper. So prefer a link they would actually read: BBC, TIME, Guardian, WIRED, Fortune, TechCrunch, Axios, Business Insider, NYT, Newsweek, Ars Technica, The Verge, 404 Media, official company blog posts, or a YouTube video. Include an arxiv/paper link ONLY as a second entry when the story is important and the paper is the primary artifact. If several tweets reference the same event, source it once.

Confirm each URL is real by seeing it in search results or fetching it. NEVER fabricate or reconstruct a URL. 'shows' must be INTERESTING, the holy shit detail that makes someone click, in plain language (no em dashes, no hyphens, no jargon, never 'AI lab', say 'AI company'). Include year. Skip anything where you cannot find a real article. Expect roughly 8 to 20 good sources from your 40 tweets. Categories: ${CATS}.`,
  { label: `hunt:${i*PER}-${(i+1)*PER}`, phase: 'Hunt', schema: SRC_SCHEMA }
)))
const found = hunts.filter(Boolean).flatMap(r => r.sources || [])
log(`Hunts returned ${found.length} candidate sources`)

// dedupe among candidates AND against the existing 752-entry bank
function norm(u) {
  try {
    let s = (u || '').trim().replace(/^http:\/\//, 'https://').replace(/\/+$/, '').replace(/^https:\/\/www\./, 'https://')
    const q = s.indexOf('?'); if (q > 0 && !s.includes('watch?v=')) s = s.slice(0, q)
    return s.toLowerCase()
  } catch (e) { return (u || '').toLowerCase() }
}
const byUrl = {}
for (const s of found) {
  const k = norm(s.url)
  if (!k) continue
  if (!byUrl[k] || (s.shows || '').length > (byUrl[k].shows || '').length) byUrl[k] = s
}
const fresh = Object.values(byUrl)
log(`${fresh.length} genuinely new sources after dedupe vs bank (${found.length - fresh.length} dropped as known/dup)`)

phase('Verify')
const VER_SCHEMA = { type: 'object', properties: { results: { type: 'array', items: { type: 'object', properties: {
  url: { type: 'string' }, verdict: { type: 'string', description: 'ok | dead | blocked | wrong' }
}, required: ['url','verdict'] } } }, required: ['results'] }
const vb = []
for (let i = 0; i < fresh.length; i += 25) vb.push(fresh.slice(i, i + 25))
const verified = await parallel(vb.map((b, bi) => () => agent(
`Check these ${b.length} URLs with Bash curl -sIL --max-time 20 (follow redirects). 2xx = ok. 404/410/5xx = dead. 401/403/429/999/bot-block = blocked (blocked is acceptable, NOT dead). YouTube: fetch page, "Video unavailable" = dead else ok.\n${b.map(s => s.url).join('\n')}`,
  { label: `verify:${bi}`, phase: 'Verify', schema: VER_SCHEMA, effort: 'low' }
)))
const verdicts = {}
verified.filter(Boolean).flatMap(r => r.results || []).forEach(v => { verdicts[norm(v.url)] = v.verdict })
const kept = fresh.filter(s => (verdicts[norm(s.url)] || 'ok') !== 'dead' && (verdicts[norm(s.url)] || 'ok') !== 'wrong')
log(`${kept.length} kept after verification (${fresh.length - kept.length} dropped)`)

phase('Write')
await agent(
`Use the Write tool to write EXACTLY this JSON array (pretty, indent 1) to ${SP}/tweet_sources.json without altering anything, then confirm it parses with python3 -c "import json; print(len(json.load(open('${SP}/tweet_sources.json'))))" via Bash.\n\n${JSON.stringify(kept)}`,
  { label: 'write:tweet_sources', phase: 'Write', effort: 'low' }
)
const cats = {}
kept.forEach(s => { cats[s.cat] = (cats[s.cat] || 0) + 1 })
return { newSources: kept.length, byCategory: cats, huntedCandidates: found.length }