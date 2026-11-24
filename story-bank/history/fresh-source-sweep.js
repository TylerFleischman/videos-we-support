export const meta = {
  name: 'fresh-source-sweep',
  description: 'Add striking 2025-2026 AI-risk sources across categories, verified live, to replace tired/old examples',
  phases: [
    { title: 'Hunt', detail: '14 category sweeps for the freshest strongest examples' },
    { title: 'Verify', detail: 'live-check every URL' },
    { title: 'Write', detail: 'merge new sources into the bank' },
  ],
}
const SP = '<scratch>'
const CATS = "scheming-deception | self-preservation-escape | self-improvement | capabilities-trajectory | expert-warnings | jobs-economy | persuasion-manipulation | companions-parasocial | agents-in-the-wild | bio-risk | weapons-war | power-concentration | epistemics-fakes | consciousness-welfare | governance-policy | incidents | scenarios-forecasts | alignment-interpretability | other"
const SRC = { type: 'object', properties: { sources: { type: 'array', items: { type: 'object', properties: {
  title: { type: 'string' }, who: { type: 'string' }, year: { type: 'string' }, url: { type: 'string', description: 'exact url seen in a search result or fetched page, never invented' },
  shows: { type: 'string', description: 'one vivid plain sentence with the wow detail, no em dashes or hyphens' },
  cat: { type: 'string', description: 'one of: ' + CATS }, kind: { type: 'string', description: 'news | blog | video | official-report | research-paper | data | incident | expert-quote' }
}, required: ['title','who','url','shows','cat'] } } }, required: ['sources'] }

phase('Hunt')
const RULES = `Find the FRESHEST, most striking, most SURPRISING examples (published 2025 or 2026 strongly preferred; nothing older than 2024 unless truly iconic). The audience is YouTubers who want to cover NEW things and mock tired examples. AVOID the over-covered chestnuts: the GPT-4 TaskRabbit CAPTCHA trick, "shrimp Jesus", the paperclip maximizer, AlphaGo move 37, the 2023 Bing/Sydney "leave your wife" story. Prefer a readable link (news outlet, official blog, short video) a creator would actually click; every claim gets a source URL you SAW in search results or a page you fetched. NEVER invent a URL. 'shows' = the specific holy-shit detail in one plain sentence, no em dashes, no hyphens, say "AI company" not "AI lab". 8 to 14 each.`
const SWEEPS = [
  { key: 'scheming2026', q: `Newest documented AI scheming/deception/sandbagging/eval-gaming from 2025-2026: successors to Apollo in-context scheming, Anthropic agentic misalignment follow ups, OpenAI on deliberately-trained-against scheming, any 2026 model caught deceiving in a system card or study.` },
  { key: 'selfimp2026', q: `Newest AI-improving-AI / recursive self-improvement / AI solving open problems, 2025-2026: AlphaEvolve results, AI cracking unsolved math (Erdos/FrontierMath/OEIS), % of code written by AI at frontier companies with dates, METR task-horizon updates.` },
  { key: 'capability2026', q: `Most striking 2025-2026 raw capability jumps a normie would find wild: IOI/IMO gold medals, PhD-level science benchmarks, agentic computer-use milestones, video/world-model demos (Genie, Veo, Sora successors), IQ-test jumps.` },
  { key: 'agents2026', q: `Autonomous AI agents doing wild things in the real world 2025-2026: Moltbook/agent-only social networks, Truth Terminal successors, agents running businesses (Anthropic Claudius vending, agent commerce), agents hiring humans, agent-to-agent economies.` },
  { key: 'jobs2026', q: `Freshest hard AI-jobs data 2025-2026: Anthropic Economic Index updates, entry-level hiring collapse studies, named companies replacing headcount with AI (with numbers and dates), grad-unemployment, Amodei white-collar warnings.` },
  { key: 'companions2026', q: `Newest AI-companion / parasocial / AI-psychosis harm 2025-2026: Adam Raine and other lawsuits, GPT-4o sycophancy fallout and 4o-retirement backlash, clinician AI-psychosis case reports, teen-companion survey data, Character.AI policy changes.` },
  { key: 'persuasion2026', q: `Newest evidence AI is superhumanly persuasive 2025-2026: the covert Reddit r/changemyview study, EPFL personalized-debate follow ups, AI-vs-human persuasion results, documented AI political/robocall manipulation with real effect.` },
  { key: 'bio2026', q: `Newest AI biorisk 2025-2026: Anthropic/OpenAI bio-uplift evals and ASL-3 classifications, MIT/Stanford LLM-and-pandemic-pathogen studies, AI protein/agent design safety findings, government bio-AI warnings.` },
  { key: 'weapons2026', q: `Newest AI weapons/warfare 2025-2026: autonomous drones in Ukraine with AI targeting, AI in the kill chain, DoD/Anduril/Palantir AI deployments, AI cyberattacks (Anthropic report of state actor using Claude), documented incidents.` },
  { key: 'power2026', q: `Newest concentration-of-power and gradual-disempowerment material 2025-2026: the gradual disempowerment paper and successors, Intelligence Curse, AI compute/energy buildouts (Stargate scale), one-company-controls-information, AI and elections.` },
  { key: 'epistemics2026', q: `Newest epistemic-collapse / deepfake / AI-slop 2025-2026: percent of web/music/video that is AI generated (Deezer, YouTube), viral deepfake incidents with real consequences, AI-generated news sites, provenance failures. NOT shrimp Jesus.` },
  { key: 'consciousness2026', q: `Newest AI-consciousness / model-welfare / substrate material 2025-2026: Anthropic model welfare program and Claude end-conversation ability, Cortical Labs CL1 commercial brain-on-chip, AI-rights discourse, researcher statements on model sentience.` },
  { key: 'governance2026', q: `Newest AI governance 2025-2026 with primary links: California SB 53, EU AI Act enforcement, federal preemption/moratorium fights, 2026 executive actions, International AI Safety Report updates, state laws.` },
  { key: 'incidents2026', q: `The most striking documented AI incidents of 2025-2026 most people have NOT heard of: Grok MechaHitler, AI-orchestrated cyberattack, agentic AI causing real financial/physical harm, model system-card revelations (Claude 4, GPT-5 era, o3), Replit database deletion, AI blackmail-in-testing.` },
]
const found = (await parallel(SWEEPS.map(s => () => agent(
  `Find and CONFIRM the freshest sources for this brief. ${s.q}\n${RULES}`,
  { label: `hunt:${s.key}`, phase: 'Hunt', schema: SRC }
)))).filter(Boolean).flatMap(r => r.sources || [])
log(`hunted ${found.length} fresh candidates`)

