import Ebook from "../models/Ebook.js";
import Category from "../models/Category.js";
import ExpressError from "../utils/ExpressError.js";
import slugify from "slugify";
import { generatePlaceholderImage } from "../utils/placeholderImage.js";

// ================= PUBLIC =================

export const list = async (req, res) => {
    const { search, category, exam, sort } = req.query;
    const isOwner = req.user && req.user.role === "owner";

    const filter = isOwner ? {} : { visibility: "public" };
    if (search) {
        filter.$or = [
            { title: { $regex: search, $options: "i" } },
            { exam: { $regex: search, $options: "i" } },
        ];
    }
    if (category && category !== "all") filter.category = category;
    if (exam && exam !== "all") filter.exam = exam;

    let sortOption = { createdAt: -1 };
    if (sort === "popular") sortOption = { downloadCount: -1 };
    if (sort === "priceLow") sortOption = { price: 1 };
    if (sort === "priceHigh") sortOption = { price: -1 };

    const ebooks = await Ebook.find(filter).populate("category", "name").sort(sortOption).lean();
    const categories = await Category.find({}).sort({ name: 1 }).lean();

    // Owner ko saare exams dikhein, student ko sirf public wale
    const examMatchStage = isOwner ? {} : { visibility: "public" };
    const rawExams = await Ebook.distinct("exam", examMatchStage);
    const exams = rawExams.filter(Boolean).sort();

     

    res.render("pages/ebook/index", {
        ebooks,
        categories,
        exams,
        currentCategory: category || "all",
        currentExam: exam || "all",
        currentSearch: search || "",
        isOwner,
        title: "E-Books - Free & Premium Study Material for Competitive Exams",
        description: "Download free and premium e-books for UPSC, SSC, JEE, NEET, GATE, CAT and 15+ competitive exams.",
        keywords: "WarmupExam ebooks, free ebooks competitive exams, UPSC ebook, SSC ebook",
        canonicalUrl: "https://warmupexam.com/ebooks",
    });
};

export const view = async (req, res) => {
    const ebook = await Ebook.findOne({ slug: req.params.slug }).populate("category", "name").lean();
    if (!ebook) throw new ExpressError(404, "E-Book Not Found");

    const isOwner = req.user && req.user.role === "owner";
    if (ebook.visibility !== "public" && !isOwner) throw new ExpressError(404, "E-Book Not Found");

    let hasAccess = ebook.type === "Free";
    if (!hasAccess && req.user) {
        const purchase = ebook.purchasedBy?.find(p => String(p.user) === String(req.user._id));
        hasAccess = purchase && new Date() < new Date(purchase.expiresAt);
    }

    res.render("pages/ebook/view", {
        ebook,
        hasAccess,
        isOwner,
        title: `${ebook.title} | WarmupExam E-Books`,
        description: (ebook.shortDescription || ebook.description).slice(0, 155),
        keywords: `${ebook.title}, WarmupExam ebook, ${ebook.exam}`,
        canonicalUrl: `https://warmupexam.com/ebooks/${ebook.slug}`,
    });
};

export const download = async (req, res) => {
    const ebook = await Ebook.findOne({ slug: req.params.slug });
    if (!ebook) throw new ExpressError(404, "E-Book Not Found");

    if (ebook.type !== "Free") {
        const purchase = req.user && ebook.purchasedBy?.find(p => String(p.user) === String(req.user._id));
        const valid = purchase && new Date() < new Date(purchase.expiresAt);
        if (!valid) {
            req.flash?.("error", "Please purchase this e-book to download.");
            return res.redirect(`/ebooks/${ebook.slug}`);
        }
    }

    ebook.downloadCount += 1;
    await ebook.save();
    res.redirect(ebook.file.url);
};

// ================= OWNER =================

export const renderNewEbook = async (req, res) => {
    const categories = await Category.find({}).select("name _id").sort({ name: 1 }).lean();
    res.render("pages/ebook/new", { categories });
};

export const createEbook = async (req, res) => {
    const data = req.body.ebook;

    data.originalPrice = Number(data.originalPrice) || 0;
    data.discountPercentage = Number(data.discountPercentage) || 0;
    data.price = data.type === "Free"
        ? 0
        : Math.round(data.originalPrice - (data.originalPrice * data.discountPercentage / 100));
    data.validityDays = Number(data.validityDays) || 365;
    if (data.totalPages) data.totalPages = Number(data.totalPages);

    if (req.files?.coverImage?.[0]) {
        data.coverImage = { url: req.files.coverImage[0].path, publicId: req.files.coverImage[0].filename };
    } else {
        data.coverImage = { url: generatePlaceholderImage(data.exam, data.title) };
    }

    if (!req.files?.ebookFile?.[0]) throw new ExpressError(400, "E-Book PDF file is required.");
    data.file = { url: req.files.ebookFile[0].path, publicId: req.files.ebookFile[0].filename };

    const ebook = new Ebook(data);

    let baseSlug = slugify(ebook.title, { lower: true, strict: true });
    let slug = baseSlug, counter = 1;
    while (await Ebook.exists({ slug })) { slug = `${baseSlug}-${counter}`; counter++; }
    ebook.slug = slug;

    try {
        await ebook.save();
        req.flash?.("success", "E-Book created successfully.");
        res.redirect("/ebooks");
    } catch (err) {
        if (err.code === 11000) {
            req.flash?.("error", "An e-book with this title already exists.");
            return res.redirect("/ebooks-manage/new");
        }
        throw err;
    }
};

export const renderEditEbook = async (req, res) => {
    const ebook = await Ebook.findById(req.params.id);
    if (!ebook) throw new ExpressError(404, "E-Book Not Found");
    const categories = await Category.find({}).select("name _id").sort({ name: 1 }).lean();
    res.render("pages/ebook/edit", { ebook, categories });
};

export const updateEbook = async (req, res) => {
    const { id } = req.params;
    const data = req.body.ebook;

    data.originalPrice = Number(data.originalPrice) || 0;
    data.discountPercentage = Number(data.discountPercentage) || 0;
    data.price = data.type === "Free"
        ? 0
        : Math.round(data.originalPrice - (data.originalPrice * data.discountPercentage / 100));
    data.validityDays = Number(data.validityDays) || 365;
    if (data.totalPages) data.totalPages = Number(data.totalPages);

    if (req.files?.coverImage?.[0]) {
        data.coverImage = { url: req.files.coverImage[0].path, publicId: req.files.coverImage[0].filename };
    } else {
        delete data.coverImage;
    }

    if (req.files?.ebookFile?.[0]) {
        data.file = { url: req.files.ebookFile[0].path, publicId: req.files.ebookFile[0].filename };
    } else {
        delete data.file;
    }

    const ebook = await Ebook.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!ebook) throw new ExpressError(404, "E-Book Not Found");

    req.flash?.("success", "E-Book updated successfully.");
    res.redirect(`/ebooks/${ebook.slug}`);
};

export const deleteEbook = async (req, res) => {
    const ebook = await Ebook.findByIdAndDelete(req.params.id);
    if (!ebook) throw new ExpressError(404, "E-Book Not Found");
    res.redirect("/ebooks");
};