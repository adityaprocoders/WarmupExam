import User from "../models/usersShema.js";
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
import CustomTestPayment from "../models/customTestPayment.js";



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

        // Real revenue: is mahine ke sab enrollments ka amountPaid sum
        const revenueAgg = await User.aggregate([
            { $unwind: "$enrolledListings" },
            { $match: { "enrolledListings.enrolledAt": { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: "$enrolledListings.amountPaid" } } }
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
        const revenueRaw = await User.aggregate([
            { $unwind: "$enrolledListings" },
            { $match: { "enrolledListings.enrolledAt": { $gte: sixMonthsAgo } } },
            {
                $group: {
                    _id: {
                        year: { $year: "$enrolledListings.enrolledAt" },
                        month: { $month: "$enrolledListings.enrolledAt" }
                    },
                    total: { $sum: "$enrolledListings.amountPaid" }
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
        const purchasedAgg = await User.aggregate([
            { $unwind: "$enrolledListings" },
            { $match: { "enrolledListings.amountPaid": { $gt: 0 } } },
            { $group: { _id: "$enrolledListings.listing", count: { $sum: 1 } } }
        ]);

        const enrolledMap = new Map(enrolledAgg.map(e => [String(e._id), e.count]));
        const purchasedMap = new Map(purchasedAgg.map(p => [String(p._id), p.count]));

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
                purchasedCount: purchasedMap.get(String(l._id)) || 0   
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

        // 🔧 FIX: pehle listing na milne par bhi "success:true" jaisa response ban sakta tha.
        // Ab agar listing already nahi hai to clear 404 milega, frontend confuse nahi hoga.
        const deleted = await Listing.findByIdAndDelete(id);
        if (!deleted) {
            return res.status(404).json({ success: false, message: "Test series not found." });
        }

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

        const testSeriesPayments = targetUser.enrolledListings.map(e => ({
            invoiceId: e.orderId || e.paymentId || "FREE-" + e._id.toString().slice(-6).toUpperCase(),
            amount: e.amountPaid || 0,
            date: e.enrolledAt.toDateString(),
            status: e.amountPaid > 0 ? "Paid" : "Free",
            sortDate: e.enrolledAt
        }));

        const customPayments = await CustomTestPayment.find({ user: targetUser._id, status: "paid" }).lean();
        const customTestPayments = customPayments.map(p => ({
            invoiceId: p.razorpayOrderId.startsWith("owner_grant_")
                ? `CT-GRANT-${String(p._id).slice(-6).toUpperCase()}`
                : p.razorpayOrderId,
            amount: p.amount || 0,
            date: new Date(p.createdAt).toDateString(),
            status: p.amount > 0 ? "Paid" : "Free",
            sortDate: p.createdAt
        }));

        const paymentHistory = [...testSeriesPayments, ...customTestPayments]
            .sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate));

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

        const userDetail = {
            _id: targetUser._id,
            name: targetUser.name,
            email: targetUser.email,
            mobile: targetUser.mobile || "-",
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

            testsAttempted: "—",
            overallAccuracy: "—",
            averageScore: "—",
            highestScore: "—",
            bestRank: "—",
            currentRank: "—",
            leaderboardPosition: "—",
            percentile: "—",
            currentStreak: "—",
            totalStudyTime: "—",
            streakUpNote: "",
            activityLog: []
        };

        const availableListings = await Listing.find({});

        res.render("owner/userDetail", {
            userDetail, availableListings, user: req.user,
            customTestInfo, customTestPricing, customTestPricingJson
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
        const days = Number(duration) || 30;
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
                existing.expiresAt = expiresAt;
                // 🔧 FIX: enrolledAt ko reset nahi karte agar wo already paid tha — sirf naya (free) grant hone par set karo
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

// ---------------- PAYMENTS (real, sab users ke paid enrollments se) ----------------
// 🆕 NEW: "Payments" tab pehle sirf static placeholder tha ("Payments history yaha aayegi").
// Ab ye real DB se paid transactions nikalta hai.
export const getAllPaymentsOwner = async (req, res) => {
    try {
        const paymentsAgg = await User.aggregate([
            { $unwind: "$enrolledListings" },
            { $match: { "enrolledListings.amountPaid": { $gt: 0 } } },
            {
                $lookup: {
                    from: "listings",
                    localField: "enrolledListings.listing",
                    foreignField: "_id",
                    as: "listingInfo"
                }
            },
            { $unwind: { path: "$listingInfo", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: "$enrolledListings._id",
                    userName: "$name",
                    userEmail: "$email",
                    listingTitle: { $ifNull: ["$listingInfo.title", "Deleted Listing"] },
                    amount: "$enrolledListings.amountPaid",
                    date: "$enrolledListings.enrolledAt",
                    invoiceId: {
                        $ifNull: [
                            "$enrolledListings.orderId",
                            { $ifNull: ["$enrolledListings.paymentId", "-"] }
                        ]
                    }
                }
            },
            { $sort: { date: -1 } },
            { $limit: 200 } // recent 200 transactions — pagination baad me add ki ja sakti hai
        ]);

        const totalRevenue = paymentsAgg.reduce((sum, p) => sum + (p.amount || 0), 0);

        res.json({ success: true, payments: paymentsAgg, totalRevenue, count: paymentsAgg.length });
    } catch (err) {
        console.error("Get payments error:", err);
        res.status(500).json({ success: false, message: "Failed to load payments." });
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

// ---------------- ESTIMATED REACH (audience select karte hi call hota hai) ----------------
export const getNotificationReach = async (req, res) => {
    try {
        const { audienceType, customUserIds } = req.query;

        let count = 0;
        if (audienceType === "all") {
            count = await User.countDocuments();
        } else if (audienceType === "paid") {
            count = await User.countDocuments({ "enrolledListings.amountPaid": { $gt: 0 } });
        } else if (audienceType === "free") {
            count = await User.countDocuments({
                $or: [{ enrolledListings: { $size: 0 } }, { "enrolledListings.amountPaid": { $not: { $gt: 0 } } }]
            });
        } else if (audienceType === "custom") {
            const ids = customUserIds ? customUserIds.split(",").filter(Boolean) : [];
            count = ids.length;
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

        const doc = new Notification({
            title,
            message,
            audienceType,
            customUserIds: audienceType === "custom" ? (customUserIds || []) : [],
            createdBy: req.user._id
        });

        if (scheduleType === "later" && scheduledAt) {
            doc.scheduledAt = new Date(scheduledAt);
            doc.status = "scheduled";
        } else {
            doc.sentAt = new Date();
            doc.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24hr expiry yahi set hoti hai
            doc.status = "sent";
        }

        await doc.save();
        res.json({ success: true, notification: doc, message: "Notification sent successfully." });
    } catch (err) {
        console.error("Create notification error:", err);
        res.status(500).json({ success: false, message: "Notification bhej nahi payi" });
    }
};


export const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
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

        const notif = await Notification.findById(id);
        if (!notif) return res.status(404).json({ success: false, message: "Notification not found." });

        if (notif.status === "sent") {
            return res.status(400).json({ success: false, message: "A notification that has already been sent cannot be edited. You can only delete it." });
        }

        notif.title = title;
        notif.message = message;
        notif.audienceType = audienceType;
        notif.customUserIds = audienceType === "custom" ? (customUserIds || []) : [];

        if (scheduleType === "later" && scheduledAt) {
            notif.scheduledAt = new Date(scheduledAt);
            notif.status = "scheduled";
        } else {
            notif.sentAt = new Date();
            notif.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
            notif.status = "sent";
        }

        await notif.save();
        res.json({ success: true, notification: notif, message: "Notification updated successfully." });
    } catch (err) {
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

        // Isi category+exam ki koi bhi listing dhoondo jiske paas marks config ho
        const listing = await Listing.findOne({ category, exam, "marks.0": { $exists: true } })
            .select("marks")
            .lean();

        if (!listing) {
            return res.json({ success: true, marks: [] });
        }

        res.json({ success: true, marks: listing.marks || [] });
    } catch (err) {
        console.error("Get listing marks for exam error:", err);
        res.status(500).json({ success: false, message: "Failed to load marks." });
    }
};

// ---------------- SAVE EXAM PATTERN SUMMARY (upsert on category+exam) ----------------
export const saveExamPatternSummary = async (req, res) => {
    try {
        const { category, exam, rows, timeStrategy, totalDuration, sectionTime } = req.body;

        if (!category || !exam) {
            return res.status(400).json({ success: false, message: "Category and exam are required." });
        }
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

        const updateData = {
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
                : []
        };

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

        try {
            await CustomTestPayment.create({
                user: targetUser._id,
                plan,
                months,
                amount: 0,
                razorpayOrderId: `owner_grant_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                razorpayPaymentId: "owner_grant",
                status: "paid",
                source: "owner"
            });
        } catch (recErr) {
            console.error("Custom test grant record save failed (non-fatal):", recErr);
        }

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