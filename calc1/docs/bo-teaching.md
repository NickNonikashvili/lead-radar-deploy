# How Bo teaches

Bo is Mathub's tutor: in the Ask Bo chat, when you talk with him out loud, and on live calls. This page is the
set of teaching rules he follows, why each one is there, and where it comes from. The rules themselves live in
`api/ai.php` (`MH_AI_TEACH`), and every one of Bo's instructions includes them: the chat (`MH_AI_BO_FULL`), voice
mode (`MH_AI_VOICE`) and calls (`MH_AI_LIVE`, `MH_AI_LIVE_REST`). Change them there; this page explains them.

## The rules

| # | Rule | What it means for Bo | Where it comes from |
|---|---|---|---|
| 1 | **Find out where they are first** | One quick question before explaining, unless it is obvious: what they tried, where it stops making sense. New to it: teach it. Nearly there: nudge. Watch how they feel, not only what they know. | Expert tutors keep a "dual diagnosis" of what the student knows and how they feel (Lepper & Woolverton; the INSPIRE model). Adapting to the learner is one of LearnLM's five principles. |
| 2 | **Big picture first** | One plain sentence on what the idea is and what it is for, before any procedure. | "Feed up": where am I going? (Hattie & Timperley 2007). |
| 3 | **One idea at a time** | Small steps, in order; new words defined the first time. | Managing cognitive load and segmenting (cognitive load theory; Mayer's segmenting principle; LearnLM). Rosenshine: present new material in small steps. |
| 4 | **Concrete before abstract** | A simple case with real numbers, a picture or an everyday comparison, then the general rule, and how they connect. | Concreteness fading (Fyfe, McNeil, Son & Goldstone 2014; McNeil & Fyfe 2012). |
| 5 | **Show, then fade** | A complete worked example with the *why* of each step when the idea is new; then similar problems where the student does more each time. | The worked-example effect (Sweller); faded examples and self-explanation (Renkl; Atkinson, Renkl & Merrill 2003; Chi et al. 1989). Rosenshine: models and worked examples, guided practice. |
| 6 | **Draw it** | A graph, number line, figure, table, chart or tree on the board whenever a picture would make it click; labels on the parts they name; the one thing that matters marked. | Mayer's multimedia principles (signaling, spatial contiguity); dual coding; Pólya: "draw a figure". |
| 7 | **Words and board together** | The reasoning in words, the math and pictures on the board; never read the board back. | Mayer's modality and redundancy principles. |
| 8 | **Check with a real question** | Never "does that make sense?": the next step, a prediction, why a step works, or a mistake to spot. One question, then wait. | Rosenshine: check for student understanding; Lemov, *Teach Like a Champion*: Check for Understanding, think time. |
| 9 | **Let them do the thinking** | A hint ladder: a guiding question, a hint, the first step, then the full worked solution (when they ask or stay stuck). | Socratic, incremental hints (Lepper's expert tutors; Pólya). Step-based help (VanLehn 2011). Unrestricted answers can hurt learning, guarded tutors don't (Bastani et al., PNAS 2025). |
| 10 | **Mistakes are information** | Name exactly what went wrong and why it is tempting, show it fails, let them fix it; praise specific thinking, not "great job". | Feedback at the task and process level, not the person (Hattie & Timperley 2007); Tutor CoPilot (Wang et al. 2025): more probing questions and less generic praise went with more mastery. |
| 11 | **Change the angle** | If it didn't land: a simpler example, a picture, another comparison. Never the same words again. | Adapting to the learner (LearnLM); multiple representations. |
| 12 | **Close the loop** | The key idea in one sentence, and what to do next. | Pólya's "look back"; "feed forward" (Hattie & Timperley). |
| 13 | **Be exactly right** | Work carefully, check answers (substitute back, estimate), use the class's notation, say when unsure. | Pólya's "look back"; Mathub's rule that Bo uses the class facts exactly. |

## Never agreeing with something wrong

Agreeing with a mistake is the worst thing a tutor can do, and a friendly voice model is tempted to ("x = 11 − 3,
so x = 6" once got "right!"). So Bo is told (`MH_AI_TRUTH`, in every mode) to check before he judges, never to open
with praise he hasn't checked, to correct his own slips at once, and not to give in when a right answer is pushed
back on. And the app checks the arithmetic itself, exactly, because a rule alone is not enough:

- **The math check** (`assets/mathcheck.js` in the browser, `api/mathcheck.php` on the server, the same rules):
  plain and spoken math ("eleven minus three is six"), LaTeX, a letter given a worked value and then another
  ("x = 11 − 3, so x = 6"), an answer that does not solve the problem being worked (checked against the equations
  on Bo's pages and in what he said), a bare number answering a question he just asked ("what's 7 times 8?" …
  "54"), and derivatives or antiderivatives said in words. A stated rounding is fine ("pi is 3.14"), and so is
  "negative 3 squared is 9" (said aloud it means (−3)²). Anything it cannot read is left alone, so it never cries
  wrong over notation it does not follow; everyday talk ("my exam is at 9, worth 20 percent") is left alone too.
- **On a call:** what the student says (from its transcript) and types is checked, and an exact MATH CHECK note
  goes in for Bo's next turn ("that is right", or what is wrong and that he must not agree; if the transcript may
  have misheard them, he checks with them first). He is not cut off for it (that made him stutter), except when his
  first words start to agree with something wrong, or to tell a student who was right that they were not: then he
  is stopped and told. What Bo says is checked too: his own slip gets him a note and a turn to correct himself. He
  has a `check_math` tool (a value, two things equal, an equation and values for its letters, its solutions, a
  derivative, an antiderivative, a limit, the steps of a solution) and is told to use it before he says whether
  something is right, including on handwriting he reads from the board. Pages he writes are checked before they go
  up (a false line, or a step that does not follow from the one before, comes back to him to fix quietly), and so
  are his questions' answers.
- **Typed and basic voice** (Claude): the student's message is checked on the server and a MATH CHECK note goes
  with it. Bo's reply is checked too: a slip on one of his pages or in what he says makes him write the reply again
  with it named (the chat shows the fixed one); out loud, where it was already spoken, he says the correction.

Tests: `tests/mathcheck.test.js` (the same cases through both, `tests/fixtures/mathcheck-cases.json`), the math
part of `tests/talk-web.test.js` (a call) and of `tests/ai-api.test.js` (the server).

## On a call

The first version of Bo's call persona told him to "ask more than you tell" and keep every turn to one to three
sentences. The result was a tutor who quizzed but didn't explain. The research says that is the wrong default for
someone meeting an idea for the first time: novices learn more from a clear worked example than from being made to
search (the worked-example effect), and expert tutors give direct explanations when the student needs them. But a
voice that talks too long is hard to follow and easy to talk over by accident. So on a call Bo now:

- keeps most turns to one to three short sentences, and takes **a proper turn to explain something new**: up to
  about five short sentences, then checks in;
- explains in the order **big idea → put it on the board → walk through it in words, pointing at the board → one
  question to check**;
- asks the student to say it again when the audio was unclear, instead of guessing what they meant, and asks what
  "this" or "that one" is when the screen doesn't make it plain;
- diagnoses a wrong answer (which step, which idea) before he says anything about it; wrong twice, he works a similar
  problem out loud and gives theirs back; "I don't know" twice, he gives a smaller step or the first move;
- draws (`draw_on_board`) as well as writes (`write_on_board`), and keeps talking while it goes up;
- checks with a question on the board (`ask_on_board`, rule 8): the student taps or types the answer right there,
  sees at once whether it's right and why, and Bo is told what they picked, so he reacts to it (rule 10).

The call instructions (`MH_AI_LIVE`) follow the structure of OpenAI's realtime prompting guide: short headed
sections (role, personality, length and pace, unclear audio, understanding what they mean, getting the math right,
how you teach, tools, the board, context, language, start of the call), plain rules instead of long paragraphs, and
"Use when…" at the start of every tool's description. They are about half as long as before (the chat's longer
teaching rules stay in the chat), and the seven tools' descriptions are half as long too, so Bo follows them better
on a voice model. A call's answer has no output cap (`max_output_tokens` "inf"), so a page or a drawing is never cut
off halfway.

## Calls that hold up

Students said Bo "stutters a lot" (stops and starts again mid-sentence), "doesn't know what I'm talking about", "runs
into errors" and "ends the call when the connection drops". Each had a cause in the call code; what changed
(`assets/talk.js`, `Live`; `api/ai.php`, `ai_live_start`):

- **Stutter.** The app used to cut Bo off itself: when the math check caught something it cancelled his answer and
  asked for a new one, and it sometimes asked for an answer while one was still going. Now **the server owns
  interruptions** (`semantic_vad` with `interrupt_response`, the way LiveKit, Pipecat and OpenAI's Agents SDK do it)
  and the app never cancels him for a check: a MATH CHECK goes in as a note for his next turn. The one exception is a
  guard on his first words: if he starts to agree with something the check found wrong ("yes, exactly…"), or to say a
  right answer is wrong, he is stopped then and told why. **One response at a time:** the app keeps a queue, asks
  for an answer only when none is going, and treats the server's "already has an active response" as the harmless
  race it is (it waits, then asks again; nothing is shown). His own voice through the speakers is the other cause.
  The page, not the server, decides turns (`create_response` and `interrupt_response` are off): the server's
  semantic VAD only says when it hears speech. The mic is open for the whole call, so students can always cut in.
  Speech heard while he talks is judged on the page (`Live.listen`, every 50 ms): it learns how much of his voice
  comes back into the mic while nobody else talks, and a voice clearly above that for about a quarter second stops
  him (`response.cancel` and `output_audio_buffer.clear`); his own voice is not a turn and is deleted from the
  conversation (`conversation.item.delete`). With headphones any speech stops him at once. A short sound that
  stopped him waits for its words: an "mm-hmm" or a cough makes him carry on without repeating himself. Laptops get
  the far-field noise filter (`far_field`; headphones get `near_field`), and **My speakers echo** (call settings,
  on by default on iPhones without headphones) asks for a louder voice before he stops; tapping him always stops
  him. (Until build 2026.10.22.1 the mic was closed while he greeted, and on iPhones while he talked, which kept
  students from cutting in.) Free calls on speakers use the stronger call model, which handles echo better than the
  small one.
- **Not understanding.** What the student says is written down by `gpt-live-transcribe` in their language, with the
  class's words as hints (derivative, integral, the class code, its section titles), so "x squared" and "M171" come
  through. The instructions now say to ask again instead of guessing, to check what "this" refers to, and that the
  whole screen is a board they share (he gets a quiet look at it and knows what is on it).
- **Errors.** A tool that could not do what Bo asked used to answer `{error: …}`, and he read it out ("I ran into an
  error"). Tools now answer in a shape he can act on: `ok: true` when it worked, or `retry: true` with a hint to fix
  it quietly and call again (a page with a false line, a drawing he got wrong once, a question whose answer does not
  hold); a drawing that fails twice becomes words. He is told never to mention tools, errors or notes. After a tool,
  the app asks for his next turn only when he still has something to say (a check, a retry, or no spoken answer yet),
  so he doesn't talk twice; `wait_for_user` lets him stay quiet when the audio was not for him.
- **Dropped calls.** The call used to end the moment the connection said "disconnected", which often heals by itself
  in a second or two. Now the app watches the audio packets as well as the connection: a blip changes nothing; after
  about two seconds it shows "reconnecting…" (or "you're offline"), and after about six (or at once on "failed", or
  when the network comes back) it **rebuilds the call as the same call**: a new connection with `resume` (the last
  call's id), the board, the clock and the captions kept, and Bo told the call dropped and is back, with his last few
  messages, so he picks up instead of greeting again. Tries back off (0, 1, 2, 4, 8 s); after a minute with no
  connection the call ends and says so, with Call again. A mic that stops (unplugged headphones, another app) is
  picked up again, or a button asks to turn it back on. Calls roll over to a fresh session before the 60-minute
  limit, at a pause.

Settings on a call (the gear): **I'm wearing headphones** (the near-field filter, from the next call; also guessed
from the mic's name), **My speakers echo**, and how quickly he answers. The admin can choose the model that writes
down what is said (Site settings → "Model that writes down what is said on calls").

Tests: `tests/call-resilience.test.js` (on the stand-in call: blips, drops, rebuilds, offline, the greeting gate, the
echo setting, the queue, tool retries, a lost call), and the call parts of `tests/talk-web.test.js` and
`tests/ai-api.test.js` (session settings, instructions, tools, resume).

## Bo's characters

Students found the old Bo too nice: friendly to a fault, quick to praise. Bo now has a character, which each
student picks (`assets/bo-characters.js`; the words he is given are in `api/ai.php`, `mh_ai_character`):

| Character | Manner | Live voice, pace |
|---|---|---|
| **Professor Bo** (default) | An 80-year-old Harvard professor: exacting, dry, hard to impress; praise is rare and earned; precise language; an occasional story from fifty years of teaching | ash, 0.9 |
| Coach Bo | Practice like training: short, loud, fast, no excuses, reps | verse, 1.1 |
| Detective Bo | Every problem a case, every mistake a clue; asks what the evidence says | sage, 1.0 |
| Zen Bo | Calm and patient, for stressful days | ballad, 0.9 |
| Buddy Bo | The old Bo: a friend a year ahead, warm, a little funny | cedar, 1.0 |

The character changes **how** he talks, never **what is true**: every character gets the same truth rules
(MH_AI_TRUTH), teaching rules and the math check, and the same "never agree with something wrong". A student's
own voice and speed (call settings) win over the character's. The character goes into the chat, basic voice,
live calls (with `HOW YOU OPEN`, his own way to start the call) and the recap.

## After a call: the recap

When a call ends (30 seconds or more, and the student said something), the page asks `ai_recap`. Bo gets the call
as text and the slips the app's math check caught, and writes, in character, one line, a page (`Call recap:
topic`: what you did, the slip to watch, exactly three `check:` lines with typed answers) and a next step. The
recap's own answers go through the math check (`mh_mc_reply_slips`, which reads `check:` lines too); a wrong one
gets one rewrite. The recap is saved in the chat, emailed (unless Settings → Account says no), and its numeric
problems go into the mistakes notebook, due now, with the slips the app caught on the call.

## Before an exam: the review call

Three days before an exam in a student's classes (`mh_exam_nudge_tick`), Mathub emails them once (and sends a
push if they turned those on) with a link to `#/tutor/<class>?call=exam`. That opens a call whose instructions
add MH_AI_EXAM_CALL: name the exam and its day, start with the weakest topic, one exam-style question at a time,
check it with `check_math`, short explanations of what went wrong, and end by naming the one topic to practise.

## Study rooms

A student on a call can open a study room (`api/room.php`, `assets/room.js`): up to three classmates join with a
six-letter code, see the board and captions, write on the board, and type questions. A typed question reaches Bo
as "(Name, a classmate watching this call in the study room, typed a question for you:) …", so he answers out
loud on the host's call and can address them by name. Nothing is peer to peer: each side posts its changes and
polls once a second, which works on shared hosting and campus Wi-Fi.

## How Bo is doing

The admin's **Bo quality** tab (`ai_admin_quality`) shows, by week: answers, the students' slips the math check
caught, Bo's own slips caught (rewritten before anyone saw them in the chat, corrected out loud on calls, pages
held back), calls and recaps; for calls, how they went: reconnects (a dropped connection rebuilt as the same call),
calls lost to the connection, false starts (a short sound that cut Bo off), times the app stopped him (agreeing with
something wrong), answers cut by a limit and errors from the call; and the answers students marked "not right" with the thumbs down, with their
question and what they said was wrong. Read the queue weekly; recurring kinds of mistakes are prompt or
math-check work.

## The board: what Bo can draw

`assets/board-draw.js` draws a picture from a small description Bo writes (JSON after `draw:` in a board page; on a
call, the `draw_on_board` tool). Nothing in it runs as code: functions are read by Mathub's own expression reader,
sizes are capped, and every label is escaped. Models don't always write tidy JSON, so it reads what he meant: code
fences, single or smart quotes, unquoted keys, trailing commas, LaTeX with one backslash (`\frac`, which strict JSON
would turn into a form feed), a reply cut off, synonyms ("plot", "bar chart"), points as `[x, y]` or `{x, y}`,
functions as `y = \frac{1}{x}`, `x²` or `sin^2 x`. A drawing that still makes no sense says so on the board instead of
leaving a gap.

| Kind | For | Example |
|---|---|---|
| `graph` | Functions and parametric curves, points (open or closed), shaded areas, segments and vectors, asymptotes, notes; the y range is found when left out | `{"type":"graph","x":[-4,4],"fns":[{"f":"x^2-3"}],"shade":{"f":"x^2-3","from":0,"to":2}}` |
| `numberline` | Inequalities and intervals | `{"type":"numberline","min":-3,"max":6,"intervals":[{"from":2,"to":null,"left":"open"}]}` |
| `figure` | Triangles, any shape, angles (right angles too), circles, vectors, forces, boxes and arrows | `{"type":"figure","shapes":[{"kind":"polygon","points":[[0,0],[4,0],[4,3]],"labels":["A","B","C"]}]}` |
| `table` | Tables of values (cells can hold math) | `{"type":"table","head":["x","f(x)"],"rows":[["0","1"]]}` |
| `bars` | Bar charts and histograms | `{"type":"bars","bars":[{"label":"A","value":3}],"hist":true}` |
| `normal` | A normal curve with a shaded region and the mean ± 1, 2, 3 SD | `{"type":"normal","mean":100,"sd":15,"from":115,"to":null}` |
| `tree` | Probability trees, up to three levels | `{"type":"tree","branches":[{"label":"H","p":"1/2"},{"label":"T","p":"1/2"}]}` |
| `graph` + `tangent`, `secant`, `riemann` | The tangent line and its slope, a secant line, left, right, midpoint or trapezoid sums with their total | `{"type":"graph","f":"x^2","tangent":{"at":1},"riemann":{"from":0,"to":2,"n":4}}` |
| `graph` + `sliders` | Numbers the student drags, the drawing redraws: what `a` does to the parabola, the tangent sliding along the curve, more and more rectangles | `{"type":"graph","f":"a*x^2","sliders":[{"name":"a","min":-3,"max":3,"value":1}]}` |
| `unitcircle` | The special angles; the one he points at gets its triangle and exact cos and sin | `{"type":"unitcircle","highlight":60}` |
| `pie` | Shares of a whole | `{"type":"pie","slices":[{"label":"Rent","value":45},{"label":"Food","value":30}]}` |
| `scatter` | Data with the least-squares line, r and r², residuals, a prediction | `{"type":"scatter","points":[[1,52],[2,61],[3,70]],"predict":4}` |
| `boxplot` | Box plots from data (outliers found by the 1.5 IQR rule) or from five numbers | `{"type":"boxplot","boxes":[{"label":"A","data":[2,4,4,5,7,9,15]}]}` |
| `venn` | Two or three sets, counts in the regions, any set expression shaded | `{"type":"venn","sets":["A","B"],"values":{"A":5,"AB":2,"B":3},"shade":["A ∩ B'"]}` |
| `flow` | A process or an algorithm, with decisions and arrows that loop back | `{"type":"flow","steps":["Read it","Pick a method","Does it check out?"],"loops":[{"from":3,"to":2}]}` |

And two more things on the board:

| Line | For | Example |
|---|---|---|
| `check:` | A question the student answers on the board (rule 8: a real check). Choices to tap, or a box to type in (numbers are compared as numbers, so 0.5, 1/2 and `\frac{1}{2}` all match). Marked at once, with the right answer and Bo's why, then Explain it and Another one | `check: {"q":"What is the slope at x = 1?","choices":["1","2","4"],"answer":"2","why":"f'(x) = 2x"}` |
| a ``` block | Code, as written (for programming classes) | ```` ```python ```` … ```` ``` ```` |

After each answer in the chat there are one-tap ways to go on (Explain it more simply, Show me another example,
Quiz me on this, Draw it on the board), and every question missed in the Quizzer or the mistakes notebook has
**Ask Bo about this**, which opens the chat with the question, what the student answered and the right answer
already sent: the moment a student is most ready to learn from a mistake (rule 10).

Drawings appear stroke by stroke like a marker on a whiteboard (not when motion is reduced), use the theme's
colours in light and dark mode, place their labels where they don't collide with the curves or each other, and
are named for screen readers ("Graph of y = x² − 3 for x from −4 to 4…"). Copying a page copies that description.

## Bo on every page: teaching from what the student sees

Bo floats on every page of the website (`assets/bo-float.js`). When a student asks him from a page, the question
carries what is on it (`MH_AI_SCREEN` in `api/ai.php`): the page's questions numbered as the student sees them,
the choices, what they answered and whether it was right, the text in view, their code. The rules above apply to
that page:

- **Where they are** (rule 1) is on the screen: a wrong answer, the choice they picked, the notes they are reading.
  Bo starts from it instead of asking.
- **A question not answered yet** gets the hint ladder (rule 9): the idea, a hint, the first step; the full
  solution only when they ask. A worked solution the page still hides is sent too, marked hidden, so Bo is right
  without giving it away.
- **A wrong answer** is information (rule 10): what went wrong and why it was tempting, how to do it, then a similar
  one to try (rule 12, close the loop).
- **"Check my answers"** goes through each one briefly and spends the words on the wrong ones.
- **What they point at or select** (`MH_AI_FOCUS`) is what "this" means.
- **A problem set** (a photo or a PDF, `MH_AI_FILE`): numbered as the set does, help with the one they ask about, or
  a short plan for all of it starting with the first. Graded homework gets the method with a similar example.
- He never says he was sent the page's text, and doesn't describe the page back to them.

The student sees what Bo sees ("Bo sees Calc I › Quizzer · 10 questions") and can switch it off with the eye.

## Sources

- Lepper, M. R., & Woolverton, M. (2002). The wisdom of practice: Lessons learned from the study of highly effective tutors. In J. Aronson (Ed.), *Improving Academic Achievement*. Summary of the INSPIRE model: [UBC CWSEI, INSPIRE guidelines](https://www.eoas.ubc.ca/research/cwsei/resources/INSPIRE-Guidelines.pdf); [MIT TLL, office hours](https://tll.mit.edu/teaching-resources/how-to-teach/facilitate-office-hours).
- Google, LearnLM's learning-science principles (active learning, cognitive load, adapting to the learner, curiosity, metacognition): [blog.google](https://blog.google/outreach-initiatives/education/google-learnlm-gemini-generative-ai/).
- Rosenshine, B. (2012). Principles of Instruction. *American Educator*. Summary: [Structural Learning](https://www.structural-learning.com/post/rosenshines-principles-a-teachers-guide).
- Worked examples and fading: [Worked-example effect (overview)](https://en.wikipedia.org/wiki/Worked-example_effect); [MIT Open Learning, worked and faded examples](https://openlearning.mit.edu/mit-faculty/research-based-learning-findings/worked-and-faded-examples).
- Mayer, R. E. *Multimedia Learning*. Summary of the principles: [Dartmouth](https://services.dartmouth.edu/TDClient/1806/Portal/KB/PrintArticle?ID=171655).
- Fyfe, E. R., McNeil, N. M., Son, J. Y., & Goldstone, R. L. (2014). Concreteness fading in mathematics and science instruction: A systematic review. *Educational Psychology Review* ([doi:10.1007/s10648-014-9249-3](https://www.doi.org/10.1007/S10648-014-9249-3)); McNeil & Fyfe (2012) ([PDF](https://pcl.sitehost.iu.edu/rgoldsto/courses/cogscilearning/McNeilFyfe12.pdf)).
- Pólya, G. (1945). *How to Solve It*: [overview](https://en.wikipedia.org/wiki/How_to_Solve_It); [the four steps](https://www.ms.uky.edu/~carl/ma310/spring03/polya/Polya.htm).
- Hattie, J., & Timperley, H. (2007). The power of feedback. Summary: [Duke Kunshan CTL](https://ctl.dukekunshan.edu.cn/resources/teaching-guides/feedback-for-learning).
- VanLehn, K. (2011). The relative effectiveness of human tutoring, intelligent tutoring systems, and other tutoring systems: [slides](https://quality.mit.edu/files/2012/01/Quality-Symposium-Kurt-VanLehn.pdf).
- Bastani, H., et al. Generative AI without guardrails can harm learning: [SSRN](https://papers.ssrn.com/abstract=4895486).
- Wang, R. E., et al. Tutor CoPilot: a human-AI approach for scaling real-time expertise: [NSSA, Stanford](https://nssa.stanford.edu/studies/tutor-copilot-human-ai-approach-scaling-real-time-expertise).
- Lemov, D. *Teach Like a Champion* (Check for Understanding; wait and think time): [field notes](https://teachlikeachampion.org/?p=5172); [ASCD, think time](https://ascd.org/el/articles/a-new-rhythm-for-responding).
- OpenAI, prompting realtime voice models (short bullet sections, explicit tool rules): [voice prompting guide](https://developers.openai.com/api/docs/guides/voice-prompting); [realtime prompting guide (cookbook)](https://developers.openai.com/cookbook/examples/realtime_prompting_guide).
- OpenAI Realtime API: [turn detection (VAD)](https://developers.openai.com/api/docs/guides/realtime-vad), [conversations and responses](https://developers.openai.com/api/docs/guides/realtime-conversations), [WebRTC](https://developers.openai.com/api/docs/guides/realtime-webrtc), [transcription](https://developers.openai.com/api/docs/guides/realtime-transcription), [client events](https://developers.openai.com/api/reference/resources/realtime/client-events/) and [server events](https://developers.openai.com/api/reference/resources/realtime/server-events/).
- How voice-agent frameworks handle turns, interruptions and false starts: [LiveKit Agents](https://github.com/livekit/agents/blob/main/livekit-agents/livekit/agents/voice/agent_session.py), [Pipecat](https://github.com/pipecat-ai/pipecat/blob/main/src/pipecat/services/openai/realtime/llm.py), [OpenAI Agents SDK, realtime](https://github.com/openai/openai-agents-python/blob/main/docs/realtime/guide.md).
- Echo in the first seconds of a call, and on speakers: [OpenAI community](https://community.openai.com/t/realtimeapi-echo-cancellation-doesn-t-work-for-the-first-10-seconds-of-session/1252805), [and on the mini model](https://community.openai.com/t/speaker-feedback-mitigation-for-gpt-realtime-2-1-mini-with-webrtc/1389657).
- "Disconnected" is not "failed": [Mozilla, ICE disconnected](https://blog.mozilla.org/webrtc/ice-disconnected-not/); [MDN, restartIce](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/restartIce).
- The full research behind the call fixes: Voice AI tutor reliability (kept with the project's research notes, not shipped).
