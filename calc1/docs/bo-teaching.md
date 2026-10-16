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

## On a call

The first version of Bo's call persona told him to "ask more than you tell" and keep every turn to one to three
sentences. The result was a tutor who quizzed but didn't explain. The research says that is the wrong default for
someone meeting an idea for the first time: novices learn more from a clear worked example than from being made to
search (the worked-example effect), and expert tutors give direct explanations when the student needs them. So
on a call Bo now:

- keeps chatting, checking in and quizzing short, but takes **a proper turn to explain something new**: four to
  seven sentences, about 20 to 40 seconds, then checks in;
- explains in the order **big idea → put it on the board → walk through it in words, pointing at the board → one
  question to check**;
- slows down a little on the key idea;
- draws (`draw_on_board`) as well as writes (`write_on_board`), and keeps talking while it goes up.

Calls can also use more output per turn now (`max_output_tokens` 1600), so a full explanation and a drawing fit
in one answer.

## The board: what Bo can draw

`assets/board-draw.js` draws a picture from a small description Bo writes (one line of JSON, `draw: {…}`, in a
board page; on a call, the `draw_on_board` tool). Nothing in it runs as code: functions are read by Mathub's own
expression reader, sizes are capped, and every label is escaped.

| Kind | For | Example |
|---|---|---|
| `graph` | Functions and parametric curves, points (open or closed), shaded areas, segments and vectors, asymptotes, notes; the y range is found when left out | `{"type":"graph","x":[-4,4],"fns":[{"f":"x^2-3"}],"shade":{"f":"x^2-3","from":0,"to":2}}` |
| `numberline` | Inequalities and intervals | `{"type":"numberline","min":-3,"max":6,"intervals":[{"from":2,"to":null,"left":"open"}]}` |
| `figure` | Triangles, any shape, angles (right angles too), circles, vectors, forces, boxes and arrows | `{"type":"figure","shapes":[{"kind":"polygon","points":[[0,0],[4,0],[4,3]],"labels":["A","B","C"]}]}` |
| `table` | Tables of values (cells can hold math) | `{"type":"table","head":["x","f(x)"],"rows":[["0","1"]]}` |
| `bars` | Bar charts and histograms | `{"type":"bars","bars":[{"label":"A","value":3}],"hist":true}` |
| `normal` | A normal curve with a shaded region and the mean ± 1, 2, 3 SD | `{"type":"normal","mean":100,"sd":15,"from":115,"to":null}` |
| `tree` | Probability trees, up to three levels | `{"type":"tree","branches":[{"label":"H","p":"1/2"},{"label":"T","p":"1/2"}]}` |

Drawings appear stroke by stroke like a marker on a whiteboard (not when motion is reduced), use the theme's
colours in light and dark mode, place their labels where they don't collide with the curves or each other, and
are named for screen readers ("Graph of y = x² − 3 for x from −4 to 4…"). Copying a page copies that description.

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
- OpenAI, prompting realtime voice models (short bullet sections, explicit tool rules): [voice prompting guide](https://developers.openai.com/api/docs/guides/voice-prompting).
