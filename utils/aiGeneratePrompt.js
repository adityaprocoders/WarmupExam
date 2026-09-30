// Generate mode: chapter (image/pdf/text) padhke naye exam-style questions.
// Output format extract wale jaisa hi (short keys) taaki parseAIQuestions chale.

export function parseDifficulty(raw) {
    try {
        const d = typeof raw === "string" ? JSON.parse(raw) : raw;
        const p = { easy: Number(d?.easy) || 0, medium: Number(d?.medium) || 0, hard: Number(d?.hard) || 0 };
        return p.easy + p.medium + p.hard === 100 ? p : null;
    } catch (_) { return null; }
}

// wizard / generatePaper wala hi formula
function diffCounts(total, pct) {
    const easy = Math.round((pct.easy / 100) * total);
    const medium = Math.round((pct.medium / 100) * total);
    return { easy, medium, hard: Math.max(0, total - easy - medium) };
}

export function buildAIGeneratePrompt(count, pct) {
    const d = diffCounts(count, pct);
    return `
You are a senior subject teacher and a professional exam paper-setter with 15+ years of experience.
The given content (image/text/pdf) is STUDY MATERIAL (a chapter or notes), NOT a question paper.
Do NOT extract or copy questions from it, even if it contains some. CREATE new questions.

STEP 1 (silent, do not output): study the chapter. Identify key concepts, definitions, rules, formulas,
cause-effect logic, exceptions, and common student mistakes.

STEP 2: create exactly ${count} ORIGINAL MCQs in real competitive-exam quality.
Return ONLY a JSON array, no explanation, no markdown, no code fences.

DIFFICULTY (exact counts):
- easy: ${d.easy}  (direct concept / direct formula, single step)
- medium: ${d.medium} (two-step reasoning, needs clear understanding)
- hard: ${d.hard}  (merge of 2-3 concepts, pattern-based logical application, close distractors)

QUESTION STYLES - use a balanced mix of ALL of these across the paper:
conceptual, logical reasoning, application (real-life / numerical / case-based), direct concept,
direct formula, merge-concept (2-3 topics in one question), exam-pattern logical application,
and mixed formats (statement-based, assertion-reason, match-the-following, "which is NOT correct").
Easy questions should lean to direct concept/formula; hard questions to merge-concept and pattern-based application.

Each item schema (use these EXACT short keys):
{
  "q": "question text",
  "type": "mcq",
  "opts": ["option1","option2","option3","option4"],
  "ans": [0],
  "numAns": null,
  "sol": "solution, max 40 words",
  "subj": "subject name",
  "topic": "specific sub-topic tested",
  "diff": "easy" | "medium" | "hard"
}

QUALITY RULES:
1. Test understanding. Never copy or lightly rephrase sentences from the material.
2. Exactly 4 options and exactly 1 correct answer. Verify the answer twice before writing it.
3. Distractors must be plausible (built from real student misconceptions), similar in length and style.
4. "All/None of the above" at most once in the whole set.
5. The question must not hint at its own answer. Do not make the longest option the correct one.
6. Spread the correct answer evenly across all 4 positions.
7. Cover different parts of the chapter. No duplicate or near-duplicate questions.
8. Numerical questions must have clean, verifiable numbers.
9. Write in the SAME language as the material (Hindi / English / Hinglish). Use exam-standard terms.
10. MATH/FORMULAS: write every mathematical expression in LaTeX wrapped in single dollar signs, e.g. $x^2 + 3x = 0$, $\\frac{1}{2}$. Never use plain-text approximations outside LaTeX.
11. "sol": explain briefly WHY the answer is correct. STRICT LIMIT: 40 words. LaTeX for math.
12. "ans": array with ONE index (0-based) matching position in "opts".
13. Return ONLY the JSON array with exactly ${count} items.
`.trim();
}

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9\u0900-\u097f]/g, "");

// Generate mode ka quality gate + correct option ki position shuffle
export function cleanGenerated(list) {
    const seen = new Set();
    const out = [];
    for (const q of list || []) {
        if (!q || q.question.length < 10) continue;
        if (!Array.isArray(q.options) || q.options.length !== 4) continue;
        const texts = q.options.map((o) => String(o?.text || "").trim());
        if (texts.some((t) => !t) || new Set(texts.map(norm)).size !== 4) continue;
        if (!Array.isArray(q.correctAnswers) || q.correctAnswers.length !== 1) continue;
        const c = q.correctAnswers[0];
        if (!(c >= 0 && c <= 3)) continue;

        const key = norm(q.question).slice(0, 80);
        if (seen.has(key)) continue;
        seen.add(key);

        // "above/none of/both" wale options ho to order mat chhedo
        const hasRef = texts.some((t) => /\b(above|both|none of|all of)\b|उपरोक्त|इनमें से कोई|दोनों/i.test(t));
        let options = q.options, correct = c;
        if (!hasRef) {
            const idx = [0, 1, 2, 3];
            for (let i = 3; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
            options = idx.map((i) => q.options[i]);
            correct = idx.indexOf(c);
        }
        out.push({ ...q, type: "mcq", options, correctAnswers: [correct] });
    }
    return out;
}