import Category from "../models/Category.js";
import Listing from "../models/listing.js";

let cachedListingId = null;

// Ek hi baar bante hain — baad me cache se milte hain
export async function getOrCreateAIListing() {
    if (cachedListingId) return cachedListingId;

    let category = await Category.findOne({ slug: "ai-generated-system" });
    if (!category) {
        category = await Category.create({
            name: "AI Generated (System)",
            slug: "ai-generated-system",
            description: "Internal system category used to store AI-generated custom paper questions. Not shown publicly.",
            icon: "sparkles",
        });
    }

    let listing = await Listing.findOne({ slug: "ai-generated-system-listing" });
    if (!listing) {
        listing = await Listing.create({
            title: "AI Generated Questions (System)",
            shortDescription: "Internal listing to store AI-generated custom paper questions.",
            originalPrice: 0,
            exam: "AI-Generated",
            category: category._id,
            slug: "ai-generated-system-listing",
            visibility: "private", // 👈 public exam list / search me kabhi nahi dikhega
        });
    }

    cachedListingId = listing._id;
    return listing._id;
}