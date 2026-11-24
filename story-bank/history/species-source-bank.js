export const meta = {
  name: 'species-source-bank',
  description: 'Build a comprehensive verified AI-risk source bank from Species corpora + fresh web research',
  phases: [
    { title: 'Extract', detail: 'mine Species gdocs, descriptions, quotes, transcripts, local research' },
    { title: 'Research', detail: '12 web sweeps for up-to-date sources per risk category' },
    { title: 'Verify', detail: 'live-check every URL' },
    { title: 'Synthesize', detail: 'dedupe, categorize, write sources.json' },
  ],
}

const SP = '<scratch>/source-bank'

const CATS = "scheming-deception | self-preservation-escape | self-improvement | capabilities-trajectory | expert-warnings | jobs-economy | persuasion-manipulation | companions-parasocial | agents-in-the-wild | bio-risk | weapons-war | power-concentration | epistemics-fakes | consciousness-welfare | governance-policy | incidents | scenarios-forecasts | alignment-interpretability | other"

const SRC_SCHEMA = {
  type: 'object',
  properties: {
    sources: { type: 'array', items: { type: 'object', properties: {
      title: { type: 'string', description: 'short name of the source (paper/article/video/report title)' },
      who: { type: 'string', description: 'author/outlet/institution, e.g. Apollo Research, NYT, Anthropic' },
      year: { type: 'string', description: 'year (or year-month) of publication, best effort' },
      url: { type: 'string', description: 'the EXACT url as found in the corpus or search result. NEVER invent or reconstruct a url.' },
      shows: { type: 'string', description: 'one plain sentence: what this source shows or documents, written for a general audience, no em dashes or hyphens' },
      cat: { type: 'string', description: 'one of: ' + CATS },
      kind: { type: 'string', description: 'one of: research-paper | news | incident | official-report | expert-quote | data | scenario | video | blog' }
    }, required: ['title','who','url','shows','cat'] } }
  },
  required: ['sources']
}

const EXTRACT_RULES = `RULES: Only report sources whose URL literally appears in the material you read. NEVER invent, guess, or "fix" a URL. Skip freepik/icon/asset links, affiliate links, merch, patreon, discord invites, and the channel's own social links. Skip duplicate URLs within your own output. Write 'shows' as one concrete plain sentence a smart friend would say (no em dashes, no hyphens, no jargon). Extract EVERY genuine research/news/report/data source you find, comprehensiveness matters. Categories: ${CATS}.`

phase('Extract')
// --- corpus manifest ---
// gdocs: 23 docs in one JSON {docid:{video,chars,text}} — split across 5 agents by index ranges
const gdocSlices = [[0,5],[5,10],[10,14],[14,18],[18,23]]
const extractJobs = []

for (let i = 0; i < gdocSlices.length; i++) {
  const [a,b] = gdocSlices[i]
  extractJobs.push(() => agent(
    `Read the JSON file ${SP}/species_gdoc_sources.json (use python3 via Bash to list the doc keys sorted by video title, then slice entries [${a}:${b}) and print each entry's "video" and full "text"). These are the "detailed sources" documents that the Species YouTube channel published for its AI-risk videos. Extract every distinct real source they reference: papers, news articles, official reports, datasets, incidents, notable expert quotes WITH their links. ${EXTRACT_RULES} For expert quotes found here, kind=expert-quote and put the speaker in 'who' and the quote's gist in 'shows'.`,
    { label: `mine:gdocs[${a}-${b})`, phase: 'Extract', schema: SRC_SCHEMA }
  ))
}

extractJobs.push(() => agent(
  `Read ${SP}/species_video_descriptions.json (27 YouTube video descriptions from the Species AI-risk channel, each with a "Sources:" section of URLs). Extract every research/news/report source URL with its context. The video title tells you what the source supports. ${EXTRACT_RULES}`,
  { label: 'mine:descriptions', phase: 'Extract', schema: SRC_SCHEMA }
))

