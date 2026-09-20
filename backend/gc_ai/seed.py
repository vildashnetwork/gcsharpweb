"""
Seed corpus for GC AI.

Two things live here:

1. ``INTENT_EXAMPLES`` - labelled utterances used to train the naive Bayes
   intent classifier at boot. GC AI keeps learning on top of this.
2. ``CURATED_KNOWLEDGE`` - worked, exam-ready answers that GC AI knows from
   the moment it starts, even with no internet and no LLM key. They form the
   backbone of the offline knowledge base (source = "curated").
"""

from __future__ import annotations

from typing import Dict, List

INTENT_EXAMPLES: Dict[str, List[str]] = {
    "greeting": [
        "hi", "hello", "hey there", "good morning", "good afternoon",
        "good evening", "hey gc ai", "hi gc ai", "hello there bot",
        "morning", "how are you", "i hope you are doing well", "hi, are you there",
    ],
    "farewell": [
        "bye", "goodbye", "see you later", "talk to you tomorrow",
        "i am leaving now", "thanks bye", "catch you later", "good night",
    ],
    "thanks": [
        "thanks", "thank you", "thank you so much", "thanks a lot",
        "that was helpful", "i appreciate it", "merci", "thanks for the help",
    ],
    "identity": [
        "who are you", "what is your name", "are you a robot", "what are you",
        "tell me about yourself", "who built you", "are you human",
        "what powers you", "are you chatgpt", "which ai model are you",
    ],
    "capabilities": [
        "what can you do", "how can you help me", "what are your features",
        "can you help me with maths", "what subjects do you know",
        "how do you work", "what can i ask you", "list your abilities",
        "do you know all gce subjects",
    ],
    "platform_help": [
        "how do i use this app", "how do i open past papers",
        "where can i find video solutions", "how do i enter exam mode",
        "how do i change my subject", "how do i bookmark a paper",
        "how do i reset my password", "how do i track my study time",
        "how do streaks work", "how do i join the leaderboard",
        "how do i download a past paper", "how does analytics work",
    ],
    "math_solve": [
        "solve for x 2x + 5 = 15", "calculate 12 percent of 250",
        "find the value of x in x squared minus 4 equals zero",
        "differentiate 3x squared plus 2x", "integrate 2x dx",
        "factorise x squared minus 9", "simplify 3x plus 2x minus x",
        "solve the simultaneous equations", "find the gradient of the line",
        "evaluate the integral of sin x", "compute the determinant of the matrix",
        "what is 15 percent of 80", "solve this quadratic equation",
    ],
    "math_concept": [
        "explain the quadratic formula", "what is a logarithm",
        "explain differentiation rules", "what is the binomial theorem",
        "explain integration by parts", "what is a geometric progression",
        "explain the sine rule", "what is a vector",
        "explain a probability tree diagram", "what is standard deviation",
    ],
    "science_concept": [
        "state newtons second law of motion", "what is ohms law",
        "explain electrolysis of brine", "what is the mole concept",
        "explain photosynthesis in plants", "what is osmosis",
        "explain the structure of an atom", "what is the periodic table",
        "explain free fall under gravity", "what is a catalyst",
        "explain dna replication", "what is electromagnetic induction",
    ],
    "definition": [
        "define osmosis", "what is meant by inflation", "define momentum",
        "what is an algorithm", "define e-commerce", "what is respiration",
        "meaning of elasticity in economics", "define hydrocarbon",
        "what is a clause in english", "define marginal utility",
    ],
}

