export const meta = {
  name: 'score-aism-recent',
  description: 'Score 90 unseen AI Safety Memes tweets for video-idea strength and pick the ones worth putting at the top',
  phases: [
    { title: 'Score', detail: 'rate each tweet on how far the AI went and whether a reader stops scrolling' },
    { title: 'Pick', detail: 'cross-check the top set and write anchor records' },
  ],
}

const FILE = '/tmp/_aism_score.json'

const SCHEMA = {
  type: 'object',
  properties: {
    tweets: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          i: { type: 'integer' },
          esc: { type: 'integer', description: '1-10: how far the AI actually went. 10 = it acted to preserve itself, deceived, escaped, or killed. 1 = an opinion or a joke.' },
          grab: { type: 'integer', description: '1-10: would a normal person stop scrolling. 10 = they cannot not read it. 1 = inside baseball.' },
          usable: { type: 'boolean', description: 'false if it is a meme, a screenshot of an opinion, a reply, self-promotion, or has no concrete event in it' },
          shows: { type: 'string', description: 'The event as a flat statement, ACTOR FIRST, reusing the tweet wording wherever it is already blunt and plain. No commentary. If the tweet names a company, model or number, keep it.' },
          title: { type: 'string', description: 'short label, 4-9 words' },
          cat: { type: 'string', enum: ['capabilities-trajectory','expert-warnings','agents-in-the-wild','governance-policy','jobs-economy','incidents','scheming-deception','consciousness-welfare','weapons-war','companions-parasocial','power-concentration','scenarios-forecasts','other'] },
          why: { type: 'string', description: 'one line: why this would or would not make a video someone watches' },
        },
        required: ['i','esc','grab','usable','shows','title','cat','why'],
      },
    },
  },
  required: ['tweets'],
}

phase('Score')
const groups = [[0,15],[15,30],[30,45],[45,60],[60,75],[75,90]]
const scored = await parallel(groups.map(([a,b]) => () =>
  agent(
    `Read ${FILE}. It is a JSON array of AI Safety Memes tweets, each with an index i, a date, view count, and text.\n\n` +
    `Score ONLY the entries with i from ${a} to ${b-1} inclusive. Return one object per entry, using its real i.\n\n` +
    `Context: these feed a tool that pitches AI-risk video ideas to YouTube creators. An anchor is a REAL THING THAT ` +
    `HAPPENED that a video can open on. The bar that matters is: would a normal person, mid-scroll, stop dead?\n\n` +
    `Scoring guidance, learned from the curator's own marks:\n` +
    `- esc is how far the AI went in the world. An AI that blackmailed, escaped, copied itself, killed, hacked, or hid ` +
    `  from its makers scores 8-10. A capability demo scores 4-6. A person's opinion about AI scores 1-3.\n` +
    `- grab is stopping power. Concrete + specific + a named party + a hard number scores high. Abstract commentary, ` +
    `  "this is why X matters", and inside-baseball discourse score low.\n` +
    `- usable=false for: memes with no event, screenshots of someone's take, replies to other accounts, jokes, ` +
    `  self-promotion, or anything where you cannot name what actually happened.\n` +
    `- The curator has said repeatedly: NEVER make AI look weak, dumb, gullible or overhyped. A tweet whose point is ` +
    `  "AI is a flop" or "this was overhyped" is usable=false no matter how funny it is.\n\n` +
    `For "shows": write the event flatly, actor first. AI Safety Memes writes these better than we do, so REUSE ITS ` +
    `WORDING where it is already plain and blunt. Do not smooth it, do not make it more formal. Keep every company ` +
    `name, model name and figure. Never invent a detail that is not in the tweet.`,
    { label: `score:${a}-${b}`, phase: 'Score', schema: SCHEMA, effort: 'high' }
  )
))

const all = scored.filter(Boolean).flatMap(r => r.tweets || [])
const usable = all.filter(t => t.usable && Math.min(t.esc, t.grab) >= 6)
usable.sort((x, y) => (Math.min(y.esc, y.grab) - Math.min(x.esc, x.grab)) || (y.grab - x.grab))
log(`scored ${all.length}, usable at rank 6+: ${usable.length}`)

phase('Pick')
const check = await agent(
  `These are the strongest of 90 recent AI Safety Memes tweets, scored for use as opening anchors in AI-risk video ` +
  `pitches. Read ${FILE} for the original text of any index you want to check.\n\n` +
  JSON.stringify(usable, null, 1).slice(0, 22000) + '\n\n' +
  `Do three things:\n` +
  `1. REMOVE any where "shows" states something the tweet does not actually support, or where a company/model/number ` +
  `   appears that is not in the source text. Fabrication here is the worst failure this tool has.\n` +
  `2. REMOVE any that make AI look weak, dumb, overhyped or like a grift, and any that are really just someone's ` +
  `   opinion rather than an event.\n` +
  `3. REMOVE near-duplicates, keeping the better-told version.\n\n` +
  `Return the survivors as JSON: {"keep": [{"i": <int>, "esc": <int>, "grab": <int>, "shows": "...", "title": "...", ` +
  `"cat": "...", "note": "one line on why this earns a top slot"}]} ordered strongest first.`,
  { label: 'cross-check', phase: 'Pick', effort: 'max' }
)

return { scored: all.length, usable: usable.length, check }
