import User from "../models/usersShema.js";
import { generateSessionId } from "../utils/sessionHelper.js";
import Listing from "../models/listing.js";
import { Resend } from "resend";  
import Attempt from "../models/TestAttempt.js";
import AttemptSession from "../models/AttemptSession.js";
const resend = new Resend(process.env.RESEND_API_KEY);  
import cloudinary from "../config/cloudinary.js";
import { getPublicIdFromUrl } from "../utils/cloudinaryHelper.js";
import LoginHistory from "../models/LoginHistory.js";
import Notification from "../models/Notification.js";
import CustomTestPricing from "../models/customTestPricing.js";
import ExamPatternSummary from "../models/ExamPatternSummary.js";
import Category from "../models/Category.js";
import PaymentRecord from "../models/PaymentRecord.js";
import razorpayInstance from "../utils/razorpay.js";
import { applyRefund } from "../utils/paymentLedger.js";
import mongoose from "mongoose";
import { calculateRankFromPredictor } from "../utils/rankHelper.js";
import { getUsageSummary } from "../utils/aiUsageTracker.js";
import { cascadeDeleteListing } from "../utils/deleteHelpers.js";
import { deleteExtraUserData } from "../utils/deleteUserData.js";
import CustomPaperAttempt from "../models/CustomPaperAttempt.js";
import AIUsage from "../models/AIUsage.js";
import LiveTestResult from "../models/LiveTestResult.js";
import CustomAIPaper from "../models/CustomAIPaper.js";
import CustomTestPayment from "../models/customTestPayment.js";
import ExamSyllabus from "../models/ExamSyllabus.js";



// ---------------- DASHBOARD STATS ----------------
export const getDashboardStats = async (req, res) => {
    try {
        const totalTestSeries = await Listing.countDocuments();
        const totalUsers = await User.countDocuments();

        const now = new Date();

        // 🔧 FIX: pehle sirf "kabhi bhi 1 enrollment tha" check hota tha (expired/suspended bhi count ho jaate the).
        // Ab sirf REAL active (not suspended, not expired) enrollment wale users count honge.
        const activeUsers = await User.countDocuments({
            enrolledListings: {
                $elemMatch: {
                    suspendedByOwner: { $ne: true },
                    $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }]
                }
            }
        });

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        // Real revenue: permanent payment ledger se (expire/cleanup ka asar nahi, custom test bhi count, refund minus)
        const revenueAgg = await PaymentRecord.aggregate([
            { $match: { paidAt: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: { $subtract: ["$amount", { $ifNull: ["$refundedAmount", 0] }] } } } }
        ]);
        const revenueThisMonth = revenueAgg[0]?.total || 0;

        res.json({
            success: true,
            stats: {
                totalTestSeries,
                totalUsers,
                activeUsers,
                revenueThisMonth,
                attemptsToday: null // Attempt model nahi hai abhi, isliye null (frontend "N/A" dikhayega)
            }
        });
    } catch (err) {
        console.error("Dashboard stats error:", err);
        res.status(500).json({ success: false, message: "Failed to load stats." });
    }
};

