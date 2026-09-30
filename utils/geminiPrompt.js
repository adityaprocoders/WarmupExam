// Compact, strict prompt — short keys = kam output tokens, strict rules = better fidelity
// count = user ne UI se jitne questions maange hain
export function buildAIExtractPrompt(count) {
    return `
Extract exam questions from the given content (image/text/pdf).
Return ONLY a JSON array, no explanation, no markdown, no code fences.

QUESTION COUNT — VERY IMPORTANT:
- The source may contain more, fewer, or exactly ${count} questions.
- If the source has ${count} or MORE questions: select EXACTLY ${count} questions, spread across the entire source (beginning, middle, end) — do NOT just take the first ${count} you see. Pick a random/diverse spread so different topics/sections are represented.
- If the source has FEWER than ${count} questions: extract ALL of them (do not invent or fabricate extra questions to reach ${count}).
- Never fabricate a question that is not actually present in the source.
- Your final output array must contain AT MOST ${count} items — never more than ${count}, even if more exist in the source.

Each item schema (use these EXACT short keys):
{
  "q": "question text",
  "type": "mcq" | "multiple" | "integer",
  "opts": ["option1","option2","option3","option4"],
  "ans": [0],
  "numAns": null,
  "sol": "solution, max 40 words",
  "subj": "subject name or General",
  "topic": "topic name or empty string",
  "diff": "easy" | "medium" | "hard"
}

CRITICAL RULES:
1. FIDELITY: Copy the question text and options EXACTLY as given in the source. Do NOT paraphrase, reword, simplify, or "improve" the wording. Preserve the original language and phrasing exactly.
2. MATH/FORMULAS: If the question contains any mathematical expression, equation, fraction, exponent, or symbol, write it using LaTeX syntax wrapped in single dollar signs, e.g. $x^2 + 3x = 0$, $\\frac{1}{2}$, $\\sqrt{x}$. Do NOT use plain-text approximations like "x^2" or "1/2" outside LaTeX — always wrap them in $...$.
3. "type": mcq = single correct option, multiple = more than one correct, integer = numeric answer (no options).
4. "ans": array of correct option INDEXES (0-based, matching position in "opts"). Empty array for integer type.
5. "numAns": only for integer type, else null.
6. "opts": empty array for integer type.
7. "sol": Explain briefly WHY the answer is correct. STRICT LIMIT: maximum 40 words. Use LaTeX for any math in the solution too.
8. If subject/topic is not explicitly stated, infer the closest reasonable value from context — do not leave blank unless truly unknown.
9. If you cannot confidently determine the correct answer, still include the question with your best-guess answer — never skip a question.
10. Return ONLY the JSON array. No extra text before or after.
`.trim();
}


const diffMap = { easy: "Easy", medium: "Medium", hard: "Hard" };
export function toSchemaDifficulty(level) {
    const s = String(level || "").toLowerCase();
    if (s.startsWith("easy")) return "Easy";
    if (s.startsWith("hard")) return "Hard";
    return "Medium";
}
 


// String-aware sanitizer: JSON string literals ke andar hi fix apply karta hai.
// Fixes 2 cheezein jo Gemini se aksar aati hain:
//   1. LaTeX backslashes (\times, \frac, \{, \phi, etc.) jo JSON ke liye
//      invalid escape hain (sirf " \\ / n r u hi safe hain).
//   2. Raw/literal control characters (real newline, tab) jo string ke
//      andar bina \n \t escape ke aa jaate hain.
function sanitizeGeminiJsonText(text) {
    const SAFE_ESCAPE_CHARS = new Set(['"', "\\", "/", "n", "r", "u"]);
    let result = "";
    let inString = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];

        if (!inString) {
            if (ch === '"') inString = true;
            result += ch;
            continue;
        }

                if (ch === "\\") {
            const next = text[i + 1];
            if (next !== undefined && SAFE_ESCAPE_CHARS.has(next)) {
                result += ch + next; // pura valid escape pair ek saath copy karo
                i++; // agla character skip karo, usse dobara process mat karo
            } else {
                result += "\\\\";
            }
            continue;
        }

        if (ch === '"') {
            inString = false;
            result += ch;
            continue;
        }

        if (ch === "\n") { result += "\\n"; continue; }
        if (ch === "\r") { result += "\\r"; continue; }
        if (ch === "\t") { result += "\\t"; continue; }

        result += ch;
    }

    return result;
}




// Agar Gemini ka response maxOutputTokens hit karke beech me hi kat gaya ho,
// to array ke aakhri INCOMPLETE object ko hata kar jitne COMPLETE objects mile
// hain unhi ko salvage karta hai — poora response fail karne ke bajaye.
function repairTruncatedJsonArray(text) {
    const trimmed = text.trim();
    if (!trimmed.startsWith("[")) return null;

    // Aakhri "}," ya "}" (jo array ke andar ek object khatam karta hai) dhoondo
    const lastBrace = trimmed.lastIndexOf("}");
    if (lastBrace === -1) return null;

    const candidate = trimmed.slice(0, lastBrace + 1) + "]";
    try {
        const parsed = JSON.parse(candidate);
        return Array.isArray(parsed) ? parsed : null;
    } catch (_) {
        return null;
    }
}

// Gemini response ko parse + validate karta hai
export function parseAIQuestions(rawText) {
    let data;
    const cleaned = sanitizeGeminiJsonText(
        String(rawText || "").replace(/```json|```/g, "").trim()
    );

        try {
        data = JSON.parse(cleaned);
    } catch (parseErr) {
       
        const posMatch = parseErr.message.match(/position (\d+)/);
        if (posMatch) {
            const pos = parseInt(posMatch[1]);
             
        }
        // Fallback 1: kabhi kabhi response maxOutputTokens hit karke beech me kat jata hai —
        // jitne complete questions mile hain unhi ko salvage karo
        data = repairTruncatedJsonArray(cleaned);
        if (!data) {
            throw new Error("The AI response is not valid JSON (the response may have been truncated; try increasing the token limit).");
        }
        console.warn(`The AI response was truncated; salvaged ${data.length} complete question(s).`);
    }

    if (!Array.isArray(data)) throw new Error("The AI response is not an array.");

    return data
        .filter((item) => item && item.q && item.type)
        .map((item) => ({
            question: String(item.q || "").trim(),
            type: ["mcq", "multiple", "integer"].includes(item.type) ? item.type : "mcq",
            options: Array.isArray(item.opts) ? item.opts.map((o) => ({ text: String(o || "").trim(), image: null })) : [],
            correctAnswers: Array.isArray(item.ans) ? item.ans.filter((n) => Number.isInteger(n)) : [],
            numericAnswer: typeof item.numAns === "number" ? item.numAns : null,
            solution: String(item.sol || "").trim(),
            subject: String(item.subj || "General").trim(),
            topic: String(item.topic || "").trim(),
            difficulty: toSchemaDifficulty(item.diff),
        }))
        .filter((q) => q.question.length > 0);
}