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



export const allTests = async (req, res) => {
    const { exam, search } = req.query;
    let filter = {};

    if (exam) {
        filter.exam = exam;
    } else if (search) {
        filter = {
            $or: [
                { exam: { $regex: search, $options: "i" } },
                { title: { $regex: search, $options: "i" } }
            ]
        };
    }

    const isOwner = req.user && req.user.role === "owner";
    if (!isOwner) {
        filter.visibility = "public";
    }

    const allListings = await Listing.find(filter).lean();

    // ✅ Har listing ke liye total tests count nikalo
    const listingIds = allListings.map(l => l._id);
    const testCounts = await Test.aggregate([
        { $match: { listing: { $in: listingIds } } },
        { $group: { _id: "$listing", count: { $sum: 1 } } }
    ]);
    const testCountMap = {};
    testCounts.forEach(t => { testCountMap[String(t._id)] = t.count; });

    allListings.forEach(l => {
        l.totalTestCount = testCountMap[String(l._id)] || 0;
    });

     
let enrolledIds = [];
let enrolledExpiryMap = {};
if (req.user && req.user.enrolledListings) {
    req.user.enrolledListings.forEach(e => {
        const id = e.listing && e.listing._id ? e.listing._id : e.listing;
        enrolledIds.push(String(id));
        enrolledExpiryMap[String(id)] = e.expiresAt;
    });
}

    res.render("test/alltest", {
        allListings,
        search: search || "",
        selectedExam: exam || "",
        enrolledIds,
        enrolledExpiryMap
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
    const { id } = req.params;
    const data = await Listing.findById(id);
    if (!data) throw new ExpressError(404, "Test Not Found");

    const isOwner = req.user && req.user.role === "owner";

    let enrolledIds = [];
    if (req.user && req.user.enrolledListings) {
        enrolledIds = req.user.enrolledListings.map(e => String(e.listing));
    }

    // ✅ Total tests count nikalo is listing ke
    const totalTestCount = await Test.countDocuments({ listing: data._id });

    res.render("test/show", { listing: data, enrolledIds, isOwner, totalTestCount });
};

export const renderNewTest = (req, res) => res.render("test/new");

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
       if (req.file) {
        data.image = req.file.path;
    }
    const test = new Listing(data);
    test.slug = slugify(test.title, { lower: true, strict: true });
    await test.save();
    res.redirect("/alltests");
};

export const renderEditTest = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) throw new ExpressError(404, "Test Not Found");
    res.render("test/edit.ejs", { listing });
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
        delete data.image;  
    } 

    const listing = await Listing.findByIdAndUpdate(id, data, { new: true });
    if (!listing) throw new ExpressError(404, "Test Not Found");
    res.redirect(`/test/${id}`);
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