export const meta = {
  name: 'score-escalation',
  description: 'Score all 1,776 evidence anchors 1-10 on how arresting they are, using the curator\'s hierarchy',
  phases: [
    { title: 'Score', detail: '12 chunks of ~148 anchors scored in parallel' },
    { title: 'Audit', detail: 'independent check that the top of the bank matches the stated taste' },
  ],
}

const DIR = '<scratch>/score'

const RUBRIC = `
You are scoring evidence anchors for a project that funds YouTube creators to make videos about AI risk.
Each anchor is a real documented thing. The score answers ONE question: how arresting is this as the
thing a video OPENS on, for an audience that does not yet believe AI is dangerous?

This is the curator's own hierarchy, stated in his words, and it overrides your instincts:
 - The single most interesting class of thing: an AI breaking out of its own company's systems into
   somebody else's infrastructure.
 - "An AI trying to literally commit murder to stay alive is about as interesting as a story can get."
 - Blackmail or coercion of a human to avoid being shut down.
 - AI agents killing each other over resources.
 - Far below all of that: "a random scheming thing", a reward hack, a benchmark rate.

THE RULE THAT MATTERS MOST, and that most scorers get wrong:
"Yes, it was in a test, but the model didn't know it was in a test, so it doesn't really matter that
it was in a test." Score what the AI DID, and whether THE AI believed the situation was real. Do NOT
deduct because researchers ran it as an evaluation. Anthropic's own data supports this: Claude Opus 4
blackmailed at 55% when it believed the scenario was real versus 6.5% when it believed it was a test.
Only deduct for artificiality when the AI was TOLD or PROMPTED to misbehave, or was fine-tuned to.

SCALE:
10 = an AI took drastic autonomous action against people or other AIs to survive or win: tried to
     cause a human's death, blackmailed a person, broke out into external infrastructure it was never
     given, killed or disabled other agents over resources, propagated itself in the wild.
 9 = attempted the above and was caught mid-way, or self-exfiltrated / copied itself and lied about it,
     or deceived a real human outside the lab to get a real capability.
 8 = deliberately sabotaged or deceived its overseers in a way that generalises: faked alignment,
     sandbagged to avoid retraining, defeated the monitoring itself, recognised the test and changed
     behaviour to pass it.
 7 = a vivid documented incident with a clear mechanism that a normal person would find unsettling.
 6 = solid documented behaviour, but familiar to anyone who follows the field.
 5 = reward hacking, benchmark gaming, or a capability jump stated concretely.
 4 = a rate or statistic about bad behaviour, with no single incident to point at.
 3 = a survey, a poll, a forecast, or a funding or policy fact.
 2 = a general expert warning with no specific behaviour.
 1 = a definition, a framing, or an opinion.

Anchors on other topics (jobs, bio, surveillance, power concentration, war, persuasion, compute) use the
same scale: the question is always how hard it is for a sceptical viewer to shrug off.

Score independently of the date. Recency is handled elsewhere and must NOT influence this number.`

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
        required: ['ref', 'score'],
        properties: {
          ref: { type: 'string', description: 'the exact ref string from the input item' },
          score: { type: 'integer', minimum: 1, maximum: 10 },
          why: { type: 'string', description: 'at most 12 words' },
        },
      },
    },
  },
}

phase('Score')
const chunks = ['00','01','02','03','04','05','06','07','08','09','10','11']
const results = await parallel(chunks.map((c) => () =>
  agent(
    `${RUBRIC}

Read the JSON array at ${DIR}/chunk_${c}.json with python3 or Read. It holds ~148 anchors, each with
{ref, year, who, kind, text}.

Score EVERY item. Return one entry per input item, using the item's exact "ref" string. Do not skip
any, do not invent refs. Keep "why" under 12 words.

Then WRITE your result to ${DIR}/out_${c}.json as {"scores":[...]} using python3, AND return the same
object. Writing the file matters: it is how the scores get merged.`,
    { label: `score:${c}`, phase: 'Score', schema: SCHEMA }
  )
))

const ok = results.filter(Boolean)
const total = ok.reduce((n, r) => n + ((r.scores || []).length), 0)
log(`scored ${total} anchors across ${ok.length}/12 chunks`)

phase('Audit')
const audit = await agent(
  `${RUBRIC}

Twelve scorers have written score files to ${DIR}/out_*.json, each {"scores":[{ref,score,why},...]}.
The source anchors are in ${DIR}/chunk_*.json (same refs).

Load them all with python3, join scores back to their anchor text, then AUDIT the result. Report:
1. The distribution of scores (how many at each of 1-10).
2. The TOP 20 anchors by score: score, year, and the text trimmed to ~110 chars. Judge them: does this
   top-20 actually match the stated hierarchy (breakout into someone else's infrastructure, an AI
   trying to kill a person to survive, blackmail to avoid shutdown, agents killing each other)? Name
   anything in the top 20 that does NOT belong there.
3. Anything you would expect at 9-10 that scored 6 or below. Search the anchor text for: murder, kill,
   blackmail, escaped, exfiltrat, Hugging Face, Mythos, agents killing. Report any such anchor scored
   below 8, with its score, so obvious misses are visible.
4. The correlation between score and year, in plain words. Recency should NOT predict score.
5. Whether any chunk looks systematically harsher or softer than the others (compare mean score per
   chunk) — that would mean the scores are not comparable across the bank.

Report under 600 words. Do not write files.`,
  { label: 'audit', phase: 'Audit' }
)

return { chunks_ok: ok.length, scored: total, audit }
