export const meta = {
  name: 'bank-sources-repair',
  description: 'Repair 39 flawed bank-idea source sets: semantic bank picks + web-hunt missing specific-event sources',
  phases: [{ title: 'Repair', detail: 'one agent per flawed idea' }, { title: 'Write', detail: 'save picks + new sources' }],
}
const SP = '<scratch>'
const CATS = "scheming-deception | self-preservation-escape | self-improvement | capabilities-trajectory | expert-warnings | jobs-economy | persuasion-manipulation | companions-parasocial | agents-in-the-wild | bio-risk | weapons-war | power-concentration | epistemics-fakes | consciousness-welfare | governance-policy | incidents | scenarios-forecasts | alignment-interpretability | other"

const REPAIR_SCHEMA = { type: 'object', properties: {
  title: { type: 'string', description: 'the idea title EXACTLY as given' },
  source_ids: { type: 'array', items: { type: 'string' }, description: 'existing bank ids that genuinely fit, best first' },
  new_sources: { type: 'array', items: { type: 'object', properties: {
    title: { type: 'string' }, who: { type: 'string' }, year: { type: 'string' },
    url: { type: 'string', description: 'EXACT url you verified with curl. NEVER invented.' },
    shows: { type: 'string', description: 'one interesting plain sentence, no em dashes or hyphens' },
    cat: { type: 'string', description: 'one of: ' + CATS }, kind: { type: 'string', description: 'news | blog | video | official-report | research-paper | data' }
  }, required: ['title','who','url','shows','cat','kind'] }, description: 'ONLY if the bank lacks the idea specific event: 1-2 web-found sources you VERIFIED (curl -sIL 2xx, or bot-403 from a major outlet)' }
}, required: ['title','source_ids'] }

phase('Repair')
const results = await parallel(Array.from({length: 39}, (_, i) => () => agent(
`Read ${SP}/flawed_ideas.json via Bash python3, entry [${i}]: an AI-risk video idea (title/summary/pitch) whose precomputed sources were graded flawed, with a "problem" note saying what is missing.

Your job: produce the RIGHT 2 to 5 sources for this exact idea.
1. FIRST search ~/Downloads/similar-ideas-api/sources.json (1373 entries: id,title,who,year,url,shows,cat,kind) semantically with several different search terms and category filters guided by the problem note. Pick existing entries that document THIS idea's specific event or mechanism. Readable kinds first (news/tweet/blog/video); at most ONE research-paper/primary-doc/official-report and only as the story's primary artifact.
2. If (and only if) the bank genuinely lacks a source for the idea's SPECIFIC subject (the problem note usually says so): WebSearch for the best 1 or 2 READABLE articles documenting it (major outlet or official blog; the reader is a random YouTuber; every link must pay off within a minute), VERIFY each url with curl -sIL (2xx ok; 403 from a major outlet acceptable; 404 = do not return it), and return them in new_sources with an interesting one sentence "shows" (no em dashes, no hyphens, never "AI lab", say "AI company").
3. Return the title EXACTLY as given, source_ids best-first (2 to 5 total across existing+new; the specific-event source should lead).
Never fabricate urls. Never pad with loosely related entries.`,
  { label: `repair:${i}`, phase: 'Repair', schema: REPAIR_SCHEMA }
)))
const ok = results.filter(Boolean)
log(`${ok.length}/39 repaired`)
phase('Write')
await agent(
`Use the Write tool to write EXACTLY this JSON to ${SP}/repairs.json (indent 1), then verify it parses via Bash python3 and report the count.\n\n${JSON.stringify(ok)}`,
  { label: 'write:repairs', phase: 'Write', effort: 'low' }
)
return { repaired: ok.length, withNewSources: ok.filter(r => (r.new_sources || []).length).length, totalNew: ok.reduce((a, r) => a + (r.new_sources || []).length, 0) }