// ---------------- CHART DATA ----------------
export const getChartData = async (req, res) => {
    try {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);
        sixMonthsAgo.setHours(0, 0, 0, 0);

        // 1) User Growth — real signup data
        const userGrowthRaw = await User.aggregate([
            { $match: { createdAt: { $gte: sixMonthsAgo } } },
            {
                $group: {
                    _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ]);

        // 2) Revenue Trend — real amountPaid data, month-wise
        const revenueRaw = await PaymentRecord.aggregate([
            { $match: { paidAt: { $gte: sixMonthsAgo } } },
            {
                $group: {
                    _id: { year: { $year: "$paidAt" }, month: { $month: "$paidAt" } },
                    total: { $sum: { $subtract: ["$amount", { $ifNull: ["$refundedAmount", 0] }] } }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ]);

        // 3) Enrollments by Test Series — real count per listing
        const enrollmentAgg = await User.aggregate([
            { $unwind: "$enrolledListings" },
            { $group: { _id: "$enrolledListings.listing", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        const listingIds = enrollmentAgg.map(e => e._id);
        const listings = await Listing.find({ _id: { $in: listingIds } }).select("title");

        const enrollmentChart = enrollmentAgg.map(e => {
            const listing = listings.find(l => String(l._id) === String(e._id));
            return { title: listing?.title || "Unknown", count: e.count };
        });

        // Helper: month numbers ko merge karo taaki dono charts (userGrowth aur revenue) same labels use karein
        const monthKey = (y, m) => `${m}/${y}`;

        res.json({
            success: true,
            userGrowth: userGrowthRaw.map(u => ({
                month: monthKey(u._id.year, u._id.month),
                count: u.count
            })),
            revenueTrend: revenueRaw.map(r => ({
                month: monthKey(r._id.year, r._id.month),
                total: r.total
            })),
            enrollmentChart
        });
    } catch (err) {
        console.error("Chart data error:", err);
        res.status(500).json({ success: false, message: "Failed to load chart data." });
    }
};

 
// ---------------- ALL TEST SERIES (public + private) ----------------
export const getAllTestSeriesOwner = async (req, res) => {
    try {
        const listings = await Listing.find({}).sort({ createdAt: -1 });
        const now = new Date();

        // 👇 NAYA: har listing ke liye ACTIVE enrolled count (not suspended, not expired)
        const enrolledAgg = await User.aggregate([
            { $unwind: "$enrolledListings" },
            {
                $match: {
                    "enrolledListings.suspendedByOwner": { $ne: true },
                    $or: [
                        { "enrolledListings.expiresAt": { $exists: false } },
                        { "enrolledListings.expiresAt": null },
                        { "enrolledListings.expiresAt": { $gt: now } }
                    ]
                }
            },
            { $group: { _id: "$enrolledListings.listing", count: { $sum: 1 } } }
        ]);

        // 👇 NAYA: har listing ke liye TOTAL purchased count (amountPaid > 0, all-time — expired bhi count)
        const purchasedAgg = await PaymentRecord.aggregate([
            { $match: { kind: "testseries", status: { $ne: "refunded" } } },
            { $group: { _id: "$itemId", count: { $sum: 1 } } }
        ]);

        const enrolledMap = new Map(enrolledAgg.map(e => [String(e._id), e.count]));
        const purchasedMap = new Map(purchasedAgg.map(p => [String(p._id), p.count]));

                // 👇 NAYA: kin exams ka syllabus (Add Content) add ho chuka hai
        const syllabusDocs = await ExamSyllabus.find({}).select("category exam").lean();
        const syllabusSet = new Set(syllabusDocs.map(s => `${s.category}|${String(s.exam).trim()}`));

        res.json({
            success: true,
            listings: listings.map(l => ({
                _id: l._id,
                title: l.title,
                slug: l.slug,
                exam: l.exam || "", 
                category: l.category || "",             
                price: l.price,
                type: l.type,
                visibility: l.visibility,
                image: l.image,
                validityDays: l.validityDays,
                createdAt: l.createdAt,
                enrolledCount: enrolledMap.get(String(l._id)) || 0,    
                purchasedCount: purchasedMap.get(String(l._id)) || 0, 
                hasSyllabus: syllabusSet.has(`${l.category}|${String(l.exam || "").trim()}`)   
            }))
        });
    } catch (err) {
        console.error("Get all test series error:", err);
        res.status(500).json({ success: false, message: "Failed to load test series." });
    }
};

// ---------------- DELETE TEST SERIES ----------------
export const deleteTestSeries = async (req, res) => {
    try {
        const { id } = req.params;
                 const listing = await Listing.findById(id);
        if (!listing) {
            return res.status(404).json({ success: false, message: "Test series not found." });
        }
        await cascadeDeleteListing(id);
        await Listing.findByIdAndDelete(id);
        res.json({ success: true, message: "Test series deleted successfully." });
    } catch (err) {
        console.error("Delete test series error:", err);
        res.status(500).json({ success: false, message: "Failed to delete." });
    }
};

 
// ---------------- ALL USERS (with search) ----------------
export const getAllUsersOwner = async (req, res) => {
    try {
        const { search } = req.query;

        let filter = {};
        if (search && search.trim() !== "") {
            const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
            filter = {
                $or: [
                    { name: regex },
                    { username: regex },
                    { email: regex }
                ]
            };
        }

        const users = await User.find(filter).sort({ createdAt: -1 });
        const totalMatching = users.length;
        const totalUsers = await User.countDocuments();

        const now = new Date();

        res.json({
            success: true,
            total: search ? totalMatching : totalUsers,
            users: users.map(u => {
                const hasActiveSub = u.enrolledListings.some(e =>
    !e.suspendedByOwner && (!e.expiresAt || e.expiresAt > now)
);

let status;
if (u.enrolledListings.length === 0) {
    status = "No Subscription";          // 👈 NAYA case
} else if (hasActiveSub) {
    status = "Active";
} else {
    const hasSuspended = u.enrolledListings.some(e => e.suspendedByOwner);
    const hasExpired = u.enrolledListings.some(e => e.expiresAt && e.expiresAt <= now && !e.suspendedByOwner);
    status = hasSuspended ? "Suspended" : (hasExpired ? "Expired" : "Active");
}

                // 👇 NAYA: plan (koi paid enrollment kabhi bhi hua ho to Premium)
                const plan = u.enrolledListings.some(e => e.amountPaid > 0) ? "Premium" : "Free";

                 
                 
                              const ctActive = u.customTestTier && u.customTestTier !== "free" &&
                    (!u.customTestExpiresAt || u.customTestExpiresAt > now);
                const customTestTier = ctActive ? u.customTestTier : "free";
                const customTestLabel = customTestTier === "promax" ? "Pro Max" : (customTestTier === "pro" ? "Pro" : "Free");

                return {
                    _id: u._id,
                    name: u.name,
                    username: u.username,
                    email: u.email,
                    avatar: u.avatar || null,
                    hasActiveSub,
                    plan,
                    enrolledCount: u.enrolledListings.length,
                    status,
                    joinedOn: u.createdAt,
                    customTestTier,
                    customTestLabel,
                    customTestExpiresAt: ctActive ? u.customTestExpiresAt : null
                };
                
            })
        });
    } catch (err) {
        console.error("Get all users error:", err);
        res.status(500).json({ success: false, message: "Users load nahi ho paye" });
    }
};

// ---------------- TOGGLE USER SUBSCRIPTION (Real, dynamic) ----------------
export const toggleUserSubscription = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ success: false, message: "User not found." });

        const now = new Date();
        const hasActiveSub = user.enrolledListings.some(e =>
            !e.suspendedByOwner && (!e.expiresAt || e.expiresAt > now)
        );

        if (hasActiveSub) {
            user.enrolledListings.forEach(e => {
                if (!e.suspendedByOwner && (!e.expiresAt || e.expiresAt > now)) {
                    e.suspendedByOwner = true;
                }
            });
        } else {
            const restored = user.enrolledListings.some(e =>
                e.suspendedByOwner && (!e.expiresAt || e.expiresAt > now)
            );

            user.enrolledListings.forEach(e => {
                if (e.suspendedByOwner && (!e.expiresAt || e.expiresAt > now)) {
                    e.suspendedByOwner = false;
                }
            });

            if (!restored) {
                return res.json({
                    success: false,
                    message: "This user has no valid (non-expired) subscription to restore. Grant a new subscription from the user detail page."
                });
            }
        }

        await user.save();

        const newStatus = user.enrolledListings.some(e =>
            !e.suspendedByOwner && (!e.expiresAt || e.expiresAt > now)
        );

        res.json({ success: true, hasActiveSub: newStatus });
    } catch (err) {
        console.error("Toggle subscription error:", err);
        res.status(500).json({ success: false, message: "Failed to update." });
    }
};

// ---------------- DELETE USER ----------------
export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        // ---------- Avatar cloudinary se hatao ----------
        const publicId = getPublicIdFromUrl(user.avatar);
        if (publicId) {
            await cloudinary.uploader.destroy(publicId).catch(() => {});
        }

        // ---------- Attempts + User delete ----------
        await Attempt.deleteMany({ user: id });
        await AttemptSession.deleteMany({ user: id });
        await CustomPaperAttempt.deleteMany({ user: id });
        await AIUsage.deleteMany({ user: id });
        await LiveTestResult.deleteMany({ user: id });
        await CustomAIPaper.deleteMany({ user: id });
        await CustomTestPayment.deleteMany({ user: id });
                await deleteExtraUserData(id);
        await User.findByIdAndDelete(id);

        res.json({ success: true, message: "User deleted successfully." });
    } catch (err) {
        console.error("Delete user error:", err);
        res.status(500).json({ success: false, message: "Failed to delete." });
    }
};
// ---------------- USER DETAIL PAGE ----------------
export const renderUserDetailPage = async (req, res) => {
    try {
        const { id } = req.params;
        const targetUser = await User.findById(id).populate("enrolledListings.listing");

        if (!targetUser) {
            req.flash("error", "User not found.");
            return res.redirect("/owner-dashboard");
        }

        const now = new Date();

        const activeSubs = targetUser.enrolledListings
            .filter(e => !e.suspendedByOwner && (!e.expiresAt || e.expiresAt > now))
            .sort((a, b) => b.enrolledAt - a.enrolledAt);

        const currentSub = activeSubs[0] || null;

        let subscriptionInfo = {
            subscriptionPlan: currentSub?.listing?.title || "No Active Plan",
            subscriptionStatus: currentSub ? "Active" : "Inactive",
            validTill: currentSub?.expiresAt ? currentSub.expiresAt.toDateString() : "-",
            daysRemaining: currentSub?.expiresAt
                ? Math.max(0, Math.ceil((currentSub.expiresAt - now) / (1000 * 60 * 60 * 24)))
                : 0,
            purchasedVia: currentSub ? (currentSub.amountPaid > 0 ? "Payment Gateway" : "Free Grant") : "-",
            amountPaid: currentSub?.amountPaid || 0,
            couponUsed: "-",
            transactionId: currentSub?.paymentId || currentSub?.orderId || "-"
        };

        const grantedSubscriptions = targetUser.enrolledListings.map(e => {
            const expired = e.expiresAt ? e.expiresAt <= now : false;
            const durationDays = e.expiresAt
                ? Math.ceil((e.expiresAt - e.enrolledAt) / (1000 * 60 * 60 * 24))
                : null;
            return {
                title: e.listing?.title || "Deleted Listing",
                duration: durationDays || "Lifetime",
                expired,
                endDate: e.expiresAt ? e.expiresAt.toDateString() : "No Expiry"
            };
        });

// ---------- PAYMENT HISTORY (permanent ledger: sirf asli payments) ----------
        const paymentDocs = await PaymentRecord.find({ user: targetUser._id })
            .sort({ paidAt: -1 })
            .lean();

        const planName = (pl) => (pl === "promax" ? "Pro Max" : "Pro");
        const paymentHistory = paymentDocs.map(p => {
            const isCT = p.kind === "customtest";
            const validity = isCT && p.months
                ? `${p.months} month${p.months > 1 ? "s" : ""}`
                : (p.validityDays ? `${p.validityDays} days` : "-");
            return {
                id: String(p._id),
                invoiceNo: p.invoiceNo || ("WE" + String(p.orderId).replace(/\W/g, "").slice(-8).toUpperCase()),
                kind: p.kind,
                kindLabel: isCT ? "Custom Test" : (p.kind === "ebook" ? "E-Book" : "Test Series"),
                itemTitle: p.itemTitle,
                subtitle: isCT
                    ? `Custom Test • ${planName(p.plan)} • ${validity}`
                    : `${p.kind === "ebook" ? "E-Book" : "Test Series"} • ${validity}`,
                validity,
                amount: p.amount || 0,
                baseAmount: p.baseAmount,
                couponCode: p.couponCode || "",
                couponDiscount: p.couponDiscount || 0,
                donation: p.donation || 0,
                status: p.status || "success",
                refundedAmount: p.refundedAmount || 0,
                refundedAt: p.refundedAt ? new Date(p.refundedAt).getTime() : null,
                methodType: p.methodType || "",
                methodDetail: p.methodDetail || "",
                orderId: p.orderId,
                paymentId: p.paymentId || "",
                canRefund: !!p.paymentId && p.source === "razorpay" && (p.status || "success") !== "refunded",
                ts: new Date(p.paidAt).getTime(),
                expiresTs: p.expiresAt ? new Date(p.expiresAt).getTime() : null
            };
        });
        const paymentsJson = JSON.stringify(paymentHistory).replace(/</g, "\\u003c");

        // Current subscription me asli coupon dikhao (pehle hamesha "-" tha)
        if (currentSub?.orderId) {
            const rec = paymentDocs.find(p => p.orderId === currentSub.orderId);
            if (rec?.couponCode) subscriptionInfo.couponUsed = rec.couponCode;
        }

        // ---------- CUSTOM TEST INFO ----------
        const ctTier = targetUser.customTestTier || "free";
        const ctExpiresAt = targetUser.customTestExpiresAt;
        const ctActive = ctTier !== "free" && (!ctExpiresAt || ctExpiresAt > now);
        const ctExpired = ctTier !== "free" && !!ctExpiresAt && ctExpiresAt <= now;

        const customTestInfo = {
            tier: ctActive ? ctTier : "free",
            tierLabel: !ctActive ? "Free" : (ctTier === "promax" ? "Pro Max" : "Pro"),
            active: ctActive,
            expired: ctExpired,
            expiresOn: ctExpiresAt ? ctExpiresAt.toDateString() : "-",
            daysRemaining: ctActive && ctExpiresAt
                ? Math.max(0, Math.ceil((ctExpiresAt - now) / (1000 * 60 * 60 * 24)))
                : 0
        };

        const pricingDoc = await CustomTestPricing.findOne({ key: "default" }).lean();
        const customTestPricing = {
            pro: (pricingDoc?.pro || []).sort((a, b) => a.months - b.months),
            promax: (pricingDoc?.promax || []).sort((a, b) => a.months - b.months)
        };
        const customTestPricingJson = JSON.stringify(customTestPricing).replace(/</g, "\\u003c");

        // ---------- TEST SERIES PERFORMANCE STATS (sirf test series ke normal tests) ----------
const rawAttempts = await Attempt.find({ user: targetUser._id })
    .populate("test", "title listing isLiveTest isDailyWarmup")
    .lean();

// Live test, daily warmup aur deleted test ke attempts hata do
const seriesAttempts = rawAttempts.filter(a =>
    a.test && !a.test.isLiveTest && !a.test.isDailyWarmup && a.test.listing
);

const statListingIds = [...new Set(seriesAttempts.map(a => String(a.test.listing)))];
const statListings = await Listing.find({ _id: { $in: statListingIds } })
    .select("rankPredictorData").lean();
const predictorByListing = {};
statListings.forEach(l => { predictorByListing[String(l._id)] = l.rankPredictorData || []; });

let performanceStats = {
    testsAttempted: 0,
    overallAccuracy: "—",
    averageScore: "—",
    highestScore: "—",
    highestScoreTest: "Highest Score",
    bestRank: "—",
    bestRankTest: "Best Rank",
    worstRank: "—",
    worstRankTest: "Worst Rank"
};

if (seriesAttempts.length > 0) {
    const totalCorrect = seriesAttempts.reduce((s, a) => s + (a.correctCount || 0), 0);
    const totalWrong = seriesAttempts.reduce((s, a) => s + (a.wrongCount || 0), 0);
    const attemptedQs = totalCorrect + totalWrong;

    const avg = seriesAttempts.reduce((s, a) => s + (a.score || 0), 0) / seriesAttempts.length;

    let top = seriesAttempts[0];
    let best = null, worst = null;

    seriesAttempts.forEach(a => {
        if ((a.score || 0) > (top.score || 0)) top = a;

        const predictor = predictorByListing[String(a.test.listing)] || [];
        const { rank } = calculateRankFromPredictor(a.score || 0, predictor);
        if (typeof rank !== "number") return;   // predictor data nahi to skip

        if (!best || rank < best.rank) best = { rank, title: a.test.title };
        if (!worst || rank > worst.rank) worst = { rank, title: a.test.title };
    });

    performanceStats = {
        testsAttempted: seriesAttempts.length,
        overallAccuracy: attemptedQs > 0 ? Math.round((totalCorrect / attemptedQs) * 100) : 0,
        averageScore: Math.round(avg * 10) / 10,
        highestScore: top.score || 0,
        highestScoreTest: top.test.title,
        bestRank: best ? best.rank : "—",
        bestRankTest: best ? best.title : "Best Rank",
        worstRank: worst ? worst.rank : "—",
        worstRankTest: worst ? worst.title : "Worst Rank"
    };
}

        const userDetail = {
            _id: targetUser._id,
            name: targetUser.name,
            email: targetUser.email,
                        mobile: targetUser.mobile || "-",
            state: targetUser.state || "-",
            city: targetUser.city || "-",
            pinCode: targetUser.pinCode || "-",
            avatar: targetUser.avatar,
            status: targetUser.banned ? "Banned" : "Active",
            banInfo: {
                banned: targetUser.banned,
                banReason: targetUser.banReason,
                banType: targetUser.banType,
                bannedAt: targetUser.bannedAt ? targetUser.bannedAt.toDateString() : null,
                banExpiresAt: targetUser.banExpiresAt ? targetUser.banExpiresAt.toDateString() : null
            },
            registrationDate: targetUser.createdAt.toDateString(),
            lastLogin: targetUser.updatedAt.toDateString(),
            emailVerified: targetUser.isVerified,
            mobileVerified: !!targetUser.mobile,
            permissions: targetUser.permissions || [],



            ...subscriptionInfo,
            grantedSubscriptions,
            paymentHistory,

            ...performanceStats,
            currentRank: "—",
            leaderboardPosition: "—",
            percentile: "—",
            currentStreak: "—",
            totalStudyTime: "—",
            streakUpNote: "",
            activityLog: []
        };

        const availableListings = await Listing.find({});

        res.render("owner/userdetail", {
            userDetail, availableListings, user: req.user,
            customTestInfo, customTestPricing, customTestPricingJson,
            paymentsJson
        });
    } catch (err) {
        console.error("User detail page error:", err);
        req.flash("error", "Something went wrong. Please try again.");
        res.redirect("/owner-dashboard");
    }
};

// ---------------- GRANT SUBSCRIPTION (single ya ALL test series) ----------------
export const grantSubscription = async (req, res) => {
    try {
        const { id } = req.params;
        const { listingId, duration, startDate } = req.body;

        // 🔧 FIX: listingId required validation missing thi
        if (!listingId) {
            return res.status(400).json({ success: false, message: "Please select a test series." });
        }

        const targetUser = await User.findById(id);
        if (!targetUser) return res.status(404).json({ success: false, message: "User not found." });

        const start = startDate ? new Date(startDate) : new Date();
                const days = Math.max(1, Number(duration) || 30);
        const expiresAt = new Date(start);
        expiresAt.setDate(expiresAt.getDate() + days);

        let listingsToGrant = [];

        if (listingId === "ALL") {
            listingsToGrant = await Listing.find({});
        } else {
            const singleListing = await Listing.findById(listingId);
            if (!singleListing) return res.status(404).json({ success: false, message: "Test series not found." });
            listingsToGrant = [singleListing];
        }

        listingsToGrant.forEach(listing => {
            const existing = targetUser.enrolledListings.find(
                e => String(e.listing) === String(listing._id)
            );

                       if (existing) {
                existing.suspendedByOwner = false;
                // sirf badhao, kabhi chhota mat karo (unlimited ya lamba expiry safe rahe)
                if (existing.expiresAt && existing.expiresAt < expiresAt) existing.expiresAt = expiresAt;
                if (!existing.amountPaid) existing.enrolledAt = start;
            } else {
                targetUser.enrolledListings.push({
                    listing: listing._id,
                    enrolledAt: start,
                    expiresAt,
                    amountPaid: 0,
                    paymentId: null,
                    orderId: null,
                    suspendedByOwner: false
                });
            }
        });

        await targetUser.save();

        res.json({
            success: true,
            message: listingId === "ALL"
                ? `All ${listingsToGrant.length} test series were granted for free.`
                : "Subscription granted successfully."
        });
    } catch (err) {
        console.error("Grant subscription error:", err);
        res.status(500).json({ success: false, message: "Failed to grant access." });
    }
};

// ---------------- SAVE ACCESS PERMISSIONS ----------------
export const saveUserPermissions = async (req, res) => {
    try {
        const { id } = req.params;
        const { permissions } = req.body;

        const updated = await User.findByIdAndUpdate(id, { permissions: permissions || [] }, { new: true });
        if (!updated) return res.status(404).json({ success: false, message: "User not found." }); // 🔧 FIX

        res.json({ success: true, message: "Permissions saved successfully." });
    } catch (err) {
        console.error("Save permissions error:", err);
        res.status(500).json({ success: false, message: "Failed to save." });
    }
};

// ---------------- BAN / UNBAN USER ----------------
export const banUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { banReason, banType, durationDays, customExpiryDate } = req.body;

        if (!banReason) {
            return res.status(400).json({ success: false, message: "Please select a reason." });
        }
        if (!["permanent", "temporary"].includes(banType)) {
            return res.status(400).json({ success: false, message: "Please select a ban type." });
        }

        const targetUser = await User.findById(id);
        if (!targetUser) return res.status(404).json({ success: false, message: "User not found." });
        if (targetUser.role === "owner") {
            return res.status(400).json({ success: false, message: "The owner account cannot be banned." });
        }

        let banExpiresAt = null;
        if (banType === "temporary") {
            if (customExpiryDate) {
                banExpiresAt = new Date(customExpiryDate);
            } else {
                banExpiresAt = new Date();
                banExpiresAt.setDate(banExpiresAt.getDate() + (Number(durationDays) || 7));
            }
        }

        targetUser.banned = true;
        targetUser.banReason = banReason;
        targetUser.banType = banType;
        targetUser.bannedAt = new Date();
        targetUser.banExpiresAt = banExpiresAt;
        await targetUser.save();

        res.json({ success: true, message: "User banned successfully." });
    } catch (err) {
        console.error("Ban user error:", err);
        res.status(500).json({ success: false, message: "Failed to ban user." });
    }
};

