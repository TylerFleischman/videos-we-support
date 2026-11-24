export const meta = {
  name: 'tweet-gateway-sources',
  description: 'Turn AISafetyMemes tweets into anonymous high-signal gateway sources (excerpt + tweet link)',
  phases: [
    { title: 'Extract', detail: '16 agents x 40 tweets: pull the key sentences, categorize' },
    { title: 'Write', detail: 'save entries' },
  ],
}

const SP = '<scratch>/source-bank'
const CATS = "scheming-deception | self-preservation-escape | self-improvement | capabilities-trajectory | expert-warnings | jobs-economy | persuasion-manipulation | companions-parasocial | agents-in-the-wild | bio-risk | weapons-war | power-concentration | epistemics-fakes | consciousness-welfare | governance-policy | incidents | scenarios-forecasts | alignment-interpretability | other"

const TW_SCHEMA = { type: 'object', properties: { entries: { type: 'array', items: { type: 'object', properties: {
  tweet_url: { type: 'string', description: 'the exact x.com status url from the data' },
  title: { type: 'string', description: 'short neutral label for what the reader will see, max 12 words, never mentioning the account name' },
  excerpt: { type: 'string', description: 'the tweet text itself, its highest signal 1 to 3 sentences, lightly cleaned: no emojis, no hashtags, no @handles, no account name, no meme commentary, keep quotes and numbers verbatim' },
  year: { type: 'string' }, cat: { type: 'string', description: 'one of: ' + CATS }
}, required: ['tweet_url','title','excerpt','cat'] } } }, required: ['entries'] }

phase('Extract')
const N = 16, PER = 40
const results = await parallel(Array.from({length: N}, (_, i) => () => agent(
`Read ${SP}/tweets_clean.json via Bash python3 and print entries [${i*PER}:${(i+1)*PER}] (text, tweet link, date). These tweets each summarize a real AI event, study, or quote, usually pulling out the most striking 1 to 3 sentences, and the tweet itself links onward to the full story. We are turning them into GATEWAY SOURCES: a creator clicks the tweet, sees the key claim in seconds, and can follow the tweet's own link to the article.

For each tweet whose text contains a CONCRETE factual claim (a real event, study finding, quote with a speaker, or number): output an entry with the exact tweet_url from the data, a short neutral title (what the claim is, never the account name), and the excerpt: the tweet's own highest signal sentences, cleaned (drop emojis, hashtags, handles, meme jokes, engagement bait like "How is this not the biggest news story"; keep quotes, names, and numbers verbatim). year from the date. SKIP: pure jokes and vibes, opinions with no factual referent, screenshots-only tweets whose text says nothing concrete, and anything about the account itself. Expect roughly 15 to 30 entries from your 40 tweets. Do not invent or modify urls.`,
  { label: `tw:${i*PER}-${(i+1)*PER}`, phase: 'Extract', schema: TW_SCHEMA }
)))
const all = results.filter(Boolean).flatMap(r => r.entries || [])
const seen = new Set(), unique = []
for (const e of all) {
  const k = (e.tweet_url || '').toLowerCase().trim()
  if (!k || !k.includes('/status/') || seen.has(k)) continue
  seen.add(k); unique.push(e)
}
log(`${unique.length} unique tweet gateway entries`)

phase('Write')
await agent(
`Use the Write tool to write EXACTLY this JSON array (indent 1) to ${SP}/tweet_gateways.json, then confirm it parses via Bash python3 (print the count).\n\n${JSON.stringify(unique)}`,
  { label: 'write:gateways', phase: 'Write', effort: 'low' }
)
const cats = {}
unique.forEach(e => { cats[e.cat] = (cats[e.cat] || 0) + 1 })
return { entries: unique.length, byCategory: cats }