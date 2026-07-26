import User from "../models/usersShema.js";
import Listing from "../models/listing.js";
import { Resend } from "resend";  
import Attempt from "../models/TestAttempt.js"; 
const resend = new Resend(process.env.RESEND_API_KEY);  
import cloudinary from "../config/cloudinary.js";
import { getPublicIdFromUrl } from "../utils/cloudinaryHelper.js";

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
        res.status(500).json({ success: false, message: "Stats load nahi ho payi" });
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
        res.status(500).json({ success: false, message: "Chart data load nahi ho payi" });
    }
};

// ---------------- ALL TEST SERIES (public + private) ----------------
export const getAllTestSeriesOwner = async (req, res) => {
    try {
        const listings = await Listing.find({}).sort({ createdAt: -1 });

        res.json({
            success: true,
            listings: listings.map(l => ({
                _id: l._id,
                title: l.title,
                slug: l.slug,
                price: l.price,
                type: l.type,           // "Free" | "Paid"
                visibility: l.visibility, // "private" | "public"
                image: l.image,
                validityDays: l.validityDays,
                createdAt: l.createdAt
            }))
        });
    } catch (err) {
        console.error("Get all test series error:", err);
        res.status(500).json({ success: false, message: "Test series load nahi ho payi" });
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
            return res.status(404).json({ success: false, message: "Test series nahi mili" });
        }

        res.json({ success: true, message: "Test series delete ho gayi" });
    } catch (err) {
        console.error("Delete test series error:", err);
        res.status(500).json({ success: false, message: "Delete nahi ho paya" });
    }
};

// ---------------- ALL USERS (with search) ----------------
export const getAllUsersOwner = async (req, res) => {
    try {
        const { search } = req.query;

        let filter = {};
        if (search && search.trim() !== "") {
            const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"); // 🔧 FIX: regex-injection se bachne ke liye special chars escape kiye
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
            total: search ? totalMatching : totalUsers, // 🔧 FIX: search karne par badge me poora DB total nahi, matching count dikhega
            users: users.map(u => {
                const hasActiveSub = u.enrolledListings.some(e =>
                    !e.suspendedByOwner && (!e.expiresAt || e.expiresAt > now)
                );

                return {
                    _id: u._id,
                    name: u.name,
                    username: u.username,
                    email: u.email,
                    hasActiveSub
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
        if (!user) return res.status(404).json({ success: false, message: "User nahi mila" });

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
                    message: "Is user ka koi valid (non-expired) subscription nahi hai jise restore kiya ja sake. User detail page se naya subscription grant karo."
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
        res.status(500).json({ success: false, message: "Update nahi ho paya" });
    }
};

// ---------------- DELETE USER ----------------
export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User nahi mila" });
        }

        // ---------- Avatar cloudinary se hatao ----------
        const publicId = getPublicIdFromUrl(user.avatar);
        if (publicId) {
            await cloudinary.uploader.destroy(publicId).catch(() => {});
        }

        // ---------- Attempts + User delete ----------
        await Attempt.deleteMany({ user: id });
        await User.findByIdAndDelete(id);

        res.json({ success: true, message: "User delete ho gaya" });
    } catch (err) {
        console.error("Delete user error:", err);
        res.status(500).json({ success: false, message: "Delete nahi ho paya" });
    }
};
// ---------------- USER DETAIL PAGE ----------------
export const renderUserDetailPage = async (req, res) => {
    try {
        const { id } = req.params;
        const targetUser = await User.findById(id).populate("enrolledListings.listing");

        if (!targetUser) {
            req.flash("error", "User nahi mila");
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

        const paymentHistory = targetUser.enrolledListings.map(e => ({
            invoiceId: e.orderId || e.paymentId || "FREE-" + e._id.toString().slice(-6).toUpperCase(),
            amount: e.amountPaid || 0,
            date: e.enrolledAt.toDateString(),
            status: e.amountPaid > 0 ? "Paid" : "Free"
        }));

        const userDetail = {
            _id: targetUser._id,
            name: targetUser.name,
            email: targetUser.email,
            mobile: targetUser.mobile || "-",
            avatar: targetUser.avatar,
            status: targetUser.banned ? "Banned" : "Active",
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

        res.render("owner/userDetail", { userDetail, availableListings, user: req.user });
    } catch (err) {
        console.error("User detail page error:", err);
        req.flash("error", "Kuch galat ho gaya");
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
            return res.status(400).json({ success: false, message: "Test series select karo" });
        }

        const targetUser = await User.findById(id);
        if (!targetUser) return res.status(404).json({ success: false, message: "User nahi mila" });

        const start = startDate ? new Date(startDate) : new Date();
        const days = Number(duration) || 30;
        const expiresAt = new Date(start);
        expiresAt.setDate(expiresAt.getDate() + days);

        let listingsToGrant = [];

        if (listingId === "ALL") {
            listingsToGrant = await Listing.find({});
        } else {
            const singleListing = await Listing.findById(listingId);
            if (!singleListing) return res.status(404).json({ success: false, message: "Test series nahi mili" });
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
                ? `Sabhi ${listingsToGrant.length} test series free mein grant ho gayi`
                : "Subscription grant ho gaya"
        });
    } catch (err) {
        console.error("Grant subscription error:", err);
        res.status(500).json({ success: false, message: "Grant nahi ho paya" });
    }
};

// ---------------- SAVE ACCESS PERMISSIONS ----------------
export const saveUserPermissions = async (req, res) => {
    try {
        const { id } = req.params;
        const { permissions } = req.body;

        const updated = await User.findByIdAndUpdate(id, { permissions: permissions || [] }, { new: true });
        if (!updated) return res.status(404).json({ success: false, message: "User nahi mila" }); // 🔧 FIX

        res.json({ success: true, message: "Permissions save ho gayi" });
    } catch (err) {
        console.error("Save permissions error:", err);
        res.status(500).json({ success: false, message: "Save nahi ho paya" });
    }
};

// ---------------- BAN / UNBAN USER ----------------
export const toggleBanUser = async (req, res) => {
    try {
        const { id } = req.params;
        const targetUser = await User.findById(id);
        if (!targetUser) return res.status(404).json({ success: false, message: "User nahi mila" });

        targetUser.banned = !targetUser.banned;
        await targetUser.save();

        res.json({ success: true, banned: targetUser.banned });
    } catch (err) {
        console.error("Toggle ban error:", err);
        res.status(500).json({ success: false, message: "Update nahi ho paya" });
    }
};

// ---------------- RESET PASSWORD (Owner triggers, email jaata hai) ----------------
export const ownerResetUserPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const targetUser = await User.findById(id);
        if (!targetUser) return res.status(404).json({ success: false, message: "User nahi mila" });

        const tempPassword = Math.random().toString(36).slice(-8);
        targetUser.password = tempPassword; // pre('save') hook hash kar dega
        await targetUser.save();

        await resend.emails.send({
            from: `WarmupExam <${process.env.CONTACT_SENDER_EMAIL}>`,
            to: targetUser.email,
            subject: "Your Password Has Been Reset",
            html: `<p>Aapka password owner ne reset kiya hai. Naya temporary password: <b>${tempPassword}</b></p>
                   <p>Login karne ke baad ise turant badal lein.</p>`
        });

        res.json({ success: true, message: "Naya password email pe bhej diya gaya" });
    } catch (err) {
        console.error("Owner reset password error:", err);
        res.status(500).json({ success: false, message: "Reset nahi ho paya" });
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
        res.status(500).json({ success: false, message: "Payments load nahi ho paye" });
    }
};