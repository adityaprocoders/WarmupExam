// Test Instructions modal ke saare static strings.
// Nayi language add karne ke liye bas ek naya key add karo (e.g. Bengali).

const strings = {
    English: {
        instructionsTitle: "Test Instructions",
        chooseLanguage: "Choose Language",
        minutesDuration: "Minutes Duration",
        attention: "Attention",
        readLead: "Please read all the instructions carefully before clicking on",
        proceed: "Proceed",
        readTail: ".",

        sec1: "1. Paper Pattern & Sections",
        questions: "Questions",
        timeAllocation: "Time Allocation:",
        mins: "mins",

        sec2: "2. Question Palette Guide",
        palNotVisited: "You have not visited the question yet.",
        palNotAnswered: "You have NOT answered the question.",
        palAnswered: "You have answered the question.",
        palMarked: "You have marked the question for review.",

        sec3: "3. Important Instructions",
        totalQuestions: "Total Questions:",
        totalMarks: "Total Marks:",
        rule1: "The marking scheme, question pattern and difficulty level are configured according to the selected test.",
        rule2: "You may navigate between questions at any time unless navigation restrictions are enabled for this test.",
        rule3: "Only saved responses and answered questions marked for review will be considered for evaluation.",
        rule4: "Questions left unanswered will not be considered for scoring.",
        progressLead: "Your progress is automatically saved whenever you click",
        saveNext: "Save & Next",
        progressOr: "or",
        markNext: "Mark for Review & Next",
        progressTail: ".",
        rule6: "The examination will be submitted automatically when the allotted time expires.",
        rule7: "Do not refresh, close, or navigate away from the browser window during the test.",
        rule8: "Ensure that your internet connection and device remain stable throughout the examination.",

        noteLabel: "Note:",
        noteLead: "This mock test follows the",
        noteTail: "examination interface. Please ensure your internet connection and device remain stable throughout the examination.",

        agree: "I have read and understood all the instructions. I declare that I am using a proper working device and agree to start the examination according to the rules.",
        cancel: "Cancel"
    },

    Hindi: {
        instructionsTitle: "परीक्षा निर्देश",
        chooseLanguage: "भाषा चुनें",
        minutesDuration: "मिनट की अवधि",
        attention: "ध्यान दें",
        readLead: "कृपया सभी निर्देशों को ध्यानपूर्वक पढ़ें, उसके बाद",
        proceed: "आगे बढ़ें",
        readTail: "पर क्लिक करें।",

        sec1: "1. प्रश्नपत्र का पैटर्न और सेक्शन",
        questions: "प्रश्न",
        timeAllocation: "समय आवंटन:",
        mins: "मिनट",

        sec2: "2. प्रश्न पैलेट गाइड",
        palNotVisited: "आपने इस प्रश्न को अभी तक नहीं देखा है।",
        palNotAnswered: "आपने इस प्रश्न का उत्तर नहीं दिया है।",
        palAnswered: "आपने इस प्रश्न का उत्तर दे दिया है।",
        palMarked: "आपने इस प्रश्न को समीक्षा (रिव्यू) के लिए चिह्नित किया है।",

        sec3: "3. महत्वपूर्ण निर्देश",
        totalQuestions: "कुल प्रश्न:",
        totalMarks: "कुल अंक:",
        rule1: "अंकन योजना, प्रश्नों का पैटर्न और कठिनाई स्तर चयनित टेस्ट के अनुसार निर्धारित किए गए हैं।",
        rule2: "जब तक इस टेस्ट में नेविगेशन पर प्रतिबंध न लगाया गया हो, आप किसी भी समय प्रश्नों के बीच आ-जा सकते हैं।",
        rule3: "मूल्यांकन के लिए केवल सेव किए गए उत्तर और रिव्यू के लिए चिह्नित किए गए उत्तरित प्रश्न ही गिने जाएँगे।",
        rule4: "जिन प्रश्नों का उत्तर नहीं दिया गया है, उन्हें स्कोरिंग में शामिल नहीं किया जाएगा।",
        progressLead: "जब भी आप",
        saveNext: "सेव करें और आगे बढ़ें",
        progressOr: "या",
        markNext: "रिव्यू के लिए चिह्नित करें और आगे बढ़ें",
        progressTail: "पर क्लिक करते हैं, आपकी प्रगति अपने-आप सेव हो जाती है।",
        rule6: "निर्धारित समय समाप्त होते ही परीक्षा अपने-आप सबमिट हो जाएगी।",
        rule7: "टेस्ट के दौरान ब्राउज़र विंडो को रिफ़्रेश, बंद या छोड़कर कहीं और न जाएँ।",
        rule8: "सुनिश्चित करें कि पूरी परीक्षा के दौरान आपका इंटरनेट कनेक्शन और डिवाइस स्थिर रहें।",

        noteLabel: "नोट:",
        noteLead: "यह मॉक टेस्ट",
        noteTail: "परीक्षा इंटरफ़ेस के अनुसार बनाया गया है। कृपया सुनिश्चित करें कि पूरी परीक्षा के दौरान आपका इंटरनेट कनेक्शन और डिवाइस स्थिर रहें।",

        agree: "मैंने सभी निर्देशों को पढ़ और समझ लिया है। मैं घोषणा करता/करती हूँ कि मैं सही ढंग से काम करने वाले डिवाइस का उपयोग कर रहा/रही हूँ और नियमों के अनुसार परीक्षा शुरू करने के लिए सहमत हूँ।",
        cancel: "रद्द करें"
    }
};

// Admin test banate waqt language free text me likhta hai ("hindi", "Hindi ", "हिंदी"...)
// isliye yaha sab alag spellings ko ek canonical naam par map karte hain.
const ALIASES = {
    hindi: "Hindi", hin: "Hindi", hi: "Hindi", "हिन्दी": "Hindi", "हिंदी": "Hindi",
    english: "English", eng: "English", en: "English"
};

export function canonicalLang(lang) {
    const raw = String(lang || "").trim();
    return ALIASES[raw.toLowerCase()] || raw;
}

// Language ka native display naam (dropdown me dikhane ke liye)
const languageLabels = {
    English: "English",
    Hindi: "हिन्दी (Hindi)"
};

export function getInstructionStrings(lang) {
    return { ...strings.English, ...(strings[canonicalLang(lang)] || {}) };
}

export function getLanguageLabel(lang) {
    return languageLabels[canonicalLang(lang)] || lang;
}

export const htmlLangCode = (lang) => (canonicalLang(lang) === "Hindi" ? "hi" : "en");

// Test ki asli (admin ne jaisi likhi) language names ke naam se bundle banata hai,
// taaki browser me bina kisi mapping ke seedha lookup ho sake.
export function buildInstructionBundle(langs) {
    const i18nAll = {}, langLabels = {}, htmlLangs = {};
    (langs || []).forEach(l => {
        i18nAll[l] = getInstructionStrings(l);
        langLabels[l] = getLanguageLabel(l);
        htmlLangs[l] = htmlLangCode(l);
    });
    return { i18nAll, langLabels, htmlLangs };
}