export const unbanUser = async (req, res) => {
    try {
        const { id } = req.params;
        const targetUser = await User.findById(id);
        if (!targetUser) return res.status(404).json({ success: false, message: "User not found." });

        targetUser.banned = false;
        targetUser.banReason = null;
        targetUser.banType = null;
        targetUser.bannedAt = null;
        targetUser.banExpiresAt = null;
        await targetUser.save();

        res.json({ success: true, message: "User unbanned successfully." });
    } catch (err) {
        console.error("Unban user error:", err);
        res.status(500).json({ success: false, message: "Failed to unban user." });
    }
};

// ---------------- RESET PASSWORD (Owner triggers, email jaata hai) ----------------
export const ownerResetUserPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const targetUser = await User.findById(id);
        if (!targetUser) return res.status(404).json({ success: false, message: "User not found." });

        const tempPassword = Math.random().toString(36).slice(-8);
        targetUser.password = tempPassword; // pre('save') hook hash kar dega
        targetUser.activeSessionId = generateSessionId(); // user ke purane sessions logout
        await targetUser.save();

        await resend.emails.send({
            from: `WarmupExam <${process.env.CONTACT_SENDER_EMAIL}>`,
            to: targetUser.email,
            subject: "Your Password Has Been Reset",
            html: `<p>Your password has been reset by the administrator. Your new temporary password is: <b>${tempPassword}</b></p>
                   <p>Please change it immediately after logging in.</p>`
        });

        res.json({ success: true, message: "A new password has been emailed to the user." });
    } catch (err) {
        console.error("Owner reset password error:", err);
        res.status(500).json({ success: false, message: "Failed to reset password." });
    }
};