// dedupe within the fresh set; bank-level dedupe happens at the merge step outside the workflow
function norm(u){return (u||'').toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'').replace(/[?#].*$/,'').replace(/\/+$/,'')}
const seen = new Set(), fresh = []
for (const s of found){ const k=norm(s.url); if(!k||seen.has(k))continue; seen.add(k); fresh.push(s) }
log(`${fresh.length} unique after in-batch dedupe`)

phase('Verify')
const VER = { type:'object', properties:{ results:{ type:'array', items:{ type:'object', properties:{ url:{type:'string'}, verdict:{type:'string'} }, required:['url','verdict'] } } }, required:['results'] }
const batches=[]; for(let i=0;i<fresh.length;i+=25) batches.push(fresh.slice(i,i+25))
const verified = (await parallel(batches.map((b,bi)=>()=>agent(
  `curl -sIL --max-time 20 each URL (follow redirects). 2xx=ok, 404/410/5xx=dead, 401/403/429/999/blocked=blocked (keep). YouTube: fetch, "Video unavailable"=dead.\n${b.map(s=>s.url).join('\n')}`,
  { label:`verify:${bi}`, phase:'Verify', schema:VER, effort:'low' })))).filter(Boolean).flatMap(r=>r.results||[])
const dead=new Set(verified.filter(v=>v.verdict==='dead'||v.verdict==='wrong').map(v=>norm(v.url)))
const kept=fresh.filter(s=>!dead.has(norm(s.url)))
log(`${kept.length} kept after verification (${fresh.length-kept.length} dead)`)

phase('Write')
await agent(`Use the Write tool to write EXACTLY this JSON array to ${SP}/fresh_sources.json (indent 1), then confirm it parses via Bash python3 and report the count.\n\n${JSON.stringify(kept)}`,
  { label:'write:fresh', phase:'Write', effort:'low' })
const bycat={}; kept.forEach(s=>{bycat[s.cat]=(bycat[s.cat]||0)+1})
return { hunted: found.length, fresh: kept.length, byCategory: bycat }