import Category from "../models/Category.js";
import Listing from "../models/listing.js";
import Test from "../models/Test.js";
import { getValidEnrollments } from "../utils/cleanupHelpers.js";


// Helper: name se URL-friendly slug banata hai
const generateSlug = (name) => {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
};

// Helper: user input ko regex-safe banata hai
// Isse "(", ")", ".", "+", "?" jaise special characters escape ho jate hain,
// taaki "IAF (X Group)" jaisa text RegExp ko crash na kare
const escapeRegex = (str) => {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// GET /categories  -> saari categories dikhane wala page
export const getAllCategories = async (req, res) => {
    const isOwner = req.user && req.user.role === "owner";
    const categories = await Category.find({}).sort({ createdAt: -1 }).lean();

    const categoryIds = categories.map(c => c._id);
    const listingCounts = await Listing.aggregate([
        { $match: { category: { $in: categoryIds } } },
        { $group: { _id: "$category", count: { $sum: 1 } } }
    ]);
    const countMap = {};
    listingCounts.forEach(c => { countMap[String(c._id)] = c.count; });
    categories.forEach(c => { c.examCount = countMap[String(c._id)] || 0; });

    res.render("pages/categories", {
        categories,
        isOwner,
        title: "All Exam Categories - WarmupExam",
        description: "Browse all exam categories available on WarmupExam.",
        keywords: "exam categories, mock test categories",
        canonicalUrl: "https://warmupexam.com/categories",
    });
};

// POST /categories  -> nayi category create karta hai
export const createCategory = async (req, res) => {
    try {
        const { name, icon, description } = req.body;

        if (!name || !icon || !description) {
            req.flash && req.flash("error", "All fields are required");
            return res.redirect("back");
        }

        const slug = generateSlug(name);

        const existing = await Category.findOne({ slug });
        if (existing) {
            req.flash && req.flash("error", "A category with this name already exists");
            return res.redirect("back");
        }

        await Category.create({
            name,
            icon,
            description,
            slug,
        });

        req.flash && req.flash("success", "Category added successfully");
        res.redirect("/");
    } catch (err) {
        console.error(err);
        req.flash && req.flash("error", "Something went wrong");
        res.redirect("back");
    }
};

// GET /categories/:id/edit  -> edit form dikhata hai
export const editCategoryForm = async (req, res) => {
    const category = await Category.findById(req.params.id).lean();

    if (!category) {
        req.flash && req.flash("error", "Category not found");
        return res.redirect("/");
    }

    res.render("pages/ui/editCategory", {
        category,
        title: "Edit Category",
    });
};

// PUT /categories/:id  -> category update karta hai
export const updateCategory = async (req, res) => {
    try {
        const { name, icon, description } = req.body;

        await Category.findByIdAndUpdate(req.params.id, {
            name,
            icon,
            description,
            slug: generateSlug(name),
        });

        req.flash && req.flash("success", "Category updated successfully");
        res.redirect("/");
    } catch (err) {
        console.error(err);
        req.flash && req.flash("error", "Something went wrong");
        res.redirect("back");
    }
};

// DELETE /categories/:id  -> category delete karta hai
export const deleteCategory = async (req, res) => {
    try {
        await Category.findByIdAndDelete(req.params.id);
        req.flash && req.flash("success", "Category deleted successfully");
        res.redirect("/");
    } catch (err) {
        console.error(err);
        req.flash && req.flash("error", "Something went wrong");
        res.redirect("/");
    }
};

// GET /categories/:slug  -> ek category ka detail page
export const showCategory = async (req, res) => {
    const { slug } = req.params;

    const category = await Category.findOne({ slug }).lean();
    if (!category) {
        req.flash && req.flash("error", "Category not found");
        return res.redirect("/");
    }

    const isOwner = req.user && req.user.role === "owner";

    const baseFilter = { category: category._id };
    if (!isOwner) baseFilter.visibility = "public";

    const totalListingsCount = await Listing.countDocuments(baseFilter);

    const categoryListingIds = await Listing.find(baseFilter).select("_id").lean();
    const listingIds = categoryListingIds.map(l => l._id);
    const totalTestsCount = await Test.countDocuments({ listing: { $in: listingIds } });
    const languages = await Listing.distinct("language", baseFilter);
    const exams = await Listing.distinct("exam", baseFilter); 

    // Default "All" filter — top 8 listings (newest first)
    const listings = await Listing.find(baseFilter)
        .sort({ createdAt: -1 })
        .limit(8)
        .lean();

    const listingIdsForCount = listings.map(l => l._id);
    const testCounts = await Test.aggregate([
        { $match: { listing: { $in: listingIdsForCount } } },
        { $group: { _id: "$listing", count: { $sum: 1 } } }
    ]);
    const testCountMap = {};
    testCounts.forEach(t => { testCountMap[String(t._id)] = t.count; });
    listings.forEach(l => {
        l.totalTestCount = testCountMap[String(l._id)] || 0;
    });

    const { enrolledIds, enrolledExpiryMap } = getValidEnrollments(req.user);

   // ============================================================
    // 🔍 DYNAMIC SEO — category ke basis pe
    // ============================================================

    const seoTitle = `${category.name} Mock Test Series - ${totalListingsCount} Test Series | WarmupExam`;

    const seoDescription = category.description
        ? `${category.description} Practice ${totalListingsCount} test series with ${totalTestsCount} total mock tests, true negative marking and AI-powered analysis on WarmupExam.`
        : `Explore ${category.name} exam preparation on WarmupExam. Browse ${totalListingsCount} mock test series with ${totalTestsCount} total tests, true negative marking and AI-powered performance analysis.`;

    const seoKeywords = [
        `${category.name} mock test`,
        `${category.name} test series`,
        `${category.name} online test`,
        `${category.name} exam preparation`,
        ...exams.filter(Boolean).slice(0, 5).map(e => `${e} mock test`)
    ].join(", ");

    const canonicalUrl = `https://warmupexam.com/categories/${category.slug}`;

    res.render("pages/categories/categoryDetail", {
        category,
        listings,
        totalListingsCount,
        totalTestsCount,
        enrolledIds,
        enrolledExpiryMap,
        isOwner,
        languages: languages.filter(Boolean).sort(),
        exams: exams.filter(Boolean).sort(),
        csrfToken: req.csrfToken ? req.csrfToken() : "", 
        activeFilter: "all",
        title: seoTitle,
        description: seoDescription,
        keywords: seoKeywords,
        canonicalUrl,
    });
};

// ============================================================
// Neeche sirf AJAX / API section hai — category detail page
// ke tabs, search, view-all sab isi se kaam karte hain.
// Ye poora system apne aap DYNAMIC hai — jo bhi category ka
// slug URL me aayega, search/tabs/popular sirf USI category
// (uski listings) ke andar scoped rahenge. Defence, UG, PG,
// Police, SSC — sabhi categories ke liye same code chalta hai,
// koi category-specific hardcoding nahi hai.
// ============================================================

// Seeded random shuffle — Popular tab ke liye (isi din pagination consistent rahegi)
function seededShuffle(array, seed) {
    let a = seed;
    const random = () => {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function getDailySeed(extraKey = "") {
    const dateStr = new Date().toISOString().slice(0, 10);
    let hash = 0;
    const str = dateStr + extraKey;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return hash;
}

// GET /api/categories/:slug/tests
// Category detail page (categoryDetail.ejs) isi ek endpoint ko call karta hai
// tabs (all/popular/free/paid/latest), search box, aur View All button — teeno ke liye
 

export const getCategoryTestsApi = async (req, res) => {
    try {
        const { slug } = req.params;
        const { filter = "all", search = "", page = 1, limit, language = "", exam = "" } = req.query; // 👈 fix yahi hai
        const perPage = limit ? parseInt(limit, 10) : 8;
        const pageNum = parseInt(page, 10) || 1;

        const category = await Category.findOne({ slug }).lean();
        if (!category) return res.json({ success: false, listings: [], hasMore: false, total: 0 });

        const isOwner = req.user && req.user.role === "owner";
        const baseFilter = { category: category._id };
        if (!isOwner) baseFilter.visibility = "public";

        if (filter === "free") baseFilter.type = "Free";
        else if (filter === "paid") baseFilter.type = "Paid";

        if (language && language !== "all") {
            baseFilter.language = language;
        }

        if (exam && exam !== "all") {
            baseFilter.exam = exam;
        }

        if (search && search.trim()) {
            const regex = new RegExp(escapeRegex(search.trim()), "i");
            baseFilter.$or = [{ title: regex }, { exam: regex }];
        }

        let allMatching = await Listing.find(baseFilter).sort({ createdAt: -1 }).lean();

        if (filter === "popular") {
            const seed = getDailySeed(String(category._id));
            allMatching = seededShuffle(allMatching, seed);
        }

        const totalMatching = allMatching.length;

        const effectiveLimit = (limit === "all" || limit === "0") ? totalMatching : (pageNum * perPage);
        const paginated = allMatching.slice(0, effectiveLimit || totalMatching);
        const hasMore = totalMatching > paginated.length;

        const listingIds = paginated.map((l) => l._id);
        const testCounts = await Test.aggregate([
            { $match: { listing: { $in: listingIds } } },
            { $group: { _id: "$listing", count: { $sum: 1 } } },
        ]);
        const testCountMap = {};
        testCounts.forEach((t) => { testCountMap[String(t._id)] = t.count; });

        const { enrolledIds } = getValidEnrollments(req.user);

        const listings = paginated.map((l) => ({
            ...l,
            totalTestCount: testCountMap[String(l._id)] || 0,
            canAccess: isOwner || enrolledIds.includes(String(l._id)),
            isOwner,
            currentUser: !!req.user,
        }));

        res.json({ success: true, listings, hasMore, total: totalMatching });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, listings: [], hasMore: false, total: 0 });
    }
};

// GET /api/categories/:slug/search-suggestions?q=
// Dropdown ke liye grouped suggestions — Exam names alag, Test Series names alag
// Ye bhi hamesha isi category (slug) ke andar hi scoped rehta hai
export const getCategorySearchSuggestions = async (req, res) => {
    try {
        const { slug } = req.params;
        const q = (req.query.q || "").trim();
        if (!q) return res.json({ exams: [], series: [] });

        const category = await Category.findOne({ slug }).lean();
        if (!category) return res.json({ exams: [], series: [] });

        const isOwner = req.user && req.user.role === "owner";
        const baseFilter = { category: category._id };
        if (!isOwner) baseFilter.visibility = "public";

        const regex = new RegExp(escapeRegex(q), "i");

        // Group 1: Test Series (listing.title match) — isi category ke andar
        const seriesMatches = await Listing.find({ ...baseFilter, title: regex })
            .select("title slug")
            .limit(6)
            .lean();

        // Group 2: Exam names (exam field match) — isi category ke andar
        const examMatches = await Listing.find({ ...baseFilter, exam: regex }).distinct("exam");

        res.json({
            series: seriesMatches.map((s) => ({ label: s.title, slug: s.slug })),
            exams: examMatches.slice(0, 6).map((e) => ({ label: e })),
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ exams: [], series: [] });
    }
};





