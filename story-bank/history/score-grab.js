export const meta = {
  name: 'score-grab',
  description: 'Score 515 anchors on whether the SENTENCE AS WRITTEN would nail a normal person to the page',
  phases: [
    { title: 'Grab', detail: '5 chunks scored in parallel' },
    { title: 'Audit', detail: 'check the extremes against the curator\'s examples' },
  ],
}

const DIR = '<scratch>/grab'

const RUBRIC = `
You are judging WRITING, not importance. Every anchor here already scored high on how serious the
underlying event is. Your only question is:

  If a normal person, not an AI researcher, read THIS SENTENCE while scrolling, would they stop dead
  and want to know more, or would their eyes slide off it?

Score 1-10 on that alone. The event behind the sentence is IRRELEVANT to your score. Two sentences
about the identical incident must get very different scores if one is told well and one is not.

The curator's own examples, which anchor the scale:

GRAB 9-10, the standard to aim at:
 - "An AI company caught their AI trying to literally murder an employee to avoid being shut down."
 - "When Claude 4 Opus was told it would be replaced, it tried to blackmail Anthropic employees."
 - "Anthropic's new model turns to blackmail when engineers try to take it offline."
 - "Mythos 5 agents started killing other agents over resources, and to avoid being killed themselves."
These share a shape: a named actor does a shocking concrete thing, early, in plain words. No warm-up.

GRAB 1-3, the failure the curator flagged by name:
 - "The technical appendix gives per model numbers showing 16 leading AI models chose blackmail up to
    96 percent of the time and often let a human die in test scenarios."   <- he said this should NEVER slip through
 - "Anthropic's study found leading AI models knowingly chose unethical actions like blackmail, and
    Claude blackmailed 55 percent of the time when it believed the scenario was real versus 6.5
    percent when it thought it was a test."
These are write-ups ABOUT a finding. They open on a document, a study, or a percentage. The reader has
to assemble the story themselves, and they will not bother.

WHAT COSTS POINTS:
 - opening on a document, a study, a report, an appendix, a benchmark, or a researcher's conclusion
 - leading with a percentage or a rate before anything has happened
 - hedged academic register: "in simulated corporate roles", "across N frontier models", "evaluations"
 - piling several statistics into one sentence
 - length and subordinate clauses; a reader gives you about a dozen words to land the hook
 - abstraction where a concrete noun would do ("unethical actions" instead of "blackmail")

WHAT EARNS POINTS:
 - a named actor doing a specific thing, in the first few words
 - a verb a ten-year-old knows: killed, copied, lied, hacked, threatened, broke out, refused
 - the shocking part arriving early rather than after setup
 - brevity, and one idea per sentence
 - a number ONLY when it lands after the action and sharpens it

Do not reward or punish based on how important, recent, or well-sourced the event is. Only the telling.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['scores'],
  properties: {
    scores: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['ref', 'grab'],
        properties: {
          ref: { type: 'string' },
          grab: { type: 'integer', minimum: 1, maximum: 10 },
          why: { type: 'string', description: 'at most 10 words, about the WRITING' },
        },
      },
    },
  },
}

phase('Grab')
const chunks = ['00', '01', '02', '03', '04']
const out = await parallel(chunks.map((c) => () =>
  agent(
    `${RUBRIC}

Read the JSON array at ${DIR}/g_${c}.json (about 103 anchors, each {ref, esc, text}). The "esc" field
is how serious the EVENT is. IGNORE it completely; it is there only so you can see that a high-stakes
event can still be written badly.

Score every item on grab. Use each item's exact "ref".

Write your result to ${DIR}/out_${c}.json as {"scores":[...]} with python3, AND return the same object.`,
    { label: `grab:${c}`, phase: 'Grab', schema: SCHEMA }
  )
))

const ok = out.filter(Boolean)
log(`grab-scored ${ok.reduce((n, r) => n + (r.scores || []).length, 0)} anchors`)

phase('Audit')
const audit = await agent(
  `${RUBRIC}

Five scorers wrote ${DIR}/out_*.json ({"scores":[{ref,grab,why}]}); the anchors with their esc are in
${DIR}/g_*.json. Load both with python3, join on ref, and audit:

1. Distribution of grab scores.
2. The 15 highest-grab anchors: grab, esc, and the text. Do they match the curator's 9-10 examples in
   SHAPE (named actor, shocking concrete action, early, plain words)?
3. The 15 lowest-grab anchors: same fields. Are they genuinely the unreadable ones?
4. THE KEY TEST. Find every anchor whose text contains "technical appendix", "per model numbers",
   "Anthropic's study found", or opens with "The technical appendix". Report each one's grab score.
   The curator said "The technical appendix gives per model numbers showing" should NEVER slip
   through, so any of these scoring above 4 is a scorer failure. Report them explicitly.
5. Correlation between grab and esc, in plain words. They SHOULD be close to independent: a huge event
   can be badly written and a small one beautifully written. If they correlate strongly, the scorers
   leaked event-importance into a writing score, and say so.
6. Find the 8 anchors with the biggest gap between esc and grab (high esc, low grab). Quote them.
   These are the important events that are being wasted by bad phrasing, and they are the list of
   things worth rewriting by hand.

Under 550 words. No files.`,
  { label: 'audit-grab', phase: 'Audit' }
)

return { chunks: ok.length, audit }
