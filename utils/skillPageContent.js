export const SITE = "https://warmupexam.com";

export const ALL_TOOLS = [
    { key: "typing", name: "Typing Speed Test", desc: "Check your WPM and accuracy in English or Hindi.", href: "/skill-tests/typing-test", icon: "fa-keyboard" },
    { key: "dataEntry", name: "Data Entry Speed Test", desc: "Practice numbers, codes and table-style data entry.", href: "/skill-tests/data-entry-test", icon: "fa-table-cells" },
    { key: "calculation", name: "Calculation Speed Test", desc: "Train your mental maths speed with timed questions.", href: "/skill-tests/calculation-test", icon: "fa-calculator" },
    { key: "custom", name: "Custom Mock Test Generator", desc: "Build your own exam-style practice paper.", href: "/custom-test", icon: "fa-wand-magic-sparkles" }
];

export const skillContent = {

    // ====================== TYPING ======================
    typing: {
        key: "typing",
        name: "Typing Speed Test",
        schemaName: "Free Online Typing Speed Test",
        langCodes: ["en", "hi"],
        h1Lead: "Free Online Typing Test –",
        h1Accent: "Check Your WPM & Accuracy",
        intro: "Take a free typing test in English or Hindi. Choose your own time, word count and difficulty, then get an instant report of your WPM, accuracy and errors. No signup, no download — just start typing.",
        badges: ["English & Hindi", "100% Free", "No Signup", "Instant Report"],
        stats: [
            { v: "2–20 min", l: "Flexible timer" },
            { v: "100–500+", l: "Word counts" },
            { v: "3 Levels", l: "Easy to Hard" },
            { v: "Live", l: "WPM graph" }
        ],
        steps: [
            { title: "Choose your settings", text: "Select language, time, word count and difficulty from the configuration bar." },
            { title: "Click Generate", text: "A fresh set of words is created every time, so no two tests are the same." },
            { title: "Start typing", text: "Click the text box and type. The timer starts on your first keystroke." },
            { title: "Review your report", text: "Check WPM, accuracy, errors and your speed graph, then try again to beat it." }
        ],
        categories: [
            { icon: "fa-language", title: "English Typing Test", text: "Practice common English words with a live WPM and accuracy report." },
            { icon: "fa-font", title: "Hindi Typing Test", text: "Prepare for Hindi typing exams with a dedicated Hindi word set." },
            { icon: "fa-gauge-high", title: "Easy, Medium & Hard", text: "Start with short simple words and move to longer, tougher words." },
            { icon: "fa-stopwatch", title: "Timed Tests", text: "Pick 2, 3, 5, 10, 15 or 20 minutes, or set your own custom time." },
            { icon: "fa-file-lines", title: "Word Count Practice", text: "Practice with 100, 200, 300, 500 or any custom number of words." },
            { icon: "fa-bullseye", title: "Accuracy Practice", text: "Every mistyped character is tracked so you can fix weak spots." }
        ],
        benefits: [
            { icon: "fa-bolt", title: "Increase your WPM", text: "Regular timed practice steadily pushes your speed higher." },
            { icon: "fa-crosshairs", title: "Improve accuracy", text: "See exactly how many errors you make and work on reducing them." },
            { icon: "fa-brain", title: "Build muscle memory", text: "Repeated practice helps your fingers find keys without thinking." },
            { icon: "fa-chart-line", title: "Track your progress", text: "Your result is compared with your previous test of the same type." },
            { icon: "fa-graduation-cap", title: "Be exam ready", text: "Get comfortable with the timed pressure of real typing tests." },
            { icon: "fa-gift", title: "Free, anywhere", text: "No account or software needed. Practice on any device with a browser." }
        ],
        tips: [
            { title: "Sit with the right posture", text: "Keep your back straight, wrists relaxed and screen at eye level to type longer without fatigue." },
            { title: "Learn the home row", text: "Rest your fingers on the home row and always return to it after each key." },
            { title: "Accuracy first, speed later", text: "Slow, clean typing builds the habits that later make fast typing possible." },
            { title: "Stop looking at the keyboard", text: "Keep your eyes on the text. Touch typing is the biggest single speed upgrade." },
            { title: "Practice a little every day", text: "15–30 minutes daily beats a single long session once a week." },
            { title: "Set up your keyboard first", text: "For Hindi tests, enable your device's Hindi keyboard before you start the timer." }
        ],
        examNote: "Required typing speed differs by exam and post. Always check the latest official notification.",
        exams: [
            { name: "SSC CHSL (LDC / JSA / DEO)", text: "Skill-test stage for clerk and data entry posts." },
            { name: "SSC Stenographer", text: "Typing speed is important in the transcription round." },
            { name: "RRB NTPC (Clerk cum Typist)", text: "Typing test for clerical and typist posts." },
            { name: "High Court & District Court", text: "Clerk, typist and stenographer recruitment tests." },
            { name: "State Govt. Clerk & Typist", text: "Many state departments test English or Hindi typing." },
            { name: "Private typing & BPO jobs", text: "Content, transcription and back-office roles value fast typists." }
        ],
        benchTitle: "What does your typing speed mean?",
        bench: [
            { label: "Beginner", range: "Below 25 WPM" },
            { label: "Average", range: "25 – 40 WPM" },
            { label: "Good", range: "40 – 60 WPM" },
            { label: "Excellent", range: "60+ WPM" }
        ],
        faqs: [
            { q: "What is a good typing speed in WPM?", a: "Most people type around 40 WPM. 40–60 WPM is considered good and 60+ is excellent. Many government typing tests ask for roughly 30–35 WPM, but it differs by exam, so check the latest notification." },
            { q: "How is WPM calculated in this typing test?", a: "WPM is the number of correctly typed words divided by the test time in minutes. A word counts only when it is typed exactly right." },
            { q: "How is typing accuracy calculated?", a: "Accuracy is correct characters divided by total characters typed, multiplied by 100. Skipped or mistyped characters lower it." },
            { q: "Is this online typing test really free?", a: "Yes. It is 100% free, needs no signup and works directly in your browser." },
            { q: "Can I take a Hindi typing test here?", a: "Yes. Select Hindi in the language option and enable a Hindi keyboard (for example Inscript or phonetic) on your device before you start." },
            { q: "Can I correct mistakes with Backspace?", a: "Yes. Your result is based on the final text you typed, so corrected mistakes do not count against you, but uncorrected ones reduce accuracy." },
            { q: "How often should I practice typing?", a: "Short daily sessions of 15–30 minutes work better than one long weekly session. Focus on accuracy first, then build speed." },
            { q: "Does the test work on mobile phones?", a: "It opens in mobile browsers, but a physical keyboard gives the most reliable WPM for exam preparation." }
        ]
    },

    // ====================== DATA ENTRY ======================
    dataEntry: {
        key: "dataEntry",
        name: "Data Entry Speed Test",
        schemaName: "Free Online Data Entry Speed Test",
        langCodes: ["en"],
        h1Lead: "Free Data Entry Speed Test –",
        h1Accent: "Check Your Typing Speed & Accuracy",
        intro: "Practice data entry with numbers, alphanumeric codes and real table-style records (name, ID, address, amount, date). Get instant entries-per-minute and accuracy results, free and without signup.",
        badges: ["Numbers & Codes", "Table Data Entry", "100% Free", "Instant Report"],
        stats: [
            { v: "3 Modes", l: "Numbers, codes, table" },
            { v: "2–10 min", l: "Flexible timer" },
            { v: "3 Levels", l: "Easy to Hard" },
            { v: "EPM", l: "Entries per minute" }
        ],
        steps: [
            { title: "Pick data type and time", text: "Choose Numbers, Alphanumeric Codes or Table data, then set time and difficulty." },
            { title: "Click Generate", text: "Fresh random entries are created every time you start." },
            { title: "Type the shown data", text: "Copy the reference value exactly and press Enter. In table mode, Enter moves to the next field." },
            { title: "Check your report", text: "See entries per minute, accuracy, errors and your speed graph." }
        ],
        categories: [
            { icon: "fa-hashtag", title: "Numeric Data Entry", text: "Practice number strings from 4 to 10 digits for numeric keypad speed." },
            { icon: "fa-barcode", title: "Alphanumeric Codes", text: "Type IDs and codes that mix letters, digits and hyphens." },
            { icon: "fa-table", title: "Table / Mixed Entry", text: "Enter name, ID, address, amount and date, just like real office records." },
            { icon: "fa-seedling", title: "Easy Level", text: "Short values to build rhythm and confidence." },
            { icon: "fa-fire", title: "Hard Level", text: "Longer values and larger amounts for exam-level pressure." },
            { icon: "fa-stopwatch", title: "Custom Timer", text: "Select 2, 3, 5 or 10 minutes, or set any custom duration." }
        ],
        benefits: [
            { icon: "fa-keyboard", title: "Faster numeric typing", text: "Build speed on digits, which matter most in data entry jobs." },
            { icon: "fa-check-double", title: "Fewer errors", text: "Practice careful copying so mistakes drop as speed rises." },
            { icon: "fa-eye", title: "Better eye-hand flow", text: "Train your eyes to read the source while your fingers keep typing." },
            { icon: "fa-briefcase", title: "Job ready", text: "Experience real record formats used in DEO and back-office work." },
            { icon: "fa-bullseye", title: "Sharper focus", text: "Timed practice builds concentration for long entry sessions." },
            { icon: "fa-gift", title: "Free, anywhere", text: "No account or software needed, practice in any browser." }
        ],
        tips: [
            { title: "Use touch typing for digits", text: "Learn the number row or keypad so you never look down while entering data." },
            { title: "Keep eyes on the source", text: "Read the next value while typing the current one to save time." },
            { title: "Copy exactly", text: "Capital letters, commas, hyphens and slashes must match exactly." },
            { title: "Amount without ₹", text: "In table mode, type only the number with commas, for example 12,500." },
            { title: "Accuracy before speed", text: "One wrong field makes the whole entry incorrect, so slow down slightly." },
            { title: "Practise in short blocks", text: "Do 5-minute rounds daily and increase the difficulty step by step." }
        ],
        examNote: "Data entry exams often measure key depressions per hour. Check the latest official notification for your exam.",
        exams: [
            { name: "SSC CHSL (Data Entry Operator)", text: "DEO post needs a data entry speed test." },
            { name: "SSC CGL (DEST posts)", text: "Some posts require a Data Entry Speed Test." },
            { name: "RRB / Railway DEO", text: "Data entry operator roles in railway recruitment." },
            { name: "High Court & State Govt. DEO", text: "Courts and state departments hire data entry operators." },
            { name: "Bank & PSU back-office", text: "Clerical and back-office roles involve heavy data entry." },
            { name: "Private BPO / KPO jobs", text: "Entry-level data entry jobs value speed and accuracy." }
        ],
        benchTitle: "What does your accuracy mean?",
        bench: [
            { label: "Needs work", range: "Below 90%" },
            { label: "Average", range: "90 – 95%" },
            { label: "Good", range: "95 – 98%" },
            { label: "Excellent", range: "98%+" }
        ],
        faqs: [
            { q: "What is a data entry speed test?", a: "It measures how fast and accurately you can copy data such as numbers, codes and records into a form. It is used in many government and private data entry recruitments." },
            { q: "How is entries per minute (EPM) calculated?", a: "EPM is the number of fully correct entries divided by the test time in minutes. In table mode an entry counts only when every field matches." },
            { q: "How is accuracy calculated?", a: "Accuracy is the number of correct fields divided by the total fields you attempted, multiplied by 100." },
            { q: "Is the test case-sensitive?", a: "Yes. Letters, spaces, commas and slashes must match exactly, so type each value precisely as shown." },
            { q: "Do I type the ₹ symbol in the amount field?", a: "No. Type only the number with its commas, for example 12,500. The ₹ sign is shown for reference only." },
            { q: "What is KDPH and how does it relate to this test?", a: "KDPH means key depressions per hour and is used in some government data entry exams. This tool reports entries per minute and accuracy, which together show how ready you are." },
            { q: "Which data type should I start with?", a: "Start with Numbers at Easy level, move to Alphanumeric Codes, then try Table data entry, which is closest to real exam and office work." },
            { q: "Is this data entry test free?", a: "Yes. It is completely free, needs no signup and runs in your browser." }
        ]
    },

    // ====================== CALCULATION ======================
    calculation: {
        key: "calculation",
        name: "Calculation Speed Test",
        schemaName: "Free Mental Math Calculation Speed Test",
        langCodes: ["en"],
        h1Lead: "Free Mental Math Test –",
        h1Accent: "Boost Your Calculation Speed & Accuracy",
        intro: "Practice addition, subtraction, multiplication and division against the clock. Get instant results with your questions-per-minute score and accuracy. Free, with no signup.",
        badges: ["Add, Sub, Mul, Div", "100% Free", "No Signup", "Instant Report"],
        stats: [
            { v: "5 Modes", l: "Incl. mixed" },
            { v: "2–10 min", l: "Flexible timer" },
            { v: "3 Levels", l: "Easy to Hard" },
            { v: "QPM", l: "Questions per minute" }
        ],
        steps: [
            { title: "Select operation and time", text: "Choose Mixed or a single operation, then set time and difficulty." },
            { title: "Click Generate", text: "New random questions are created every time." },
            { title: "Type and press Enter", text: "Solve each question in your head, type the answer and press Enter. The timer starts on your first keystroke." },
            { title: "Read your report", text: "See questions per minute, accuracy, correct and wrong answers." }
        ],
        categories: [
            { icon: "fa-plus", title: "Addition", text: "Add 2-digit to 4-digit numbers quickly and accurately." },
            { icon: "fa-minus", title: "Subtraction", text: "Subtract with always-positive answers to build a clean method." },
            { icon: "fa-xmark", title: "Multiplication", text: "From simple tables to two-digit by two-digit products." },
            { icon: "fa-divide", title: "Division", text: "Exact division questions with whole-number answers." },
            { icon: "fa-shuffle", title: "Mixed Mode", text: "All four operations in random order, like a real exam." },
            { icon: "fa-gauge-high", title: "Easy, Medium & Hard", text: "Scale the number size up as your speed improves." }
        ],
        benefits: [
            { icon: "fa-bolt", title: "Faster calculation", text: "Repeated drills make common sums feel automatic." },
            { icon: "fa-crosshairs", title: "Higher accuracy", text: "Track correct and wrong answers to see where you slip." },
            { icon: "fa-brain", title: "Sharper memory", text: "Tables and number patterns stay fresh with daily use." },
            { icon: "fa-clock", title: "Time management", text: "Get used to solving quickly under a running clock." },
            { icon: "fa-graduation-cap", title: "Exam confidence", text: "Quant and simplification sections feel easier with speed." },
            { icon: "fa-gift", title: "Free, anywhere", text: "No account or app needed, practice in any browser." }
        ],
        tips: [
            { title: "Learn tables up to 20", text: "Strong tables are the base of fast multiplication and division." },
            { title: "Memorise squares and cubes", text: "They appear everywhere in simplification and approximation." },
            { title: "Break numbers apart", text: "Solve 47 × 6 as (40 × 6) + (7 × 6) instead of in one jump." },
            { title: "Add from left to right", text: "Starting from the biggest digits lets you build the answer as you go." },
            { title: "Skip the calculator", text: "Keep paper and calculator away so your brain does the work." },
            { title: "Practise every day", text: "Ten focused minutes daily beats a long weekend session." }
        ],
        examNote: "Calculation speed helps across the quantitative sections of most competitive exams.",
        exams: [
            { name: "SSC CGL & CHSL", text: "Quantitative aptitude rewards fast, accurate calculation." },
            { name: "IBPS & SBI PO / Clerk", text: "Simplification, approximation and DI need quick maths." },
            { name: "RRB NTPC & Group D", text: "Mathematics section with many arithmetic questions." },
            { name: "CAT & MBA entrances", text: "Quant and data interpretation depend on calculation speed." },
            { name: "State police, SI & PSC exams", text: "Numerical ability appears in most state-level exams." },
            { name: "Campus & aptitude tests", text: "Company aptitude rounds are timed and number-heavy." }
        ],
        benchTitle: "What does your speed mean? (approx., Medium level)",
        bench: [
            { label: "Beginner", range: "Below 6 QPM" },
            { label: "Average", range: "6 – 12 QPM" },
            { label: "Good", range: "12 – 20 QPM" },
            { label: "Excellent", range: "20+ QPM" }
        ],
        faqs: [
            { q: "How is the calculation speed score (QPM) calculated?", a: "QPM is the number of correct answers divided by the test time in minutes." },
            { q: "Do wrong answers reduce my score?", a: "Wrong answers do not add to QPM and they lower your accuracy, so aim for both speed and correctness." },
            { q: "Are division answers always whole numbers?", a: "Yes. Every division question is exact and subtraction answers are always positive, so you never deal with decimals or negatives." },
            { q: "What is a good score for mental maths?", a: "It depends on difficulty, but 12–20 correct answers per minute on Medium is a strong target for most competitive exams." },
            { q: "Can I use a calculator?", a: "No. The test is built for mental calculation, so keep the calculator and paper away." },
            { q: "Which operation should I practise first?", a: "Start with Addition and Subtraction, then Multiplication, and finally Division and Mixed mode." },
            { q: "Is this calculation test free?", a: "Yes. It is free, needs no signup and works in your browser." },
            { q: "Can I use it on my phone?", a: "Yes. The answer box opens the numeric keypad on most phones, which makes it quick to use." }
        ]
    }
};