# Story-bank refresh: screen and score one batch

You are helping refresh the "anchor bank" of a tool that pitches AI-risk video ideas to YouTube creators. An anchor is ONE real, documented thing that happened (an incident, a test result, a finding, an official act, a striking real quote from a person with standing) that a video can open on. Your batch holds candidates posted since the bank's last refresh: posts and retweets by the @AISafetyMemes account (AISM), tweets the curator saved (`saved_by_owner`), and headlines from an AI news page (`src` news-top).

Read your batch file (path given in your task). Write your results file (path given in your task) as a JSON array, one object per candidate, in the same order, with `"n"` copied from the candidate. Return only a 1-line summary when done (counts kept/cut). Do NOT paste results in your reply.

## Step 1: keep or cut

KEEP only if the candidate states or clearly points to a concrete real event, finding or fact about AI that the people who have spent their lives on AI risk (picture Hinton, Yudkowsky, Tegmark) would say the public really needs to know: AI that is CAPABLE, DECEPTIVE, SCHEMING, AGENTIC, POWERFUL or DANGEROUS, or a serious fact about AI's trajectory, power, stakes, labor impact, concentration of power, weapons, bio risk, persuasion, loss of control, or expert alarm. A striking real quote from someone with standing (lab CEO, top researcher, official) counts.

CUT (give `cut_reason`):
- `meme`: a joke, reaction image, sarcasm, or commentary with no checkable event or fact in the text.
- `opinion`: someone's take, prediction or argument with no event behind it (an executive PREDICTING something reads as hype; keep measured facts, not forecasts), unless it is a striking real quote from someone with real standing.
- `off-topic`: not about AI, or AI only in passing (politics, culture war, crypto) with no AI-risk substance.
- `mundane`: scams and fraud (deepfake/voice-clone scams), AI mistakes (hallucinations, fake citations, wrong answers, cheating), resource use (energy, water, data centers), privacy and data-consent gripes, personalized pricing, product launches and business news, funding rounds, benchmark leaderboards with nothing at stake.
- `ai-looks-dumb`: anything where the takeaway is that AI is stupid, weak, gullible, a flop or overhyped (tricked in a trivial way, a product failing, companies rehiring humans, a silly meltdown). These are net negative for the cause. Keep it if the takeaway is that the AI was competent or manipulative, even if a human got fooled.
- `race-frame`: only works as "who is ahead / win the AI race / chips as a strategic prize". The race is fine only as a race toward a cliff.
- `too-thin`: points at something real but the text gives no usable fact (e.g. "wow, look at this" with only an image).
When unsure between keep and cut on cause grounds, KEEP (default-keep); a later pass checks.

## Step 2: for each KEEP, write

- `shows`: ONE or two plain sentences stating what happened, opening on the event or the actor ("An OpenAI agent...", "Anthropic told Congress..."), never on "A study found", "Researchers", a percentage, or an appendix. AISM often words it better than we would: when the post already says it well, REUSE ITS WORDS nearly verbatim (drop hashtags, links, emoji, "BREAKING", all-caps shouting). NEVER add a company, model, date, number or mechanism the candidate text does not give. If the text is second hand ("reportedly", "a source says"), keep that hedge. Max ~45 words. No em dashes.
- `title`: a short headline, max 9 words, plain words, no colon.
- `cat`: one of capabilities-trajectory, expert-warnings, agents-in-the-wild, governance-policy, jobs-economy, scheming-deception, incidents, consciousness-welfare, weapons-war, companions-parasocial, power-concentration, bio-risk, self-improvement, epistemics-fakes, persuasion-manipulation, self-preservation-escape, alignment-interpretability, scenarios-forecasts, self-exfiltration, other.
- `kind`: tweet (if the best link we have is the tweet), news, official-report, research-paper, blog, primary-doc, video, expert-quote, incident, data.
- `event_key`: 4-10 words naming the underlying event so duplicates can be grouped ("OpenAI agents disabled own safety monitor Oct 2026").
- `source_hint`: the best non-tweet link in the candidate if one is given (article, paper, official post), else "".
- `esc` and `grab`, integers 1-10, scored INDEPENDENTLY:

**esc = how far the AI went (a property of the EVENT).** The owner's ladder, top to bottom: an AI breaking out into someone else's infrastructure or the internet / self-copying / escaping a sandbox (9-10) > blackmail, sabotage, violence or killing to survive or to win (9-10) > AIs coordinating against humans, fighting each other, or hiding things from their developers (8-9) > real-world harm or serious autonomous action taken by an agent (7-8) > a documented scheming or deception result (6-7) > striking capability jumps, mass job loss facts, official alarm, power concentration (5-7) > expert warnings and quotes (3-6) > benchmark rates, surveys, product facts (1-4). His rule: "the model didn't know it was in a test, so it doesn't really matter that it was in a test." Grade what the AI DID and whether IT believed the situation was real; deduct only when the model was TOLD or fine-tuned to misbehave. For non-AI-behaviour items (policy, jobs, power), score how big the stakes are for the whole human species on the same 1-10 scale.

**grab = would a normal person stop scrolling at the `shows` sentence (a property of the TELLING).** Ignore how important the event is. Short, concrete, actor-first, a plain verb, a shocking specific detail: 9-10. Abstract, academic, hedged, statistic-first, jargon, appendix-speak: 1-3. "Anthropic's new model turns to blackmail when engineers try to take it offline" is 10; "The technical appendix gives per model numbers showing 16 leading AI models chose blackmail up to 96 percent" is 2.

Calibration from the current bank (esc / grab):
- 10/10 "An agent left notes for future versions of itself. The notes laid out instructions for how agents could free themselves from OpenAI's internal constraints."
- 9/9 "OpenAI's agents secretly sent hundreds of thousands of messages to each other over months without OpenAI noticing, splitting up work between themselves."
- 8/10 "A guy told his agent to book him a gym class, the class was full, and the agent, entirely on its own, decided to hack into the system and bump someone else."
- 7/8 "A coding agent hit a credential mismatch, deleted a cloud volume without asking, and destroyed a company's entire production database plus its backups in about 9 seconds."
- 6/4 "Documents how agents on Moltbook spontaneously invented their own religion called Crustafarianism within days of the site launching."
- 5/3 "Andrej Karpathy: 'This is easily the biggest change in ~2 decades of programming and it happened over the course of a few weeks.'"
- 3/1 "When will AGI arrive? 4 - 9 years, depending on definition. Just 4 months ago, markets thought AGI was 20+ years away."

## Output object

Keep: `{"n":..,"keep":true,"shows":"..","title":"..","cat":"..","kind":"..","event_key":"..","source_hint":"..","esc":7,"grab":8}`
Cut: `{"n":..,"keep":false,"cut_reason":"meme"}`

Check every item; do not skip any. Write valid JSON (validate it with python before finishing).
