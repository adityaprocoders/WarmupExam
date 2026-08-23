import Listing from "../models/listing.js";
import Test from "../models/Test.js";
import router from "../routes/ownerRoutes.js";
import Category from "../models/Category.js";
import { getValidEnrollments } from "../utils/cleanupHelpers.js";

export const home = async (req, res) => {
    const isOwner = req.user && req.user.role === "owner";

    const filter = isOwner ? {} : { visibility: "public" };
     const tests = await Listing.find(filter)
        .populate("category", "name icon")
        .limit(6)
        .lean();

    const categories = await Category.find({}).sort({ createdAt: -1 }).lean();

const categoryIds = categories.map(c => c._id);
const listingCounts = await Listing.aggregate([
    { $match: { category: { $in: categoryIds } } },
    { $group: { _id: "$category", count: { $sum: 1 } } }
]);

const countMap = {};
listingCounts.forEach(c => { countMap[String(c._id)] = c.count; });

categories.forEach(c => {
    c.examCount = countMap[String(c._id)] || 0;
});


    // Total tests count nikalo har listing ke liye
    const listingIds = tests.map(l => l._id);
    const testCounts = await Test.aggregate([
        { $match: { listing: { $in: listingIds } } },
        { $group: { _id: "$listing", count: { $sum: 1 } } }
    ]);
    const testCountMap = {};
    testCounts.forEach(t => { testCountMap[String(t._id)] = t.count; });

    tests.forEach(l => {
        l.totalTestCount = testCountMap[String(l._id)] || 0;
    });

    const { enrolledIds, enrolledExpiryMap } = getValidEnrollments(req.user);

    res.render("pages/home", {
    tests,
    categories,
    enrolledIds,
    enrolledExpiryMap,
    isOwner,
    title: "India's Smartest Mock Test Platform | WarmupExam",
    description:
    "Practice mock tests, PYQs & get AI-powered performance analysis and rank prediction for SSC, NIMCET, Defence, JEE, NEET, UPSC & more on WarmupExam.",
    keywords:
        "WarmupExam, mock test, AIR mock test, AIR Rank, online mock test India, CUET mock test, UPSC mock test, JEE mock test, SSC mock test, GATE mock test, CAT mock test, NEET mock test, CUET mock test, rank predictor, negative marking test series, AI performance analysis, previous year questions PYQ",
    canonicalUrl: "https://warmupexam.com/"
});
};

export const aboutUs = (req, res) => res.render("pages/UI/AboutUs", {
    title: "About Us - Built by Aspirants Who Sat These Exams",
    description:
        "WarmupExam was built by aspirants frustrated with PDF test series that didn't match the real exam. Learn our mission to give every serious aspirant an honest practice environment.",
    keywords:
        "about WarmupExam, mock test platform India, exam preparation startup, rank predictor, weak area analysis",
    canonicalUrl: "https://warmupexam.com/aboutUs"
});

export const contactUs = (req, res) => res.render("pages/UI/contactUs", {
    title: "Contact Us - Get Support for Mock Tests & Subscriptions",
    description:
        "Need help with mock tests, subscriptions, payments or AI analysis? Contact the WarmupExam support team — we respond within 24 hours.",
    keywords:
        "WarmupExam support, contact WarmupExam, mock test help, payment issue exam platform",
    canonicalUrl: "https://warmupexam.com/contactUs"
});

 export const privacyPolicy = (req, res) => res.render("pages/UI/privacyPolicy", {
    title: "Privacy Policy",
    description:
        "Learn how WarmupExam collects, uses and protects your personal information, payment data and mock test performance history.",
    keywords: "WarmupExam privacy policy, data protection, student data security",
    canonicalUrl: "https://warmupexam.com/privacy-Policy"
});

export const termsOfUse = (req, res) => res.render("pages/UI/termsOfUse", {
    title: "Terms & Conditions",
    description:
        "Read WarmupExam's Terms & Conditions covering account registration, subscription and payment terms, refund policy, and platform usage rules.",
    keywords: "WarmupExam terms and conditions, refund policy, subscription terms",
    canonicalUrl: "https://warmupexam.com/Terms-&-Conditions"
});

export const features = (req, res) => res.render("pages/UI/features", {
    title: "Features - Real Exam Simulation, AI Analysis & Rank Prediction",
    description:
        "Explore WarmupExam's features: true negative marking, subject-wise timers, weak-area finder, rank prediction, previous year questions and deep performance analytics.",
    keywords:
        "mock test features, negative marking, rank predictor, weak area finder, AI performance analysis, previous year questions",
    canonicalUrl: "https://warmupexam.com/features"
});

export const help = (req, res) => res.render("pages/UI/help-center", {
    title: "Help Center - FAQs on Payments, Tests, Account & AI Reports",
    description:
        "Find quick answers about WarmupExam mock tests, payments, account settings, Rank Predictor, Weak Area Finder, and Smart Performance Reports. Get help fast.",
    keywords:
        "warmupexam help center, mock test faq, payment issues, rank predictor faq, weak area finder, smart performance report, account support",
    canonicalUrl: "https://warmupexam.com/help"
});

export default router;