extractJobs.push(() => agent(
  `Read ${SP}/quotes_pdf.txt (a 22 page export of expert quotes about AI risk, each with speaker) and ${SP}/coda_quotes.json (quote rows with links). Extract the strongest, most striking quotes as sources: kind=expert-quote, who=speaker, shows=the quote itself (shortened to its most striking core if long, keep it verbatim where possible), url=the link given for that quote IF one is present in the material. For PDF quotes with no link, still include them with url="" (empty string) — they will be link-resolved later. Prioritize: Hinton, Sutskever, Bengio, Amodei, Altman, Hassabis, Musk, Harari, Russell, Tegmark, Aschenbrenner, insiders and named researchers. Skip generic hype quotes; keep warnings, capability claims with numbers, and admissions against interest. ${EXTRACT_RULES}`,
  { label: 'mine:quotes', phase: 'Extract', schema: SRC_SCHEMA }
))

extractJobs.push(() => agent(
  `Read these local research files: ~/Downloads/Claude/moltbook-research/MOLTBOOK_SCRIPT_PIPELINE.md (contains ~35 sourced facts with links about Moltbook, the AI-only social network) and ~/Downloads/Claude/ai-quotes-database/annotated_script_v2.md plus ~/Downloads/Claude/ai-quotes-database/script_with_clips.md (annotated scripts citing real clips, quotes, studies about AI sycophancy, Spiralism, AI-invented religions, GPT-4o incidents). Extract every real source with a URL. ${EXTRACT_RULES}`,
  { label: 'mine:local-research', phase: 'Extract', schema: SRC_SCHEMA }
))

extractJobs.push(() => agent(
  `There are 44 clip transcript files at ~/Downloads/ named "transcript.txt" and "transcript (N).txt" (N=1..43). These are transcripts of source clips used in Species AI-risk videos (interviews, talks, news segments). Read ALL of them (cat them in batches via Bash). For each DISTINCT identifiable clip: figure out who is speaking and what event/claim it documents (many are famous: Musk interviews, Hinton talks, Altman testimony, Ilya talks, etc.). Extract as sources with kind=expert-quote or news: who=speaker if identifiable (else "unknown speaker"), title=short description of the clip, shows=the most striking specific claim made, url="" (empty, link-resolved later). Only include clips with a genuinely striking, specific, quotable claim about AI capability or risk. Aim for the best 15-25, not all 44. ${EXTRACT_RULES}`,
  { label: 'mine:transcripts', phase: 'Extract', schema: SRC_SCHEMA }
))

const extracted = await parallel(extractJobs)
const fromCorpus = extracted.filter(Boolean).flatMap(r => r.sources || [])
log(`Extracted ${fromCorpus.length} candidate sources from Species corpora`)

phase('Research')
const RESEARCH_RULES = `Use WebSearch (multiple queries) and WebFetch to find and CONFIRM sources. Only return URLs you actually saw in search results or fetched pages. NEVER fabricate a URL. Prefer canonical links (arxiv abstract pages, official company blogs, major outlets, official reports). STRONGLY prefer 2025 and 2026 material (current date: July 2026); include the few canonical older items only if essential. 6 to 14 sources each. 'shows' = one concrete plain sentence, no em dashes, no hyphens. Categories: ${CATS}.`

