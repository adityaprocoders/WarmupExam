import Listing from "../models/listing.js";
import Section from "../models/Section.js";
import Folder from "../models/Folder.js";
import File from "../models/File.js";
import Test from "../models/Test.js";
import Attempt from "../models/TestAttempt.js";
import User from "../models/usersShema.js";
import ExpressError from "../utils/ExpressError.js";
import TestQuestion from "../models/TestQuestion.js";
import slugify from "slugify";
import cloudinary from "../config/cloudinary.js";
import ContentBlock from "../models/ContentBlock.js";
import Category from "../models/Category.js";
import { generatePlaceholderImage } from "../utils/placeholderImage.js";
import { notifyNewTestSeries } from "../utils/notifyNewTestSeries.js";
import mongoose from "mongoose";
import { getValidEnrollments } from "../utils/cleanupHelpers.js";
import { buildAboutTestSeries } from "../utils/aboutTestSeries.js";


export const allTests = async (req, res) => {
    const { exam, search, language, filter: filterTab } = req.query;

    const isOwner = req.user && req.user.role === "owner";
    const hasSearched = !!(exam || search);

    let baseFilter = {};
    if (!isOwner) baseFilter.visibility = "public";

    if (language) {
        baseFilter.language = {
            $regex: `^${language.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
            $options: "i"
        };
    }
    if (filterTab === "free") baseFilter.type = "Free";
    else if (filterTab === "paid") baseFilter.type = { $ne: "Free" };

    let allListings = [];
    let matchedListings = [];

    if (hasSearched) {
        allListings = await Listing.find(baseFilter).lean();
        if (filterTab === "latest") {
            allListings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        let searchFilter = { ...baseFilter };
        if (exam) {
            searchFilter.exam = exam;
        } else if (search) {
            searchFilter.$or = [
                { exam: { $regex: search, $options: "i" } },
                { title: { $regex: search, $options: "i" } }
            ];
        }
        matchedListings = await Listing.find(searchFilter).lean();
    }

    const combinedIds = [...matchedListings, ...allListings].map(l => l._id);
    const testCounts = await Test.aggregate([
        { $match: { listing: { $in: combinedIds } } },
        { $group: { _id: "$listing", count: { $sum: 1 } } }
    ]);
    const testCountMap = {};
    testCounts.forEach(t => { testCountMap[String(t._id)] = t.count; });

    matchedListings.forEach(l => { l.totalTestCount = testCountMap[String(l._id)] || 0; });
    allListings.forEach(l => { l.totalTestCount = testCountMap[String(l._id)] || 0; });

    const { enrolledIds, enrolledExpiryMap } = getValidEnrollments(req.user);

    const languages = (await Listing.distinct("language")).filter(Boolean).sort();

    const categories = await Category.find({}).sort({ createdAt: -1 }).lean();
    const listingCounts = await Listing.aggregate([
        { $group: { _id: "$category", count: { $sum: 1 } } }
    ]);
    const countMap = {};
    listingCounts.forEach(c => { countMap[String(c._id)] = c.count; });
    categories.forEach(c => { c.examCount = countMap[String(c._id)] || 0; });

    // ============================================================
    // 🔍 DYNAMIC SEO — search/exam/language ke basis pe
    // ============================================================

    const searchTerm = exam || search || "";
    let seoTitle, seoDescription, seoKeywords, canonicalUrl;

    if (searchTerm) {
        const matchCount = matchedListings.length;
        const langPart = language ? ` in ${language}` : "";

        seoTitle = `${searchTerm} Mock Test Series${langPart} | Free & Paid Practice Tests | WarmupExam`;

        seoDescription = matchCount > 0
            ? `Practice ${matchCount} ${searchTerm} mock test${matchCount > 1 ? "s" : ""}${langPart} with true negative marking, AI-powered weak-area analysis and rank prediction on WarmupExam.`
            : `Explore ${searchTerm} exam preparation resources and mock test series on WarmupExam. Browse all available test series for ${searchTerm}.`;

        seoKeywords = [
            `${searchTerm} mock test`,
            `${searchTerm} test series`,
            `${searchTerm} online test`,
            `${searchTerm} practice test`,
            `${searchTerm} exam preparation`,
            language ? `${searchTerm} ${language}` : null
        ].filter(Boolean).join(", ");

        const params = new URLSearchParams();
        if (exam) params.set("exam", exam);
        else if (search) params.set("search", search);
        if (language) params.set("language", language);
        canonicalUrl = `https://warmupexam.com/alltests?${params.toString()}`;

    } else {
        seoTitle = "All Test Series – UPSC, SSC, JEE, NEET, GATE & More | WarmupExam";
        seoDescription = "Browse mock test series for UPSC, SSC, Defence, JEE, NEET, GATE, CAT, CUET & 15+ competitive exams with true negative marking and AI-powered analysis.";
        seoKeywords = "mock test series, online test series, competitive exam preparation, UPSC mock test, SSC mock test, JEE mock test, NEET mock test, GATE mock test";
        canonicalUrl = "https://warmupexam.com/alltests";
    }

    res.render("test/alltest", {
        matchedListings,
        allListings,
        hasSearched,
        search: search || "",
        selectedExam: exam || "",
        selectedLanguage: language || "",
        selectedFilter: filterTab || "",
        languages,
        categories,
        csrfToken: req.csrfToken ? req.csrfToken() : "",
        enrolledIds,
        enrolledExpiryMap,
        title: seoTitle,
        description: seoDescription,
        keywords: seoKeywords,
        canonicalUrl
    });
};


export const searchTests = async (req, res) => {
    const keyword = req.query.keyword?.trim();
    if (!keyword) return res.json([]);

    const isOwner = req.user && req.user.role === "owner";
    const filter = {
        $or: [
            { exam: { $regex: keyword, $options: "i" } },
            { title: { $regex: keyword, $options: "i" } }
        ]
    };
    if (!isOwner) filter.visibility = "public";

    const tests = await Listing.find(filter).select("title exam slug").limit(8);

    res.json(tests);
};

export const showTest = async (req, res) => {
    const { slug } = req.params;
    let data = await Listing.findOne({ slug }).populate("contentBlocks");

    // Backward compatibility — agar purana ID-wala URL hit hua (Google index mein already hai)
    if (!data && mongoose.Types.ObjectId.isValid(slug)) {
        data = await Listing.findById(slug).populate("contentBlocks");
        if (data) {
            return res.redirect(301, `/test/${data.slug}`);
        }
    }

    if (!data) throw new ExpressError(404, "Test Not Found");
    const isOwner = req.user && req.user.role === "owner";

    const allBlocks = isOwner
        ? await ContentBlock.find().sort({ name: 1 })
        : [];

    // ✅ NEW: "Copy To..." modal ke liye — saari listings (id, title, exam) + exam-wise grouping
    let allListingsForCopy = [];
let examGroups = [];
if (isOwner) {
    // Exam Categories — SAARI listings se ban raha hai (poora coverage, search yahan bhi kaam karega)
    const everyListing = await Listing.find()
        .select("exam")
        .lean();

    const examCountMap = {};
    everyListing.forEach(l => {
        examCountMap[l.exam] = (examCountMap[l.exam] || 0) + 1;
    });
    examGroups = Object.keys(examCountMap)
        .sort()
        .map(exam => ({ name: exam, count: examCountMap[exam] }));

    // Individual Test Series — sirf latest 5 (quick-access shortcut)
    allListingsForCopy = await Listing.find()
        .select("title exam")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();
}

    const { enrolledIds } = getValidEnrollments(req.user);

    const totalTestCount = await Test.countDocuments({ listing: data._id }); 
    const aboutTestSeries = await buildAboutTestSeries(data._id, Section, Test); 


    res.render("test/show", {
        listing: data,
        enrolledIds,
        isOwner,
        totalTestCount,
        allBlocks,
         aboutTestSeries,
        allListingsForCopy, // 👈 naya
        examGroups,         // 👈 naya
        title: `${data.title} | WarmupExam`,
        description: data.shortDescription
            ? data.shortDescription.replace(/\s+/g, ' ').trim()
            : `Practice ${data.title} with realistic mock tests, true negative marking, AI-powered analysis and AIR rank prediction on WarmupExam.`
    });
};

export const renderNewTest = async (req, res) => {
    const categories = await Category.find({}).select("name _id").sort({ name: 1 }).lean();
    res.render("test/new", { categories, robots: "noindex, nofollow" });
};

// rankPredictorData me se empty/invalid rows hata do
function cleanRankPredictorData(raw) {
    if (!raw) return [];
    const arr = Array.isArray(raw) ? raw : Object.values(raw);
    return arr
        .filter(r => r && r.marks !== "" && r.rank !== "" && r.marks !== undefined && r.rank !== undefined)
        .map(r => ({ marks: Number(r.marks), rank: Number(r.rank) }));
}

export const createTest = async (req, res) => {
    const data = req.body.listing;
    data.originalPrice = Number(data.originalPrice) || 0;
    data.discountPercentage = Number(data.discountPercentage) || 0;
    data.price = Math.round(data.originalPrice - (data.originalPrice * data.discountPercentage / 100));
    data.validityDays = Number(data.validityDays) || 365;
    data.rankPredictorData = cleanRankPredictorData(data.rankPredictorData);
    data.qualify = data.qualify || false;

    if (req.file) {
        data.image = req.file.path;
    } else {
        data.image = generatePlaceholderImage(data.exam, data.title); // 👈 naya
    }

    const test = new Listing(data);

    // generate a base slug, then ensure uniqueness
    let baseSlug = slugify(test.title, { lower: true, strict: true });
    let slug = baseSlug;
    let counter = 1;
    while (await Listing.exists({ slug })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
    }
    test.slug = slug;

    try {
        await test.save();
        await notifyNewTestSeries(test);
        res.redirect("/alltests");
    } catch (err) {
        if (err.code === 11000) {
            req.flash?.("error", "A test with this title already exists. Please use a different title.");
            return res.redirect("/test/new"); // or wherever your create form lives
        }
        throw err; // let your global error handler / catchAsync deal with anything else
    }
};

export const renderEditTest = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) throw new ExpressError(404, "Test Not Found");

    const categories = await Category.find({}).select("name _id").sort({ name: 1 }).lean();

    res.render("test/edit.ejs", { listing, categories, robots: "noindex, nofollow" });
};

