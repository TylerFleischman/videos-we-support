export const meta = {
  name: 'weak-idea-sources',
  description: 'Hand-pick bank sources for the 14 bank ideas the automatic matcher underserved',
  phases: [{ title: 'Pick', detail: 'one agent per idea reads the full bank and selects semantically' }],
}
const SP = '<scratch>'
const PICK_SCHEMA = { type: 'object', properties: {
  title: { type: 'string', description: 'the idea title exactly as given' },
  source_ids: { type: 'array', items: { type: 'string' }, description: '2 to 5 bank ids, best first' }
}, required: ['title','source_ids'] }

phase('Pick')
const results = await parallel(Array.from({length: 14}, (_, i) => () => agent(
`Read ${SP}/weak_ideas.json via Bash python3 and take entry [${i}] (title, summary, pitch). This is an AI-risk video idea whose keyword matcher failed to find sources. Now search ~/Downloads/similar-ideas-api/sources.json (1373 entries: id, title, who, year, url, shows, cat, kind) SEMANTICALLY: use python3/grep with several different relevant terms and category filters (cats like persuasion-manipulation, bio-risk, weapons-war, consciousness-welfare, power-concentration, jobs-economy etc.) to find the 2 to 5 entries that genuinely fit THIS idea. Rules: the reader is a random YouTuber; prefer kind news/tweet/blog/video entries whose payoff matches the idea's claims; at most ONE research-paper/primary-doc/official-report, and only if it is the story's primary artifact; no loosely related filler (a source must be about this idea's actual topic or a vivid example of its exact mechanism). Return the idea title EXACTLY as given and the chosen ids best first.`,
  { label: `pick:${i}`, phase: 'Pick', schema: PICK_SCHEMA }
)))
const ok = results.filter(Boolean)
await agent(
`Use the Write tool to write EXACTLY this JSON to ${SP}/weak_picks.json (indent 1), then confirm it parses via Bash python3.\n\n${JSON.stringify(ok)}`,
  { label: 'write:picks', phase: 'Pick', effort: 'low' }
)
return { picked: ok.length, avg: ok.length ? (ok.reduce((a, r) => a + (r.source_ids || []).length, 0) / ok.length).toFixed(1) : 0 }