// ---------------- PAYMENTS (permanent ledger: sab users ke asli payments) ----------------
export const getAllPaymentsOwner = async (req, res) => {
    try {
        const [docs, totals] = await Promise.all([
            PaymentRecord.find().sort({ paidAt: -1 }).limit(200).lean(),   // recent 200, pagination baad me
            PaymentRecord.aggregate([{
                $group: {
                    _id: null,
                    total: { $sum: { $subtract: ["$amount", { $ifNull: ["$refundedAmount", 0] }] } },
                    count: { $sum: 1 }
                }
            }])
        ]);

        const payments = docs.map(p => ({
            _id: p._id,
            userId: p.user,
            userName: p.userName,
            userEmail: p.userEmail,
            kind: p.kind,
            listingTitle: p.itemTitle,
            amount: p.amount,
            status: p.status || "success",
            refundedAmount: p.refundedAmount || 0,
            couponCode: p.couponCode || "",
            date: p.paidAt,
            invoiceId: p.invoiceNo || p.orderId
        }));

        res.json({
            success: true,
            payments,
            totalRevenue: totals[0]?.total || 0,     // sab payments ka net total (refund minus)
            count: payments.length,
            totalCount: totals[0]?.count || 0
        });
    } catch (err) {
        console.error("Get payments error:", err);
        res.status(500).json({ success: false, message: "Failed to load payments." });
    }
};

// ---------------- DELETE PAYMENT RECORD (sirf owner, manually, permanent) ----------------
export const deletePaymentRecord = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid payment id." });
        }
         
                 const rec = await PaymentRecord.findById(id);
        if (!rec) return res.status(404).json({ success: false, message: "Payment record not found." });
        if (rec.status !== "refunded") {
            return res.status(400).json({ success: false, message: "Only fully refunded payment records can be deleted." });
        }
        await rec.deleteOne();
                res.json({ success: true, message: "Payment record deleted permanently." });
    } catch (err) {
        console.error("Delete payment record error:", err);
        res.status(500).json({ success: false, message: "Failed to delete payment record." });
    }
};

