# Writing brief: one idea per story, for one channel

Give this to whoever writes the ideas (a person or an agent), together with the channel's
`channel.json` and its `shortlist.md`. It is the generator's rules from `backend/main.py`
(`IMPORTANCE_BAR`, `TRUTH`, `WORDING`, `TRAJECTORY`, `READING_LEVEL`, `ANTI_SLOP`), cut down to what
a short creator-page idea needs. When the two disagree, `main.py` wins and this file should be fixed.

## What you are writing

Each story on the page gets one example video and at least one idea:

- **Story text**: one or two sentences, `In <Month Year>, <publisher> reported that ...`, then the bank's
  `shows` sentence. Add nothing the `shows` sentence does not say. If the bank's source is a post on X,
  link the news or official version of the same event instead, and say only what you have read in it.
- **Idea title**: a title the channel could actually publish, in its own title patterns
  (`channel.json` → `profile.title_patterns`). Up to 70 characters.
- **Logline**: 3 to 5 short sentences, 30 to 85 words. Open on the real thing that happened, actor
  first and named. Give the one detail that makes it land. End on where it goes if it keeps going.
- **Link**: the story's source link, so the creator's first click is the evidence.

## Rules

1. **Grounding.** Every fact in a title or logline is in the story text. Numbers are frozen: never round,
   restate or invent one, and keep the year on a dollar figure. Hedges are frozen too: *allegedly*, *says*,
   *may*, *cannot rule out*, *claimed* stay exactly as strong as the source. The forward-looking last
   line reads as projection (*could*, *where this goes*), never as something that happened.
2. **Importance.** Would people who have spent their lives on AI risk say the public needs to know this?
   Cut scams, AI mistakes, energy and water, privacy gripes and pricing. Never frame AI as a race to win.
3. **Trajectory.** The event is the hook; the point is where the trend leads. Carry it past one victim
   or one industry to what happens when it is everywhere.
4. **Voice.** Say *AI* or *AIs*, never *AI system*, *model* (except a named one), *frontier* or *LLM*.
   Say *AI company*, never *AI lab*. Prefer *deceive* or *scheme* over *lie*.
5. **Reading level.** About grade 5: 10 to 16 words a sentence, one idea each, everyday words, people
   doing things instead of abstract nouns. Not a run of fragments either.
6. **Talk about the world, not the creator.** The logline never names the channel, its audience or its
   back catalogue, and never describes the video (*a deep dive that*, *walks through*). The title may use
   the channel's own title format.
7. **No AI tells.** No *not just X but Y*, *delve*, *underscore*, *testament*, *landscape*, *crucial*,
   *it's worth noting*, *let that sink in*, *here's the scary part*, *experts say*. No telling the viewer
   what they think or feel.
8. **Harm.** Awareness, never instructions. For bio, chemical and weapons stories, say what happened and
   why it matters, never how it was done. For suicide and self-harm stories, no method detail.

## The example video

Pick it from `video-pool.json` (built by the demo repo's `tools/video-pool.js`): a video already on an
approved page whose subject is closest to the story, ideally one this channel's audience would also
watch. Copy its fields exactly; the checker compares them to the pool. Try not to repeat a video.

`check_page.py` enforces rules 1, 4, 6, 7 and the video, link and anchor checks. Rules 2, 3, 5 and 8
need a reader.
