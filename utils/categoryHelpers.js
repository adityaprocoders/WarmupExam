import Category from "../models/Category.js";
import Listing from "../models/listing.js";

export const AI_SYSTEM_CATEGORY_SLUG = "ai-generated-system";

export async function getCategoriesWithExamCount({ isOwner = false } = {}) {
    const catFilter = isOwner ? {} : { slug: { $ne: AI_SYSTEM_CATEGORY_SLUG } };
    const categories = await Category.find(catFilter).sort({ createdAt: -1 }).lean();

    const match = {
        category: { $in: categories.map((c) => c._id) },
        exam: { $nin: [null, ""] },
    };
    if (!isOwner) match.visibility = "public";

    const rows = await Listing.aggregate([
        { $match: match },
        {
            $group: {
                _id: {
                    category: "$category",
                    exam: { $toLower: { $trim: { input: "$exam" } } },
                },
            },
        },
        { $match: { "_id.exam": { $ne: "" } } },
        { $group: { _id: "$_id.category", count: { $sum: 1 } } },
    ]);

    const countMap = {};
    rows.forEach((r) => { countMap[String(r._id)] = r.count; });
    categories.forEach((c) => { c.examCount = countMap[String(c._id)] || 0; });

    return categories;
}