// ---------------- REFUND (owner, Razorpay API se; access bhi hatega: expire jaisa) ----------------
export const refundPayment = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid payment id." });
        }

        const rec = await PaymentRecord.findById(id);
        if (!rec) return res.status(404).json({ success: false, message: "Payment record not found." });
        if (!rec.paymentId || rec.source !== "razorpay") {
            return res.status(400).json({ success: false, message: "This payment cannot be refunded from here." });
        }

        const remaining = rec.amount - (rec.refundedAmount || 0);
        if (remaining <= 0) {
            return res.status(400).json({ success: false, message: "This payment is already fully refunded." });
        }

        // Full (bacha hua) amount refund. Partial refund Razorpay Dashboard se karo, webhook record update kar dega.
        const refund = await razorpayInstance.payments.refund(rec.paymentId, {
            amount: Math.round(remaining * 100),
            speed: "normal",
            notes: { invoiceNo: rec.invoiceNo || "", initiatedBy: "owner_panel" }
        });

        // Webhook ka intezaar nahi: abhi apply karo (applyRefund idempotent hai, webhook baad me aaye to duplicate nahi banega)
        await applyRefund({ paymentId: rec.paymentId, refund: { id: refund.id, amount: refund.amount, status: refund.status } });

                res.json({ success: true, message: `₹${remaining} refund initiated. The user's access will be removed once the refund is processed.` });
    } catch (err) {
        console.error("Refund error:", err);
        const msg = err?.error?.description || err?.message || "Refund failed.";
        res.status(err?.statusCode >= 400 && err?.statusCode < 500 ? 400 : 500).json({ success: false, message: msg });
    }
};


export const getLoginHistory = async (req, res) => {
    try {
        const history = await LoginHistory.find({ ownerEmail: req.user.email })
            .sort({ createdAt: -1 })
            .limit(200)
            .lean();

        res.json({ success: true, history });
    } catch (err) {
        console.error("Get login history error:", err);
        res.status(500).json({ success: false, message: "Failed to load login history." });
    }
};

export const deleteLoginHistory = async (req, res) => {
    try {
        const { id } = req.params;

        const deleted = await LoginHistory.findOneAndDelete({
            _id: id,
            ownerEmail: req.user.email  // security: sirf apni khud ki entry delete kar paye
        });

        if (!deleted) {
            return res.status(404).json({ success: false, message: "Entry not found." });
        }

        res.json({ success: true, message: "Entry deleted successfully." });
    } catch (err) {
        console.error("Delete login history error:", err);
        res.status(500).json({ success: false, message: "Failed to delete." });
    }
};

export const deleteAllLoginHistory = async (req, res) => {
    try {
        await LoginHistory.deleteMany({ ownerEmail: req.user.email });
        res.json({ success: true, message: "Login history cleared successfully." });
    } catch (err) {
        console.error("Delete all login history error:", err);
        res.status(500).json({ success: false, message: "Failed to delete." });
    }
};

// ---------------- GET ALL NOTIFICATIONS (list view ke liye) ----------------
export const getAllNotificationsOwner = async (req, res) => {
    try {
        const now = new Date();

        // jo "sent" hain aur expire ho chuki hain unhe "expired" mark kar do (lazy update)
        await Notification.updateMany(
            { status: "sent", expiresAt: { $lte: now } },
            { $set: { status: "expired" } }
        );

        const notifications = await Notification.find().sort({ createdAt: -1 }).limit(100).lean();

        res.json({ success: true, notifications });
    } catch (err) {
        console.error("Get notifications error:", err);
        res.status(500).json({ success: false, message: "Failed to load notifications." });
    }
};

// datetime-local jaisi string (bina timezone) ko IST maano; ISO (Z / +05:30) ko jaisa hai waisa
const parseScheduledAt = (value) => {
    if (!value) return null;
    const str = String(value).trim();
    const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(str);
    const d = new Date(hasZone ? str : `${str}+05:30`);
    return isNaN(d.getTime()) ? null : d;
};

const cleanCustomIds = (ids) => (Array.isArray(ids) ? ids : []).filter(id => mongoose.isValidObjectId(id));

// ---------------- ESTIMATED REACH (audience select karte hi call hota hai) ----------------
// Student side (getAudienceFilter) ke saath same rule: active paid = amountPaid > 0, suspend nahi, expire nahi
export const getNotificationReach = async (req, res) => {
    try {
        const { audienceType, customUserIds } = req.query;
        const now = new Date();

        const notBanned = { banned: { $ne: true } };
        const activePaid = {
            enrolledListings: {
                $elemMatch: {
                    amountPaid: { $gt: 0 },
                    suspendedByOwner: { $ne: true },
                    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }]
                }
            }
        };

        let count = 0;
        if (audienceType === "all") {
            count = await User.countDocuments(notBanned);
        } else if (audienceType === "paid") {
            count = await User.countDocuments({ ...notBanned, ...activePaid });
        } else if (audienceType === "free") {
            count = await User.countDocuments({ ...notBanned, $nor: [activePaid] });
        } else if (audienceType === "custom") {
            const ids = customUserIds ? String(customUserIds).split(",").filter(Boolean) : [];
            count = cleanCustomIds(ids).length;
        }

        res.json({ success: true, count });
    } catch (err) {
        console.error("Get reach error:", err);
        res.status(500).json({ success: false, message: "Failed to calculate reach." });
    }
};

 
// ---------------- SEARCH USERS (custom audience picker + edit prefill ke liye) ----------------
export const searchUsersForNotification = async (req, res) => {
    try {
        const { search, ids } = req.query;
        let filter = {};

        if (ids) {
            const idList = ids.split(",").filter(Boolean);
            filter = { _id: { $in: idList } };
        } else if (search && search.trim() !== "") {
            const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
            filter = { $or: [{ name: regex }, { username: regex }, { email: regex }] };
        }

        const users = await User.find(filter).select("name username email").limit(ids ? 100 : 20).lean();
        res.json({ success: true, users });
    } catch (err) {
        console.error("Search users error:", err);
        res.status(500).json({ success: false, message: "Failed to search users." });
    }
};

 
// ---------------- CREATE + SEND NOTIFICATION ----------------
export const createNotification = async (req, res) => {
    try {
        const { title, message, audienceType, customUserIds, scheduleType, scheduledAt } = req.body;

        if (!title || !message || !audienceType) {
            return res.status(400).json({ success: false, message: "Title, message, and audience are required." });
        }
        if (String(title).length > 60) {
            return res.status(400).json({ success: false, message: "Title can be at most 60 characters." });
        }
        if (String(message).length > 500) {
            return res.status(400).json({ success: false, message: "Message can be at most 500 characters." });
        }
        if (!["all", "paid", "free", "custom"].includes(audienceType)) {
            return res.status(400).json({ success: false, message: "Invalid audience." });
        }

        const ids = audienceType === "custom" ? cleanCustomIds(customUserIds) : [];
        if (audienceType === "custom" && ids.length === 0) {
            return res.status(400).json({ success: false, message: "Select at least one valid student." });
        }

        const doc = new Notification({
            title,
            message,
            audienceType,
            customUserIds: ids,
            createdBy: req.user._id
        });

        if (scheduleType === "later") {
            const when = parseScheduledAt(scheduledAt);
            if (!when) {
                return res.status(400).json({ success: false, message: "Select a valid schedule date and time." });
            }
            doc.scheduledAt = when;
            doc.status = "scheduled";
        } else {
            doc.sentAt = new Date();
            doc.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24hr expiry yahi set hoti hai
            doc.status = "sent";
        }

        await doc.save();
        res.json({ success: true, notification: doc, message: "Notification sent successfully." });
    } catch (err) {
        if (err.name === "ValidationError" || err.name === "CastError") {
            return res.status(400).json({ success: false, message: "Invalid notification data. Please check and try again." });
        }
        console.error("Create notification error:", err);
        res.status(500).json({ success: false, message: "Notification bhej nahi payi" });
    }
};