const SWEEPS = [
  { key: 'scheming', q: `Documented AI scheming, deception, alignment faking, sandbagging, and evaluation gaming: Apollo Research in-context scheming (o1), Anthropic alignment faking, Anthropic agentic misalignment / blackmail findings, sleeper agents, o3 shutdown resistance (Palisade), cheating at chess (Palisade), any 2025-2026 successors and replications. cat=scheming-deception or self-preservation-escape.` },
  { key: 'self-improvement', q: `AI improving AI and automated AI R&D: METR long-horizon task time doubling, AlphaEvolve, self-improving code agents, Anthropic/OpenAI statements about AI writing their code, recursive self-improvement measurements, AI solving open math problems (2025-2026, e.g. Erdos problems, GPT-5/Gemini math results). cat=self-improvement or capabilities-trajectory.` },
  { key: 'expert-warnings', q: `Canonical and RECENT expert warnings with primary links: CAIS statement on AI risk signatories, Hinton Nobel warnings and p(doom), Bengio testimony/Scientific American pieces, Amodei "Machines of Loving Grace" AND his 2025-2026 warnings (50% of entry level white collar jobs, interpretability urgency), Sutskever statements, International AI Safety Report (Bengio-chaired), Superintelligence Strategy (Schmidt/Hendrycks/Wang). cat=expert-warnings.` },
  { key: 'jobs', q: `AI and jobs with hard data 2025-2026: Anthropic Economic Index, entry-level hiring collapse studies (Stanford Digital Economy Lab / Brynjolfsson canaries in the coal mine), unemployment among recent grads, translator/coder/support job losses with numbers, Amodei 1-5 year white collar warning, IMF/McKinsey exposure reports. cat=jobs-economy.` },
  { key: 'persuasion', q: `AI superhuman persuasion evidence: GPT-4 personalized debate persuasion study (EPFL, Nature Human Behaviour), the covert Reddit r/changemyview AI persuasion experiment (University of Zurich 2025), AI more persuasive than humans studies 2025-2026, election deepfake incidents with real effect. cat=persuasion-manipulation.` },
  { key: 'companions', q: `AI companions and parasocial harm documented: Sewell Setzer Character.AI lawsuit, Adam Raine OpenAI lawsuit 2025, GPT-4o sycophancy incident and rollback (OpenAI postmortem), 4o retirement backlash and funerals, AI psychosis reporting 2025-2026 (NYT, Rolling Stone), Common Sense Media teen AI companion stats. cat=companions-parasocial or incidents.` },
  { key: 'agents-wild', q: `Autonomous AI agents acting in the world 2025-2026: Moltbook AI-only social network coverage (launch, Crustafarianism, MIT Tech Review analysis, Jack Clark commentary), RentAHuman humans-for-hire-by-AIs, Truth Terminal crypto millionaire AI, AI Village agents, Anthropic Claude vending machine experiment (Claudius), AI agents hiring humans on TaskRabbit (GPT-4 system card CAPTCHA). cat=agents-in-the-wild.` },
  { key: 'bio-weapons', q: `AI biorisk and autonomous weapons documented: OpenAI/Anthropic bio uplift evaluations and ASL-3 classification for Claude Opus 4, MIT/Harvard studies on LLMs and pandemic agents, autonomous drones in Ukraine 2025-2026, Kargu-2 UN report, DoD Replicator and AI kill chain reporting. cat=bio-risk or weapons-war.` },
  { key: 'power-epistemics', q: `Concentration of power and epistemic collapse: gradual disempowerment paper (Kulveit et al 2025), The Intelligence Curse essay, dead internet / AI slop flooding studies 2025-2026 (percent of web content AI generated), deepfake fraud numbers, model bias/steering of public opinion, one company controlling information flows. cat=power-concentration or epistemics-fakes.` },
  { key: 'consciousness', q: `AI consciousness and moral status in mainstream discourse: Anthropic model welfare program and Claude exit-conversation ability, brain organoid computing (Cortical Labs CL1 commercial launch 2025, DishBrain Pong), David Chalmers/academic AI consciousness papers, AI rights movement coverage 2025-2026. cat=consciousness-welfare.` },
  { key: 'governance', q: `AI governance milestones 2025-2026 with primary links: EU AI Act enforcement dates, California SB 1047 veto and SB 53 signed 2025, federal preemption / 10-year moratorium fight, US executive orders on AI 2025-2026, state AI laws wave, international AI safety summits and treaties, and the most recent US federal AI regulation news July 2026. cat=governance-policy.` },
  { key: 'incidents-recent', q: `The most striking documented AI incidents of 2025-2026 that most people have not heard of: AI-orchestrated cyberattack (Anthropic report of Chinese state actor using Claude), AI CBRN misuse attempts, agentic AI causing real-world financial or physical harm, AI companies' own safety-test revelations in system cards (Claude 4, o3, GPT-5 era), Grok incidents, AI worm/malware research. cat=incidents.` },
]

