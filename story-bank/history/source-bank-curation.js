export const meta = {
  name: 'source-bank-curation',
  description: 'Judge all bank sources on usefulness to random YouTubers; flag boring/buried-payoff entries',
  phases: [
    { title: 'Judge', detail: '14 agents x ~73 entries: remove useless, demote long primary docs' },
  ],
}

const SP = '<scratch>/source-bank'

const JUDGE_SCHEMA = { type: 'object', properties: {
  remove: { type: 'array', items: { type: 'object', properties: {
    id: { type: 'string' }, reason: { type: 'string', description: 'obvious-fact | buried-payoff | junk-link | vague' } }, required: ['id','reason'] } },
  demote: { type: 'array', items: { type: 'string' }, description: 'ids of long primary documents (system cards, technical reports, 50+ page PDFs) that are real but unreadable; they stay in the bank but get kind=primary-doc' }
}, required: ['remove','demote'] }

phase('Judge')
const N = 14
const results = await parallel(Array.from({length: N}, (_, i) => () => agent(
`The file ~/Downloads/similar-ideas-api/sources.json is a bank of AI-risk sources cited to RANDOM YOUTUBERS (not academics) as "click this to see the crazy thing is real". Use Bash python3 to load it, sort entries by id, and print your slice: entries [i*len//${N} : (i+1)*len//${N}] for i=${i} (print id, title, who, year, url, kind, shows for each).

Judge EVERY entry in your slice against one test: if a random YouTuber clicks this link, do they within a minute see something that makes the idea more credible or more interesting? Flag for REMOVE:
- obvious-fact: the source only confirms what everyone already knows (example the user gave: "Microsoft, OpenAI consider $100bn Stargate AI data center" — people know datacenters are big money; similar: chips are expensive, AI uses electricity, big companies invest billions, stock went up)
- buried-payoff: the payoff is buried somewhere the reader will never dig (example the user gave: "Ilya Sutskever in iHuman documentary" linking an IMDB page — nobody watches a whole film to find one quote; similar: bare homepage links, a whole podcast episode with no timestamp for a single quote UNLESS the shows text makes the whole episode the point, links to a search page or profile page)
- junk-link: the url is a tweet aggregator, reddit thread, or low-cred site AND the same claim obviously has better coverage (be conservative: an x.com link to the actual person saying the thing IS a fine primary source; reddit is ok only if the reddit thread itself IS the story)
- vague: the shows text is so generic you cannot tell what the reader would even see

Flag for DEMOTE (keep in bank, but mark as artifact-only): long primary documents a normal person will never read: model system cards, 50+ page technical reports, government/industry PDF reports, academic-style PDFs that are not already kind research-paper. Do NOT demote news articles, blog posts, or short official announcements.

BE CONSERVATIVE with remove: when unsure, keep. Striking studies, wild incidents, expert warnings with teeth, and data with a surprising number all stay. Only WebFetch a url if the metadata truly leaves you unsure. Return ids exactly as given.`,
  { label: `judge:${i}`, phase: 'Judge', schema: JUDGE_SCHEMA }
)))
const ok = results.filter(Boolean)
const remove = ok.flatMap(r => r.remove || [])
const demote = [...new Set(ok.flatMap(r => r.demote || []))]
const reasons = {}
remove.forEach(r => { reasons[r.reason] = (reasons[r.reason] || 0) + 1 })
// write verdicts for the parent session to apply
await agent(
`Use the Write tool to write EXACTLY this JSON to ${SP}/curation_verdicts.json (indent 1), then confirm it parses via Bash python3.\n\n${JSON.stringify({ remove, demote })}`,
  { label: 'write:verdicts', phase: 'Judge', effort: 'low' }
)
return { judged: ok.length + ' of ' + N + ' slices', removeCount: remove.length, demoteCount: demote.length, removeReasons: reasons }