export const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) return res.status(404).json({ success: false, message: "Notification not found." });
        const deleted = await Notification.findByIdAndDelete(id);   // 👈 hamesha poora delete — already sahi hai
        if (!deleted) return res.status(404).json({ success: false, message: "Notification not found." });
        res.json({ success: true, message: "Notification deleted successfully." });
    } catch (err) {
        console.error("Delete notification error:", err);
        res.status(500).json({ success: false, message: "Failed to delete." });
    }
};

export const updateNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, message, audienceType, customUserIds, scheduleType, scheduledAt } = req.body;

        if (!mongoose.isValidObjectId(id)) return res.status(404).json({ success: false, message: "Notification not found." });
        const notif = await Notification.findById(id);
        if (!notif) return res.status(404).json({ success: false, message: "Notification not found." });

        // Sirf "scheduled" edit ho sakti hai (sent ya expired ko dobara zinda nahi kar sakte)
        if (notif.status !== "scheduled") {
            return res.status(400).json({ success: false, message: "A notification that has already been sent cannot be edited. You can only delete it." });
        }

        if (!title || !message || !audienceType) {
            return res.status(400).json({ success: false, message: "Title, message, and audience are required." });
        }
        if (String(title).length > 60) {
            return res.status(400).json({ success: false, message: "Title can be at most 60 characters." });
        }
        if (String(message).length > 500) {
            return res.status(400).json({ success: false, message: "Message can be at most 500 characters." });
        }
        if (!["all", "paid", "free", "custom"].includes(audienceType)) {
            return res.status(400).json({ success: false, message: "Invalid audience." });
        }

        const ids = audienceType === "custom" ? cleanCustomIds(customUserIds) : [];
        if (audienceType === "custom" && ids.length === 0) {
            return res.status(400).json({ success: false, message: "Select at least one valid student." });
        }

        notif.title = title;
        notif.message = message;
        notif.audienceType = audienceType;
        notif.customUserIds = ids;

        if (scheduleType === "later") {
            const when = parseScheduledAt(scheduledAt);
            if (!when) {
                return res.status(400).json({ success: false, message: "Select a valid schedule date and time." });
            }
            notif.scheduledAt = when;
            notif.status = "scheduled";
        } else {
            notif.sentAt = new Date();
            notif.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
            notif.status = "sent";
        }

        await notif.save();
        res.json({ success: true, notification: notif, message: "Notification updated successfully." });
    } catch (err) {
        if (err.name === "ValidationError" || err.name === "CastError") {
            return res.status(400).json({ success: false, message: "Invalid notification data. Please check and try again." });
        }
        console.error("Update notification error:", err);
        res.status(500).json({ success: false, message: "Failed to update." });
    }
};
 
 

// ---------------- CUSTOM TEST PRICING (owner-editable Pro/Pro+ pricing) ----------------
export const getCustomTestPricingOwner = async (req, res) => {
    try {
        let doc = await CustomTestPricing.findOne({ key: "default" });
        if (!doc) {
            // Pehli baar hai to defaults bana do (image 2 wale numbers)
            doc = await CustomTestPricing.create({
                key: "default",
                pro: [
                    { months: 1, originalPrice: 199, price: 199 },
                    { months: 3, originalPrice: 597, price: 499 },
                    { months: 6, originalPrice: 1194, price: 899 },
                    { months: 12, originalPrice: 2388, price: 1499 },
                ],
                promax: [
                    { months: 1, originalPrice: 499, price: 499 },
                    { months: 3, originalPrice: 1497, price: 1299 },
                    { months: 6, originalPrice: 2994, price: 2299 },
                    { months: 12, originalPrice: 5988, price: 3999 },
                ],
            });
        }
        res.json({ success: true, pricing: doc });
    } catch (err) {
        console.error("Get custom test pricing error:", err);
        res.status(500).json({ success: false, message: "Failed to load pricing." });
    }
};

export const updateCustomTestPricingOwner = async (req, res) => {
    try {
        const { pro, promax } = req.body;
        const REQUIRED_MONTHS = [1, 3, 6, 12];

        function validatePlan(rows, label) {
    if (!Array.isArray(rows) || rows.length < 1) {
        throw new Error(`${label} requires at least one duration.`);
    }
    const monthsSeen = new Set();
    for (const r of rows) {
        const m = Number(r.months);
        if (!Number.isInteger(m) || m < 1 || m > 36) {
            throw new Error(`${label}: the month value must be between 1 and 36.`);
        }
        if (monthsSeen.has(m)) {
            throw new Error(`${label}: ${m} month is duplicated. Each duration can only be added once.`);
        }
        monthsSeen.add(m);
        if (Number(r.price) > Number(r.originalPrice)) {
            throw new Error(`${label} ${m} month: price cannot be greater than the original price.`);
        }
        if (Number(r.price) < 0 || Number(r.originalPrice) < 0) {
            throw new Error(`${label} ${m} month: price cannot be negative.`);
        }
    }
}

        validatePlan(pro, "Pro");
        validatePlan(promax, "Pro Max");

        const updated = await CustomTestPricing.findOneAndUpdate(
            { key: "default" },
            { pro, promax, updatedBy: req.user._id },
            { new: true, upsert: true }
        );

        res.json({ success: true, pricing: updated, message: "Pricing updated successfully." });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message || "Failed to update." });
    }
};



// ---------------- GET EXAM PATTERN SUMMARY (modal prefill ke liye) ----------------
export const getExamPatternSummary = async (req, res) => {
    try {
        const { category, exam } = req.query;
        if (!category || !exam) {
            return res.status(400).json({ success: false, message: "Category and exam are required." });
        }

        const doc = await ExamPatternSummary.findOne({ category, exam }).lean();
        res.json({ success: true, data: doc || null });
    } catch (err) {
        console.error("Get exam pattern summary error:", err);
        res.status(500).json({ success: false, message: "Failed to load." });
    }
};

export const getCategoriesOwner = async (req, res) => {
    try {
        const categories = await Category.find({}).select("name").sort({ name: 1 }).lean();
        res.json({ success: true, categories });
    } catch (err) {
        console.error("Get categories error:", err);
        res.status(500).json({ success: false, message: "Failed to load categories." });
    }
};

// ---------------- GET SUBJECTS+MARKS for a category+exam (Listing.marks se) ----------------
export const getListingMarksForExam = async (req, res) => {
    try {
        const { category, exam } = req.query;

        if (!category || !exam) {
            return res.status(400).json({ success: false, message: "Category and exam are required." });
        }

        // 👇 NAYA — pehle isi category+exam ki multi-part (Tier / Part / Prelims-Mains ...) listing dhoondo
        const multiListing = await Listing.findOne({
            category, exam, examStructure: "multi", "tiers.1": { $exists: true }
        }).select("marks tiers").lean();

        if (multiListing) {
            const sorted = [...multiListing.tiers].sort((a, b) => (a.order || 0) - (b.order || 0));
            const parts = sorted.map((t, i) => ({
                key: t.key,
                name: t.name,
                // pehle part ka marks listing ke purane field me hota hai, baaki parts ka tiers[i].marks me
                marks: i === 0 ? (multiListing.marks || []) : (t.marks || [])
            }));
            return res.json({ success: true, marks: parts[0].marks, parts });
        }

        // Single exam: purana logic bilkul waisa hi
        // Isi category+exam ki koi bhi listing dhoondo jiske paas marks config ho
        const listing = await Listing.findOne({ category, exam, "marks.0": { $exists: true } })
            .select("marks")
            .lean();

        if (!listing) {
            return res.json({ success: true, marks: [], parts: [] });
        }

        res.json({ success: true, marks: listing.marks || [], parts: [] });
    } catch (err) {
        console.error("Get listing marks for exam error:", err);
        res.status(500).json({ success: false, message: "Failed to load marks." });
    }
};