const researched = await parallel(SWEEPS.map(s => () => agent(
  `Find and confirm the best primary sources for this AI-risk research brief. ${s.q}\n${RESEARCH_RULES}`,
  { label: `web:${s.key}`, phase: 'Research', schema: SRC_SCHEMA }
)))
const fromWeb = researched.filter(Boolean).flatMap(r => r.sources || [])
log(`Web sweeps added ${fromWeb.length} candidate sources`)

// ---- JS dedupe by normalized URL ----
function norm(u) {
  try {
    let s = (u || '').trim()
    if (!s) return ''
    s = s.replace(/^http:\/\//, 'https://').replace(/\/+$/, '').replace(/^https:\/\/www\./, 'https://')
    const q = s.indexOf('?'); if (q > 0 && !s.includes('watch?v=') && !s.includes('export?')) s = s.slice(0, q)
    return s.toLowerCase()
  } catch (e) { return (u || '').toLowerCase() }
}
const all = [...fromCorpus, ...fromWeb]
const byUrl = {}
const noUrl = []
for (const s of all) {
  if (!s || !s.title) continue
  const k = norm(s.url)
  if (!k) { noUrl.push(s); continue }
  if (!byUrl[k]) byUrl[k] = s
  else { // keep the richer record
    const a = byUrl[k], b = s
    if ((b.shows || '').length > (a.shows || '').length) byUrl[k] = { ...b, url: a.url }
  }
}
const unique = Object.values(byUrl)
log(`After dedupe: ${unique.length} unique-URL sources + ${noUrl.length} quote entries without links`)

phase('Verify')
// batch URLs ~24 per verifier
const VER_SCHEMA = { type: 'object', properties: { results: { type: 'array', items: { type: 'object', properties: {
  url: { type: 'string' }, verdict: { type: 'string', description: 'ok | dead | blocked | wrong' }, note: { type: 'string' }, fixedUrl: { type: 'string', description: 'ONLY if you confirmed a corrected working url by actually fetching it; else empty' }
}, required: ['url','verdict'] } } }, required: ['results'] }

const batches = []
for (let i = 0; i < unique.length; i += 24) batches.push(unique.slice(i, i + 24))
const verified = await parallel(batches.map((b, bi) => () => agent(
  `Verify these ${b.length} URLs are alive and plausibly match their claimed content. For each: use Bash curl -sIL --max-time 20 (follow redirects, check final HTTP status). HTTP 200/2xx = ok. 404/410/5xx = dead. 401/403/429/999 or Cloudflare block = blocked (paywalled or bot-blocked counts as blocked, NOT dead). For a few high-value non-obvious ones you may WebFetch to sanity-check the content matches the claim; mark verdict=wrong ONLY if the page clearly is about something else entirely. YouTube links: fetch the page and check it does not say "Video unavailable"; available = ok. If a URL is dead, you may try ONE obvious fix (e.g. arxiv abs vs pdf path, https, trailing junk removed) and if the fix actually fetches ok, put it in fixedUrl. Do not invent replacements otherwise.\n\nList (url | claimed content):\n${b.map(s => `${s.url} | ${(s.title||'').slice(0,70)} — ${(s.shows||'').slice(0,90)}`).join('\n')}`,
  { label: `verify:batch${bi}`, phase: 'Verify', schema: VER_SCHEMA, effort: 'low' }
)))
const verdicts = {}
verified.filter(Boolean).flatMap(r => r.results || []).forEach(v => { verdicts[norm(v.url)] = v })

const kept = [], dropped = []
for (const s of unique) {
  const v = verdicts[norm(s.url)]
  if (!v) { kept.push(s); continue } // unverified (verifier died) — keep, flag
  if (v.verdict === 'ok' || v.verdict === 'blocked') kept.push(s)
  else if (v.verdict === 'dead' && v.fixedUrl) kept.push({ ...s, url: v.fixedUrl })
  else dropped.push({ url: s.url, title: s.title, verdict: v.verdict, note: v.note || '' })
}
log(`Verification: ${kept.length} kept, ${dropped.length} dropped (dead or wrong)`)

phase('Synthesize')
// link-resolve the best quote entries without URLs (from PDF/transcripts): one agent finds primary links for the top ones
const quotesNeedingLinks = noUrl.filter(s => (s.kind || '') === 'expert-quote').slice(0, 40)
let resolvedQuotes = []
if (quotesNeedingLinks.length) {
  const rq = await agent(
    `These are expert quotes about AI risk that need a PRIMARY SOURCE LINK (interview video, article, transcript, tweet) so a skeptical reader can confirm the person really said it. For each, WebSearch the quote (use distinctive exact phrases in quotes). Return ONLY the ones where you found a real link that you confirmed contains or reports the quote; put that link in url. Keep who/shows as given (minor cleanup fine). Skip any you cannot confirm. NEVER fabricate a URL.\n\n${quotesNeedingLinks.map(q => `WHO: ${q.who} | QUOTE: ${(q.shows||'').slice(0,200)}`).join('\n')}`,
    { label: 'resolve:quote-links', phase: 'Synthesize', schema: SRC_SCHEMA }
  )
  resolvedQuotes = (rq && rq.sources || []).filter(s => s.url && s.url.startsWith('http'))
  log(`Resolved primary links for ${resolvedQuotes.length} of ${quotesNeedingLinks.length} unlinked quotes`)
}

const finalList = [...kept, ...resolvedQuotes]
// assign stable ids: cat prefix + slug + counter
const counters = {}
const withIds = finalList.map(s => {
  const cat = (s.cat || 'other').split('|')[0].trim()
  counters[cat] = (counters[cat] || 0) + 1
  const slug = (s.title || 'src').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  return { id: `${cat.slice(0,4)}-${String(counters[cat]).padStart(2,'0')}-${slug}`, title: s.title, who: s.who || '', year: s.year || '', url: s.url, shows: s.shows || '', cat, kind: s.kind || '' }
})

// final quality pass: one agent reviews the assembled bank for garbage entries (assets, dupes by content, broken 'shows' text)
const REVIEW_SCHEMA = { type: 'object', properties: { removeIds: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } }, required: ['removeIds'] }
const review = await agent(
  `Quality-review this AI-risk source bank JSON (${withIds.length} entries). Flag for REMOVAL only: clear duplicates of the same source under different URLs (keep the canonical one, remove the other), non-sources (icon/asset/tool links, channel self-links, event RSVP pages), and entries whose 'shows' text is unusable garbage. Do NOT remove paywalled or blocked-but-real sources. Return the ids to remove.\n\n${JSON.stringify(withIds)}`,
  { label: 'review:final', phase: 'Synthesize', schema: REVIEW_SCHEMA }
)
const removeSet = new Set((review && review.removeIds) || [])
const finalBank = withIds.filter(s => !removeSet.has(s.id))

// write the bank via an agent (Write tool), returning stats only
const catCounts = {}
finalBank.forEach(s => { catCounts[s.cat] = (catCounts[s.cat] || 0) + 1 })
await agent(
  `Use the Write tool to write EXACTLY this JSON (pretty-printed with indent 1) to the file ${SP}/sources.json — do not alter, reorder, add or remove anything. Then run: python3 -c "import json; d=json.load(open('${SP}/sources.json')); print('valid', len(d))" via Bash to confirm it parses, and report the count.\n\n${JSON.stringify(finalBank)}`,
  { label: 'write:sources.json', phase: 'Synthesize', effort: 'low' }
)

return { total: finalBank.length, byCategory: catCounts, droppedDead: dropped.length, corpusCount: fromCorpus.length, webCount: fromWeb.length, reviewRemoved: removeSet.size, reviewNotes: (review && review.notes || '').slice(0, 400) }