INTENT_EXAMPLES.update({
    "explanation": [
        "explain this topic to me", "explain it step by step",
        "can you explain in simple terms", "help me understand this concept",
        "break it down for me", "explain like i am a beginner",
        "give me an example of this", "why does this happen",
    ],
    "study_plan": [
        "make a study plan for me", "create a revision timetable",
        "how should i prepare for gce in two months",
        "give me a 7 day revision plan", "help me organise my study time",
        "how many hours should i study a day", "plan my revision for physics",
    ],
    "quiz_request": [
        "generate a quiz for me", "give me practice questions",
        "test me on chemistry", "create 5 multiple choice questions",
        "i want to practise past questions", "make an exercise on vectors",
        "give me a mock test",
    ],
    "flashcards": [
        "make flashcards for me", "create revision cards",
        "give me key points to memorise", "make a summary card for biology",
        "flashcards on business studies terms",
    ],
    "summarize": [
        "summarise this topic", "give me the key points", "summarise the chapter",
        "short notes on respiration", "condense this for me",
        "what are the main points",
    ],
    "translation": [
        "translate this to french", "translate into english",
        "how do you say this in french", "give me the french meaning",
        "traduire en francais",
    ],
    "essay_help": [
        "help me write an essay", "how do i structure a composition",
        "give me an essay plan", "how do i write a summary passage",
        "help me with letter writing", "how many words for an essay",
    ],
    "exam_info": [
        "when is the gce exam", "how is gce graded", "what is a pass in gce",
        "explain the gce grading system",
        "how many papers in advanced level maths",
        "what is the hnd admission requirement", "what is concours",
        "difference between ordinary level and advanced level",
    ],
    "motivation": [
        "i am tired of studying", "i feel like giving up",
        "i failed my mock exam", "i am scared of the exam",
        "encourage me", "how do i stay motivated", "i cannot concentrate",
    ],
    "career_advice": [
        "what can i study with physics and maths", "which career suits me",
        "how do i become an engineer", "what jobs need accounting",
        "how do i apply for university", "which subjects do i need for medicine",
    ],
    "general_question": [
        "what is the capital of cameroon", "who discovered penicillin",
        "how do plants grow", "why is the sky blue",
        "what is climate change", "tell me about the industrial revolution",
    ],
})


# ============================================================
# Curated offline knowledge (works with no internet, no API key)
# ============================================================