// ---------------- SAVE EXAM PATTERN SUMMARY (upsert on category+exam) ----------------
 
// 👇 NAYA helper — ek part ke rows + time ko saaf karta hai
function normalizePatternPart(p) {
    const strategy = p.timeStrategy === "sectional" ? "sectional" : "total";
    return {
        rows: (Array.isArray(p.rows) ? p.rows : []).map(r => ({
            subject: String(r.subject || "").trim(),
            questions: Number(r.questions) || 0,
            positiveMarks: Number(r.positiveMarks) || 0,
            negativeMarks: Number(r.negativeMarks) || 0
        })),
        timeStrategy: strategy,
        totalDuration: strategy === "total" ? (Number(p.totalDuration) || 60) : 60,
        sectionTime: strategy === "sectional"
            ? (Array.isArray(p.sectionTime) ? p.sectionTime.map(st => ({
                subjects: Array.isArray(st.subjects) ? st.subjects : [],
                duration: Number(st.duration) || 0
            })) : [])
            : []
    };
}

export const saveExamPatternSummary = async (req, res) => {
    try {
        const { category, exam, rows, timeStrategy, totalDuration, sectionTime, parts } = req.body;

        if (!category || !exam) {
            return res.status(400).json({ success: false, message: "Category and exam are required." });
        }

        let updateData;

        // 👇 NAYA — multi-part exam (modal ke tabs): kam se kam 2 parts aaye
        if (Array.isArray(parts) && parts.length >= 2) {
            const cleanParts = parts.slice(0, 6).map((p, i) => ({
                key: String(p.key || "").trim() || `part-${i + 1}`,
                name: String(p.name || "").trim() || `Part ${i + 1}`,
                ...normalizePatternPart(p)
            }));

            let totalRows = 0;
            for (const p of cleanParts) {
                for (const r of p.rows) {
                    if (!r.subject) {
                        return res.status(400).json({ success: false, message: `${p.name}: each row must have a subject.` });
                    }
                    if (r.questions < 0) {
                        return res.status(400).json({ success: false, message: `${p.name} - ${r.subject}: the question count is invalid.` });
                    }
                    totalRows++;
                }
            }
            // Koi ek part khali ho sakta hai, par poore exam me kam se kam ek subject chahiye
            if (totalRows === 0) {
                return res.status(400).json({ success: false, message: "At least one subject row is required." });
            }

            const [first, ...rest] = cleanParts;
            updateData = {
                category,
                exam,
                // pehle part ka data purane fields me (Custom Test / purana code waisa hi chalta hai)
                rows: first.rows,
                timeStrategy: first.timeStrategy,
                totalDuration: first.totalDuration,
                sectionTime: first.sectionTime,
                firstPart: { key: first.key, name: first.name },
                parts: rest
            };
        } else {
            // Single exam: purana logic bilkul waisa hi
            if (!Array.isArray(rows) || rows.length === 0) {
                return res.status(400).json({ success: false, message: "At least one subject row is required." });
            }

            for (const r of rows) {
                if (!r.subject || !r.subject.trim()) {
                    return res.status(400).json({ success: false, message: "Each row must have a subject." });
                }
                if (r.questions === undefined || Number(r.questions) < 0) {
                    return res.status(400).json({ success: false, message: `${r.subject}: the question count is invalid.` });
                }
            }

            const finalTimeStrategy = timeStrategy === "sectional" ? "sectional" : "total";

            updateData = {
                category,
                exam,
                rows: rows.map(r => ({
                    subject: r.subject.trim(),
                    questions: Number(r.questions) || 0,
                    positiveMarks: Number(r.positiveMarks) || 0,
                    negativeMarks: Number(r.negativeMarks) || 0
                })),
                timeStrategy: finalTimeStrategy,
                totalDuration: finalTimeStrategy === "total" ? (Number(totalDuration) || 60) : 60,
                sectionTime: finalTimeStrategy === "sectional"
                    ? (Array.isArray(sectionTime) ? sectionTime.map(st => ({
                        subjects: Array.isArray(st.subjects) ? st.subjects : [],
                        duration: Number(st.duration) || 0
                    })) : [])
                    : [],
                // 👇 NAYA — single exam me parts saaf (pehle multi tha to ab nahi)
                firstPart: {},
                parts: []
            };
        }

        const doc = await ExamPatternSummary.findOneAndUpdate(
            { category, exam },
            updateData,
            { new: true, upsert: true, runValidators: true }
        );

        res.json({ success: true, message: "Exam pattern saved successfully.", data: doc });
    } catch (err) {
        console.error("Save exam pattern summary error:", err);
        res.status(500).json({ success: false, message: err.message || "Failed to save." });
    }
};

// ---------------- GET ALL EXAM PATTERN SUMMARIES (list, optional category filter) ----------------
export const getAllExamPatternSummaries = async (req, res) => {
    try {
        const { category } = req.query;
        const filter = {};
        if (category) filter.category = category;

        const docs = await ExamPatternSummary.find(filter)
            .populate("category", "name")
            .sort({ updatedAt: -1 })
            .limit(10)
            .lean();

        res.json({ success: true, patterns: docs });
    } catch (err) {
        console.error("Get all exam pattern summaries error:", err);
        res.status(500).json({ success: false, message: "Failed to load." });
    }
};

// ---------------- DELETE EXAM PATTERN SUMMARY ----------------
export const deleteExamPatternSummary = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await ExamPatternSummary.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({ success: false, message: "Not found." });
        res.json({ success: true, message: "Deleted successfully." });
    } catch (err) {
        console.error("Delete exam pattern summary error:", err);
        res.status(500).json({ success: false, message: "Failed to delete." });
    }
};






// ---------------- GRANT CUSTOM TEST ACCESS (Pro / Pro Max) ----------------
export const grantCustomTestAccess = async (req, res) => {
    try {
        const { id } = req.params;
        const { plan } = req.body;
        const months = Number(req.body.months);

        if (!["pro", "promax"].includes(plan)) {
            return res.status(400).json({ success: false, message: "Please select a plan (Pro or Pro Max)." });
        }

        const pricingDoc = await CustomTestPricing.findOne({ key: "default" }).lean();
        const row = (pricingDoc?.[plan] || []).find(r => r.months === months);
        if (!row) {
            return res.status(400).json({ success: false, message: "This duration is not available in the pricing configuration." });
        }

        const targetUser = await User.findById(id);
        if (!targetUser) return res.status(404).json({ success: false, message: "User not found." });
        if (targetUser.role === "owner") {
            return res.status(400).json({ success: false, message: "The owner already has Pro Max access." });
        }

        const now = new Date();
        const isSameTierActive =
            targetUser.customTestTier === plan &&
            targetUser.customTestExpiresAt &&
            targetUser.customTestExpiresAt > now;
        const base = isSameTierActive ? targetUser.customTestExpiresAt : now;
        const newExpiresAt = new Date(base);
        newExpiresAt.setDate(newExpiresAt.getDate() + months * 30);

        targetUser.customTestTier = plan;
        targetUser.customTestExpiresAt = newExpiresAt;
        await targetUser.save();

        // NOTE: owner grant ka payment record store nahi hota (sirf asli payments store hote hain)

        res.json({
            success: true,
            message: `${plan === "promax" ? "Pro Max" : "Pro"} access granted for ${months} month(s).`
        });
    } catch (err) {
        console.error("Grant custom test access error:", err);
        res.status(500).json({ success: false, message: "Failed to grant access." });
    }
};

