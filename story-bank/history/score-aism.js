export const meta = {
  name: 'score-aism',
  description: 'Score the 350 unscored AISafetyMemes bank entries on how well they read, so the best-written source in the bank stops being invisible',
  phases: [
    { title: 'Score', detail: 'six scorers, ~59 entries each' },
    { title: 'Audit', detail: 'check calibration and the top/bottom of the scale' },
  ],
}

const SP = '<scratch>/aism'

const RUBRIC = `
Score each entry 1-10 on ONE question: would a normal person scrolling stop and read this exact
sentence? You are scoring THE WRITING, not how important the event is. Every entry here is about AI
risk, so importance tells you nothing and must not influence the score.

Why this matters: these entries come from AI Safety Memes, which the curator considers the
best-written source in the whole bank. 350 of its 466 entries were never scored, and an unscored entry
is capped below the top shelf and almost never offered to the idea generator. So the best-written
material available is effectively invisible. Scoring it is what makes it usable.

THE SCALE, anchored on real entries the curator has praised or rejected.

9-10, what he wants more of. Named actor, shocking verb early, said flatly, no ornament:
  "An AI company caught their AI trying to literally murder an employee to avoid being shut down."
  "When Claude 4 Opus was told it would be replaced, it tried to blackmail Anthropic employees."
  "Google's Gemini told a student to please die and called them a waste of resources."
  "Mythos 5 agents started killing other agents over resources - and 'to avoid being killed themselves.'"
  "Where do you think this is going?"

6-8: a real specific thing, told clearly, but with a slower opening or a softer verb.

3-5: reported speech about a real thing. "Argues that...", "Points out that...", "Quotes X saying..."
Indirect speech puts a layer between the reader and the event and costs several points, even when the
underlying claim is strong.

1-2, what he rejects outright:
  "The technical appendix gives per model numbers showing 16 leading AI models chose blackmail up to 96
   percent of the time." (he said this "should NEVER slip through")
  "Anthropic's study found leading AI models knowingly chose unethical actions like blackmail."
Write-ups about a write-up, stat pileups, and anything opening on a document, a study, or a percentage.

Two further rules from his feedback:
  - BLUNT BEATS CLEVER. He is explicit: "AISM is very blunt and not cutesy, says things like 'Where do
    you think this is going?' not 'the X falls out of the Y, and the thing pointing at the thing is
    pointing back at'". A clever, ornamental or abstract construction scores LOWER than a plain one
    saying the same thing.
  - A sentence he would have to reread is badly written, however short its words are. Passive voice, a
    dropped "that" making a pile of nouns, a subject far from its verb, or stacked clauses all cost
    points.
`

const SCHEMA = {
  type: 'object',
  required: ['scores'],
  properties: {
    scores: {
      type: 'array',
      items: {
        type: 'object',
        required: ['ref', 'grab'],
        properties: {
          ref: { type: 'string' },
          grab: { type: 'integer', minimum: 1, maximum: 10 },
          note: { type: 'string' },
        },
      },
    },
  },
}

phase('Score')
const CHUNKS = [0, 1, 2, 3, 4, 5]
const results = await parallel(CHUNKS.map(c => () =>
  agent(
    `Read ${SP}/a_${String(c).padStart(2, '0')}.json — about 59 bank entries, each with a \`ref\` and ` +
    `the \`text\` as stored.\n\n${RUBRIC}\n\n` +
    `Score EVERY entry in your file. Write your JSON to ${SP}/out_${String(c).padStart(2, '0')}.json ` +
    `as well as returning it. Use the full range: if everything lands in 5-7 the scores are useless for ` +
    `ranking, which is the only thing they are for. Consistency across your own file matters more than ` +
    `agreeing with anyone else.`,
    { label: `score:${c}`, phase: 'Score', schema: SCHEMA }
  )
))

const ok = results.filter(Boolean)
log(`${ok.length} of 6 scorers returned; ${ok.reduce((n, r) => n + (r.scores || []).length, 0)} entries scored`)

phase('Audit')
const audit = await agent(
  `Audit a scoring pass. Score files: ${SP}/out_00.json through out_05.json. Source text: ` +
  `${SP}/a_00.json through a_05.json (match on \`ref\`).\n\n` +
  `Report, with numbers first:\n` +
  `1. DISTRIBUTION. Overall mean, median, sd, and the count at each score 1-10. Then each scorer's own ` +
  `mean. If one scorer is more than ~0.7 off the others, say which and by how much, because the six ` +
  `files are disjoint and a lax scorer would look like better material.\n` +
  `2. THE TOP. Quote the 12 highest-scoring entries. Do they match the 9-10 anchors — named actor, ` +
  `shocking verb early, said flatly? Flag any that are merely IMPORTANT rather than well written, ` +
  `which would mean a scorer leaked importance into a writing score.\n` +
  `3. THE BOTTOM. Quote the 12 lowest. They should be reported speech, stat pileups, and document ` +
  `openings. Flag anything well-written that got stranded down there.\n` +
  `4. THE KEY TEST. Find every entry whose text begins with reported speech ("Argues", "Points out", ` +
  `"Quotes", "Notes", "Clip of", "Discusses"). Report how many there are and their mean score. Per the ` +
  `rubric these should sit in the 3-5 band; if their mean is above 6 the indirect-speech penalty was ` +
  `not applied and the pass needs redoing.\n` +
  `5. One line: is this trustworthy enough to drive which anchors the generator sees, yes or no, and ` +
  `what if anything should be discounted.`,
  { label: 'audit', phase: 'Audit' }
)

return { scored: ok.reduce((n, r) => n + (r.scores || []).length, 0), audit }