CURATED_KNOWLEDGE: List[Dict] = [
    {
        "question": "who are you / what is GC AI",
        "answer": (
            "I am **GC AI**, the study assistant built into GCSHARP for Cameroon "
            "students preparing for GCE O Level, GCE A Level, HND and Concours.\n\n"
            "I answer in three ways and I always tell you which one I used:\n"
            "1. **GC AI knowledge** - facts I already learned and stored.\n"
            "2. **GC AI reasoning** - I work the answer out myself.\n"
            "3. **Learned from the web** - I search online, read the sources, "
            "answer, then save what I learned so next time it is instant.\n\n"
            "Every answer makes me smarter, because I write it into my own "
            "knowledge base."
        ),
        "subject": "General",
        "tags": ["gc ai", "identity", "who are you", "about"],
        "confidence": 0.98,
    },
    {
        "question": "what can GC AI do",
        "answer": (
            "Here is what I can do for you:\n\n"
            "- **Solve maths** step by step (algebra, calculus, matrices, stats).\n"
            "- **Explain any concept** in Physics, Chemistry, Biology, Economics, "
            "English, French, Computer Science, Geography and History.\n"
            "- **Search the web** for anything not in my knowledge base, read the "
            "sources and learn it permanently.\n"
            "- **Build study plans**, quizzes, flashcards and summaries.\n"
            "- **Solve past paper questions** with worked solutions and "
            "mark-scheme style answers.\n"
            "- **Translate** between English and French.\n"
            "- **Advise you** on exam strategy, grading and university choices."
        ),
        "subject": "General",
        "tags": ["features", "capabilities", "help"],
        "confidence": 0.97,
    },
    {
        "question": "how do i use GCSHARP / how does the app work",
        "answer": (
            "Quick tour of GCSHARP:\n\n"
            "- **Dashboard** - your streaks, XP, accuracy and study time.\n"
            "- **Study Center** - practise by subject, level and topic.\n"
            "- **Exam Mode** - timed conditions with instant marking.\n"
            "- **Papers** - browse GCE/HND past papers, read them and generate "
            "solutions or video walkthroughs.\n"
            "- **AI Tutor** - that is me. Ask anything, or tap a quick action.\n"
            "- **Analytics** - see your weak and strong topics.\n"
            "- **Leaderboard** - compare XP with other students.\n\n"
            "Tip: keep the subject selector on the AI Tutor set to your current "
            "subject so my answers match your syllabus."
        ),
        "subject": "General",
        "tags": ["app", "how to use", "platform", "navigation"],
        "confidence": 0.95,
    },
    {
        "question": "how to prepare for GCE in two months / revision plan",
        "answer": (
            "A realistic 8-week GCE plan:\n\n"
            "**Week 1-2 - Diagnose:** take one past paper per subject untimed. "
            "Mark it honestly and list every weak topic.\n"
            "**Week 3-5 - Fix weaknesses:** 60% of your time on weak topics, 40% "
            "on revision. Use active recall (close the book and write what you "
            "know), not re-reading.\n"
            "**Week 6 - Speed:** timed past papers, 3 hours per session.\n"
            "**Week 7 - Mark schemes:** redo every question you got wrong in "
            "weeks 1-6 and check the official mark-scheme wording.\n"
            "**Week 8 - Light revision:** definitions, formulas and diagrams only. "
            "Sleep 7-8 hours; no new topics.\n\n"
            "Daily: 2 focused hours beat 6 distracted hours. Study in 45-minute "
            "blocks with 10-minute breaks."
        ),
        "subject": "General",
        "tags": ["study plan", "revision", "timetable", "exam prep"],
        "confidence": 0.93,
    },
    {
        "question": "how is the GCE graded / what is a pass in GCE",
        "answer": (
            "**GCE Ordinary Level** is graded A, B, C, D, E, U. A-C is a strong "
            "pass, D-E is a pass, U is ungraded. Roughly: A = 75%+, B = 65-74%, "
            "C = 55-64%, D = 45-54%, E = 40-44%.\n\n"
            "**GCE Advanced Level** is graded A, B, C, D, E, O, F. A-E are graded "
            "passes, O is a subsidiary pass, F is a failure. Roughly: A = 70%+, "
            "B = 60-69%, C = 50-59%, D = 45-49%, E = 40-44%.\n\n"
            "Most universities and HND programmes require at least two A Level "
            "passes in relevant subjects, plus O Level credit in English and "
            "Mathematics. Always confirm the cut-off for your specific institution "
            "in the year you apply."
        ),
        "subject": "General",
        "tags": ["gce", "grading", "grades", "pass mark"],
        "confidence": 0.92,
    },
    {
        "question": "how do I stay motivated / I failed my mock exam",
        "answer": (
            "A mock exam is a diagnostic, not a verdict. It shows you exactly "
            "where to spend the next weeks - that is valuable information, not "
            "failure.\n\n"
            "Do this today:\n"
            "1. Write down the 5 topics that cost you the most marks.\n"
            "2. Pick the easiest one and master it tonight (30 minutes).\n"
            "3. Tomorrow, do one past-paper question on it.\n"
            "4. Tick it off. Visible progress beats waiting to feel motivated.\n\n"
            "Motivation follows action, not the other way round. Start with 15 "
            "minutes and let momentum do the rest."
        ),
        "subject": "General",
        "tags": ["motivation", "failure", "encouragement"],
        "confidence": 0.9,
    },
    {
        "question": "what is the best way to revise / study techniques that work",
        "answer": (
            "The four techniques proven to raise exam marks:\n\n"
            "1. **Active recall** - close the book and write everything you can "
            "remember, then check. This beats re-reading by a large margin.\n"
            "2. **Spaced repetition** - review a topic after 1 day, 3 days, 1 week, "
            "then 2 weeks.\n"
            "3. **Past papers under timed conditions** - exams test speed and "
            "exam technique as much as knowledge.\n"
            "4. **Teaching it out loud** - if you cannot explain it simply, you do "
            "not know it yet. Explain it to me in the AI Tutor and I will correct "
            "you.\n\n"
            "Avoid: highlighting, copying notes and rereading - they feel "
            "productive but barely move marks."
        ),
        "subject": "General",
        "tags": ["revision", "study techniques", "active recall"],
        "confidence": 0.92,
    },
    {
        "question": "state Newton's laws of motion",
        "answer": (
            "**Newton's First Law (inertia):** a body stays at rest or moves with "
            "constant velocity unless acted on by a resultant external force.\n\n"
            "**Newton's Second Law:** the resultant force equals mass times "
            "acceleration, F = ma. In words: force is proportional to rate of "
            "change of momentum.\n\n"
            "**Newton's Third Law:** to every action there is an equal and "
            "opposite reaction, acting on a different body.\n\n"
            "Worked example: a 1500 kg car accelerates from rest to 20 m/s in 8 s. "
            "a = (20 - 0)/8 = 2.5 m/s^2, so F = 1500 x 2.5 = 3750 N."
        ),
        "subject": "Physics",
        "tags": ["newton", "laws of motion", "force", "mechanics"],
        "confidence": 0.95,
    },
    {
        "question": "what is Ohm's law",
        "answer": (
            "**Ohm's law:** the current through a conductor is directly "
            "proportional to the potential difference across it, provided "
            "temperature stays constant. I = V / R.\n\n"
            "Units: V in volts, I in amperes, R in ohms.\n\n"
            "Example: a 12 V supply across a 4 ohm resistor gives "
            "I = 12/4 = 3 A.\n\n"
            "Note: Ohm's law fails for non-ohmic devices such as filament lamps, "
            "diodes and thermistors, whose resistance changes with temperature or "
            "voltage."
        ),
        "subject": "Physics",
        "tags": ["ohms law", "current", "resistance", "voltage"],
        "confidence": 0.95,
    },
    {
        "question": "what is electromagnetic induction / Faraday's law",
        "answer": (
            "**Electromagnetic induction** is the production of an e.m.f. in a "
            "conductor when the magnetic flux linked with it changes.\n\n"
            "**Faraday's law:** the induced e.m.f. is proportional to the rate of "
            "change of magnetic flux linkage, e = -N(dPhi/dt).\n"
            "**Lenz's law:** the induced current opposes the change producing it "
            "(hence the minus sign) - a consequence of conservation of energy.\n\n"
            "Applications: generators, transformers, induction cookers, "
            "metal detectors.\n\n"
            "Exam tip: always state the direction of the induced current when "
            "asked - examiners award that mark separately."
        ),
        "subject": "Physics",
        "tags": ["induction", "faraday", "lenz", "electromagnetism"],
        "confidence": 0.94,
    },
    {
        "question": "what is the mole concept / Avogadro's number",
        "answer": (
            "A **mole** is the amount of substance containing as many elementary "
            "entities as there are atoms in 12 g of carbon-12, that is "
            "**6.022 x 10^23** (Avogadro's number).\n\n"
            "Key relations:\n"
            "- moles n = mass / molar mass\n"
            "- n = concentration (mol/dm^3) x volume (dm^3)\n"
            "- n = volume of gas / 24 dm^3 at room temperature and pressure\n\n"
            "Example: 20 g of NaOH (M = 40 g/mol) is 0.5 mol; dissolved in "
            "250 cm^3 it gives a concentration of 2 mol/dm^3."
        ),
        "subject": "Chemistry",
        "tags": ["mole", "avogadro", "molar", "stoichiometry"],
        "confidence": 0.95,
    },
    {
        "question": "what is electrolysis",
        "answer": (
            "**Electrolysis** is the decomposition of an ionic compound (molten "
            "or in aqueous solution) by passing a direct current through it.\n\n"
            "Set-up: two inert electrodes (graphite/platinum) in an electrolyte. "
            "The **cathode** (negative) attracts cations -> reduction. The "
            "**anode** (positive) attracts anions -> oxidation. "
            "Remember **OIL RIG**: Oxidation Is Loss, Reduction Is Gain of "
            "electrons.\n\n"
            "Electrolysis of brine (concentrated NaCl):\n"
            "- Cathode: 2H+ + 2e- -> H2 (hydrogen gas)\n"
            "- Anode: 2Cl- -> Cl2 + 2e- (chlorine gas)\n"
            "- Left in solution: NaOH (used to make bleach and soap)."
        ),
        "subject": "Chemistry",
        "tags": ["electrolysis", "electrodes", "oxidation", "reduction"],
        "confidence": 0.94,
    },
    {
        "question": "what is photosynthesis",
        "answer": (
            "**Photosynthesis** is the process by which green plants use light "
            "energy to convert carbon dioxide and water into glucose and oxygen.\n\n"
            "Word equation: carbon dioxide + water -> glucose + oxygen, in the "
            "presence of light and chlorophyll.\n"
            "Balanced: 6CO2 + 6H2O -> C6H12O6 + 6O2.\n\n"
            "It happens in the chloroplasts, which contain chlorophyll. Light "
            "energy splits water (photolysis) producing oxygen, hydrogen ions and "
            "electrons; the hydrogen reduces carbon dioxide to carbohydrate.\n\n"
            "Limiting factors: light intensity, CO2 concentration and temperature. "
            "At night only respiration occurs, so the plant releases CO2."
        ),
        "subject": "Biology",
        "tags": ["photosynthesis", "plants", "chlorophyll", "glucose"],
        "confidence": 0.95,
    },
    {
        "question": "what is osmosis / diffusion",
        "answer": (
            "**Diffusion** is the net movement of particles from a region of higher "
            "concentration to a region of lower concentration, down a "
            "concentration gradient, until equilibrium. It needs no membrane and "
            "no energy.\n\n"
            "**Osmosis** is the movement of water molecules through a "
            "partially permeable membrane from a region of higher water potential "
            "(lower solute concentration) to a region of lower water potential "
            "(higher solute concentration).\n\n"
            "Cell effects: in pure water a plant cell becomes turgid; in a "
            "concentrated sugar/salt solution it becomes flaccid then plasmolysed. "
            "Animal cells burst (haemolysis) in pure water and shrink (crenation) "
            "in strong solutions."
        ),
        "subject": "Biology",
        "tags": ["osmosis", "diffusion", "water potential", "cells"],
        "confidence": 0.95,
    },
    {
        "question": "explain the quadratic formula and how to use it",
        "answer": (
            "For any quadratic equation **ax^2 + bx + c = 0** the roots are:\n\n"
            "$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$\n\n"
            "The **discriminant** b^2 - 4ac tells you the nature of the roots:\n"
            "- positive: two distinct real roots\n"
            "- zero: one repeated real root\n"
            "- negative: no real roots (complex roots)\n\n"
            "Example: solve 2x^2 + 5x - 3 = 0. Here a = 2, b = 5, c = -3, so "
            "b^2-4ac = 25 + 24 = 49, sqrt(49) = 7. x = (-5 +/- 7)/4, giving "
            "x = 0.5 or x = -3."
        ),
        "subject": "Mathematics",
        "tags": ["quadratic", "formula", "discriminant", "roots"],
        "confidence": 0.96,
    },
    {
        "question": "what are the rules of differentiation",
        "answer": (
            "**Power rule:** d/dx (x^n) = n x^(n-1)\n"
            "**Sum rule:** differentiate term by term\n"
            "**Product rule:** d/dx (uv) = u'v + uv'\n"
            "**Quotient rule:** d/dx (u/v) = (u'v - uv')/v^2\n"
            "**Chain rule:** d/dx f(g(x)) = f'(g(x)) . g'(x)\n\n"
            "Standard results:\n"
            "- d/dx (sin x) = cos x, d/dx (cos x) = -sin x\n"
            "- d/dx (e^x) = e^x, d/dx (ln x) = 1/x\n\n"
            "Example: differentiate y = 3x^3 + 2x. dy/dx = 9x^2 + 2. "
            "Turning points: set dy/dx = 0; the second derivative tells you "
            "maximum (negative) or minimum (positive)."
        ),
        "subject": "Mathematics",
        "tags": ["differentiation", "calculus", "derivative", "rules"],
        "confidence": 0.95,
    },
    {
        "question": "what is standard deviation",
        "answer": (
            "**Standard deviation** measures how spread out data is around the "
            "mean. It is the square root of the variance.\n\n"
            "For a population: sigma = sqrt( SUM(x - mean)^2 / N )\n"
            "For a sample: s = sqrt( SUM(x - mean)^2 / (n - 1) )\n\n"
            "Steps: (1) find the mean, (2) subtract the mean from each value and "
            "square, (3) average those squares, (4) take the square root.\n\n"
            "A small standard deviation means the values cluster near the mean; a "
            "large one means they are spread out. It is used together with the "
            "mean to compare consistency - for example comparing two students' "
            "marks across papers."
        ),
        "subject": "Mathematics",
        "tags": ["standard deviation", "statistics", "spread", "mean"],
        "confidence": 0.94,
    },
    {
        "question": "what is an algorithm",
        "answer": (
            "An **algorithm** is a finite, ordered set of unambiguous steps that "
            "solves a problem or completes a task.\n\n"
            "Properties: it must be **finite** (it ends), **definite** (each step "
            "is clear), have **input** and **output**, and be **effective** (each "
            "step is doable).\n\n"
            "Example - finding the largest number in a list:\n"
            "```\n"
            "largest = first item\n"
            "for each remaining item:\n"
            "    if item > largest: largest = item\n"
            "output largest\n"
            "```\n\n"
            "Algorithms are commonly expressed as pseudocode or flowcharts. "
            "Efficiency is described with Big-O notation, e.g. linear search is "
            "O(n) and binary search is O(log n)."
        ),
        "subject": "Computer Science",
        "tags": ["algorithm", "pseudocode", "flowchart", "programming"],
        "confidence": 0.94,
    },
    {
        "question": "what is inflation and its causes",
        "answer": (
            "**Inflation** is a sustained rise in the general price level, which "
            "means the purchasing power of money falls.\n\n"
            "It is measured with the Consumer Price Index (CPI): "
            "inflation rate = ((CPI this year - CPI last year)/CPI last year) x 100.\n\n"
            "**Causes:**\n"
            "- **Demand-pull** - aggregate demand grows faster than output.\n"
            "- **Cost-push** - higher costs of production (wages, fuel, imports).\n"
            "- **Monetary** - too much money chasing too few goods.\n"
            "- **Imported inflation** - higher prices of imported goods and a "
            "weakening exchange rate.\n\n"
            "**Effects:** savers lose, borrowers gain, exports become less "
            "competitive. Remedies: contractionary monetary policy (higher "
            "interest rates), fiscal discipline, supply-side policies."
        ),
        "subject": "Economics",
        "tags": ["inflation", "cpi", "demand pull", "cost push"],
        "confidence": 0.94,
    },
    {
        "question": "what is elasticity of demand",
        "answer": (
            "**Price elasticity of demand (PED)** measures how responsive quantity "
            "demanded is to a change in price:\n\n"
            "PED = (% change in quantity demanded) / (% change in price)\n\n"
            "- PED > 1: elastic (luxuries, many substitutes) - cutting price raises "
            "revenue\n"
            "- PED < 1: inelastic (necessities, few substitutes) - raising price "
            "raises revenue\n"
            "- PED = 1: unitary elasticity\n"
            "- PED = 0: perfectly inelastic\n\n"
            "Example: price rises 10% and quantity falls 25%: PED = -2.5, so demand "
            "is elastic (the sign is normally ignored in exams, magnitude matters)."
        ),
        "subject": "Economics",
        "tags": ["elasticity", "demand", "ped", "price"],
        "confidence": 0.94,
    },
    {
        "question": "how do I structure a GCE essay or composition",
        "answer": (
            "Use a clear four-part structure:\n\n"
            "**1. Introduction (1 paragraph):** define the key terms in the "
            "question, give context and state your line of argument.\n"
            "**2. Body (3-5 paragraphs):** one developed point per paragraph. "
            "Use **PEE** - Point, Evidence/Example, Explanation. Link each "
            "paragraph back to the question.\n"
            "**3. Counter-argument (1 paragraph):** show the other side then "
            "rebut it. That is where A-grade marks come from.\n"
            "**4. Conclusion (1 paragraph):** summarise and give a clear, "
            "justified judgement. Never introduce new material.\n\n"
            "Exam tips: answer the exact question asked, use connectives "
            "(however, therefore, consequently), keep 5-8 words of technical "
            "vocabulary per paragraph, and leave 3 minutes to proofread."
        ),
        "subject": "English Language",
        "tags": ["essay", "composition", "structure", "writing"],
        "confidence": 0.93,
    },
    {
        "question": "what is the capital of Cameroon / facts about Cameroon",
        "answer": (
            "**Yaounde** is the political capital of Cameroon; **Douala** is the "
            "largest city and economic capital.\n\n"
            "Key facts:\n"
            "- Bilingual (English and French) with 10 regions.\n"
            "- Gained independence from France in 1960, and Southern Cameroons "
            "joined after a 1961 plebiscite, forming the Federal Republic; it "
            "became a unitary state in 1972.\n"
            "- Official languages: English and French. Currency: Central African "
            "CFA franc (XAF).\n"
            "- Mount Cameroon (about 4,040 m) is the highest peak in West Africa "
            "and an active volcano.\n"
            "- Major exports: cocoa, coffee, timber, cotton, crude oil, bananas.\n"
            "- Examination bodies: the Cameroon GCE Board (O and A Level) and "
            "HND/Concours administered by MINESUP."
        ),
        "subject": "Geography",
        "tags": ["cameroon", "capital", "yaounde", "facts"],
        "confidence": 0.93,
    },
]


# CHUNK_MARKER