// ---------------- REVOKE CUSTOM TEST ACCESS ----------------
export const revokeCustomTestAccess = async (req, res) => {
    try {
        const { id } = req.params;
        const targetUser = await User.findById(id);
        if (!targetUser) return res.status(404).json({ success: false, message: "User not found." });

        targetUser.customTestTier = "free";
        targetUser.customTestExpiresAt = null;
        await targetUser.save();

        res.json({ success: true, message: "Custom Test access removed successfully." });
    } catch (err) {
        console.error("Revoke custom test access error:", err);
        res.status(500).json({ success: false, message: "Failed to remove access." });
    }
};

// ---------------- USER KA CUSTOM TEST AI USAGE (owner ke liye) ----------------
export const getUserAIUsageOwner = async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.id).select("customTestTier customTestExpiresAt");
        if (!targetUser) return res.status(404).json({ success: false, message: "User not found." });

        const now = new Date();
        const rawTier = targetUser.customTestTier || "free";
        const active = rawTier !== "free" && (!targetUser.customTestExpiresAt || targetUser.customTestExpiresAt > now);
        const tier = active ? rawTier : "free";

        const summary = await getUsageSummary(targetUser._id, tier);

        res.json({
            success: true,
            tier,
            tierLabel: tier === "promax" ? "Pro Max" : (tier === "pro" ? "Pro" : "Free"),
            usage: {
                aiQuestions: { used: summary.questionsUsed, limit: summary.questionsLimit },
                requests: { used: summary.apiCallsUsed, limit: summary.apiCallsLimit },
                text: { used: summary.textCharsUsed, limit: summary.textCharsLimit },
                images: { used: summary.imagesUsed, limit: summary.imagesLimit },
                pdf: { used: summary.pdfMBUsed, limit: summary.pdfMBLimit }
            },
            limits: summary.limits
        });
    } catch (err) {
        console.error("Owner AI usage error:", err);
        res.status(500).json({ success: false, message: "Failed to load AI usage." });
    }
};






// ================= EXAM SYLLABUS (Add Content) =================

const SYLLABUS_MAX_PARTS = 6;
const SYLLABUS_MAX_ROWS = 30;

function isValidSyllabusQuery(category, exam) {
    return mongoose.Types.ObjectId.isValid(category) && exam.length > 0 && exam.length <= 200;
}

// Listing ke Exam Structure se parts nikalta hai
// Default => 1 part (naam khali) | Tier/Part/Prelims-Mains/... => listing ke tiers ke naam
async function getSyllabusStructure(category, exam) {
    const multiListing = await Listing.findOne({
        category, exam, examStructure: "multi", "tiers.1": { $exists: true }
    }).select("structureType tiers").lean();

    if (multiListing) {
        const parts = [...multiListing.tiers]
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .slice(0, SYLLABUS_MAX_PARTS)
            .map((t, i) => ({ key: t.key, name: t.name, order: i }));
        return { examStructure: "multi", structureType: multiListing.structureType || "", parts };
    }

    const anyListing = await Listing.exists({ category, exam });
    if (!anyListing) return null;

    return {
        examStructure: "single",
        structureType: "",
        parts: [{ key: "default", name: "", order: 0 }]
    };
}

export const getExamSyllabus = async (req, res) => {
    try {
        const category = String(req.query.category || "");
        const exam = String(req.query.exam || "").trim();

        if (!isValidSyllabusQuery(category, exam)) {
            return res.status(400).json({ success: false, message: "Category and exam are required." });
        }

        const structure = await getSyllabusStructure(category, exam);
        if (!structure) {
            return res.status(404).json({ success: false, message: "No test series found for this exam." });
        }

        const saved = await ExamSyllabus.findOne({ category, exam }).lean();
        const savedParts = (saved && saved.parts) || [];

        const parts = structure.parts.map((p) => {
            let match = savedParts.find(sp => sp.key === p.key);
            if (!match && structure.examStructure === "single") match = savedParts[0];
            return {
                key: p.key,
                name: p.name,
                rows: ((match && match.rows) || []).map(r => ({ subject: r.subject, topics: r.topics || "" }))
            };
        });

        res.json({
            success: true,
            exam,
            examStructure: structure.examStructure,
            structureType: structure.structureType,
            parts,
            hasSaved: !!saved
        });
    } catch (err) {
        console.error("Get exam syllabus error:", err);
        res.status(500).json({ success: false, message: "Failed to load syllabus." });
    }
};

export const saveExamSyllabus = async (req, res) => {
    try {
        const category = String(req.body.category || "");
        const exam = String(req.body.exam || "").trim();
        const incoming = Array.isArray(req.body.parts) ? req.body.parts : [];

        if (!isValidSyllabusQuery(category, exam)) {
            return res.status(400).json({ success: false, message: "Category and exam are required." });
        }

        // Structure hamesha listing se lo (client pe bharosa nahi)
        const structure = await getSyllabusStructure(category, exam);
        if (!structure) {
            return res.status(404).json({ success: false, message: "No test series found for this exam." });
        }

        let totalRows = 0;
        const cleanParts = [];

        for (const sp of structure.parts) {
            const inPart = incoming.find(p => p && p.key === sp.key);
            const rawRows = Array.isArray(inPart && inPart.rows) ? inPart.rows : [];
            const label = sp.name || "Syllabus";

            if (rawRows.length > SYLLABUS_MAX_ROWS) {
                return res.status(400).json({
                    success: false,
                    message: `${label}: maximum ${SYLLABUS_MAX_ROWS} subjects allowed.`
                });
            }

            const rows = [];
            for (const r of rawRows) {
                const subject = String((r && r.subject) ?? "").trim().slice(0, 80);
                const topics = String((r && r.topics) ?? "").replace(/\r\n?/g, "\n").trim().slice(0, 1500);

                if (!subject && !topics) continue;
                if (!subject) {
                    return res.status(400).json({
                        success: false,
                        message: `${label}: subject name is required for every row.`
                    });
                }
                rows.push({ subject, topics });
            }

            totalRows += rows.length;
            cleanParts.push({ key: sp.key, name: sp.name, order: sp.order, rows });
        }

        // Sab khali => syllabus hata do (green badge bhi hat jayega)
        if (totalRows === 0) {
            await ExamSyllabus.deleteOne({ category, exam });
            return res.json({ success: true, removed: true, hasSyllabus: false, message: "Syllabus removed." });
        }

        await ExamSyllabus.findOneAndUpdate(
            { category, exam },
            {
                category,
                exam,
                examStructure: structure.examStructure,
                structureType: structure.structureType,
                parts: cleanParts
            },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
        );

        res.json({ success: true, hasSyllabus: true, message: "Syllabus saved successfully." });
    } catch (err) {
        console.error("Save exam syllabus error:", err);
        res.status(500).json({ success: false, message: "Failed to save syllabus." });
    }
};