export const updateTest = async (req, res) => {
    const { id } = req.params;
    const data = req.body.listing;
    data.originalPrice = Number(data.originalPrice) || 0;
    data.discountPercentage = Number(data.discountPercentage) || 0;
    data.price = Math.round(data.originalPrice - (data.originalPrice * data.discountPercentage / 100));
    data.validityDays = Number(data.validityDays) || 365;
    data.rankPredictorData = cleanRankPredictorData(data.rankPredictorData);

    if (req.file) {
        data.image = req.file.path;
    } else {
        const existing = await Listing.findById(id).select("image");
        if (existing?.image?.startsWith("data:image/svg+xml")) {
            data.image = generatePlaceholderImage(data.exam, data.title); // regenerate with updated text
        } else {
            delete data.image; // real image untouched
        }
    }

    const listing = await Listing.findByIdAndUpdate(id, data, { new: true });
if (!listing) throw new ExpressError(404, "Test Not Found");
res.redirect(`/test/${listing.slug}`);
};

export const deleteTest = async (req, res) => {
    const { id } = req.params;

    const listing = await Listing.findById(id);
    if (!listing) throw new ExpressError(404, "Test Not Found");

    const tests = await Test.find({ listing: id }).select("_id");
    const testIds = tests.map(t => t._id);

    await TestQuestion.deleteMany({ test: { $in: testIds } });
    await Attempt.deleteMany({ test: { $in: testIds } });
    await Test.deleteMany({ listing: id });
    await File.deleteMany({ listing: id });
    await Folder.deleteMany({ listing: id });
    await Section.deleteMany({ listing: id });

    await User.updateMany(
        { "enrolledListings.listing": id },
        { $pull: { enrolledListings: { listing: id } } }
    );

    await User.updateMany(
        { lastAccessedBatch: id },
        { $set: { lastAccessedBatch: null } }
    );

    await Listing.findByIdAndDelete(id);

    res.redirect("/alltests");
};

export const getExams = async (req, res) => {
    const exams = await Listing.distinct("exam");
    res.json(exams.filter(Boolean).sort());
};

export const getSeriesByExam = async (req, res) => {
    const { exam } = req.params;
    const isOwner = req.user && req.user.role === "owner";
    const filter = { exam };
    if (!isOwner) filter.visibility = "public";

    const series = await Listing.find(filter).select("title exam slug").sort({ createdAt: -1 });
    res.json(series);
};



// Footer ke liye dynamic data fetch karne ka function
export const getFooterData = async (req, res) => {
    try {
        // Sirf public listings se unique exams nikalna
        const exams = await Listing.distinct("exam", { visibility: "public" });
        
        // Latest test series/listings fetch karna footer ke liye (e.g. limit 20)
        const testSeries = await Listing.find({ visibility: "public" })
            .select("title slug")
            .sort({ createdAt: -1 })
            .limit(20);

        res.json({
            success: true,
            exams: exams.filter(Boolean).sort(),
            testSeries
        });
    } catch (error) {
        console.error("Footer Data Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};