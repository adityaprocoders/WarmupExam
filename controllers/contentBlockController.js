import ContentBlock from "../models/ContentBlock.js";
import Listing from "../models/listing.js";
import ExpressError from "../utils/ExpressError.js";
import { sanitizeContent } from "../utils/sanitizeContent.js";
  
// Existing block edit karo
export const updateBlock = async (req, res) => {
    const { id } = req.params;
    const { listingId } = req.body;
    const cleanHtml = sanitizeContent(req.body.html);

    const block = await ContentBlock.findByIdAndUpdate(
        id,
        { name: req.body.name, html: cleanHtml },
        { new: true, runValidators: true }
    );

    if (!block) throw new ExpressError(404, "Content Block Not Found");

    req.flash("success", "Content block updated");
    res.redirect(listingId ? `/test/${listingId}` : "/owner/content-library");
};

// Block delete karo (permanently, sab listings se bhi)
export const deleteBlock = async (req, res) => {
    const { id } = req.params;
    const { listingId } = req.body;

    await Listing.updateMany(
        { contentBlocks: id },
        { $pull: { contentBlocks: id } }
    );
    await ContentBlock.findByIdAndDelete(id);

    req.flash("success", "Content block deleted permanently");
    res.redirect(listingId ? `/test/${listingId}` : "/owner/content-library");
};

 

// ---------- ATTACH BLOCKS TO A LISTING ----------

// Listing ke liye "select blocks" page (checkbox list)
export const renderAttachPage = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id).populate("contentBlocks");
    if (!listing) throw new ExpressError(404, "Test Series Not Found");

    const allBlocks = await ContentBlock.find().sort({ name: 1 });

    res.render("owner/attach-content", { listing, allBlocks });
};

// Selected block IDs ko listing me save karo
export const attachBlocks = async (req, res) => {
    const { id } = req.params;
    let { contentBlocks } = req.body;

    // Single checkbox select hone par string aata hai, isliye array me convert karo
    if (!contentBlocks) contentBlocks = [];
    if (!Array.isArray(contentBlocks)) contentBlocks = [contentBlocks];

    const listing = await Listing.findByIdAndUpdate(
        id,
        { contentBlocks },
        { new: true }
    );

    if (!listing) throw new ExpressError(404, "Test Series Not Found");

    req.flash("success", "Content blocks attached to this test series");
    res.redirect(`/tests/${id}/attach-content`);
};


// ---------- NEW: Create a block AND attach it to a listing in one go ----------
export const createAndAttachBlock = async (req, res) => {
    const { id } = req.params;
    const cleanHtml = sanitizeContent(req.body.html);

    const block = await ContentBlock.create({
        name: req.body.name,
        html: cleanHtml
    });

    const listing = await Listing.findById(id);
    if (!listing) throw new ExpressError(404, "Test Series Not Found");

    listing.contentBlocks.push(block._id);
    await listing.save();

    req.flash("success", "Block created and attached");
    res.redirect(`/test/${id}`); // ✅ fix: /tests/${id}/show ki jagah /test/${id}
};

// ---------- NEW: Detach a block from ONE listing only (block library me rahega) ----------
export const detachBlock = async (req, res) => {
    const { id, blockId } = req.params;

    const listing = await Listing.findByIdAndUpdate(
        id,
        { $pull: { contentBlocks: blockId } },
        { new: true }
    );

    if (!listing) throw new ExpressError(404, "Test Series Not Found");

    req.flash("success", "Block removed from this test series");
    res.redirect(`/test/${id}`); // ✅ fix
};


// ---------- NEW: Copy a block to multiple listings (by exam category or individual) ----------
export const copyBlockToTargets = async (req, res) => {
    const { id } = req.params; // block id
    let { examNames, listingIds, sourceListingId } = req.body;

    // Single value aane par bhi array bana do (form se single checkbox string bhej sakta hai)
    if (!examNames) examNames = [];
    if (!Array.isArray(examNames)) examNames = [examNames];

    if (!listingIds) listingIds = [];
    if (!Array.isArray(listingIds)) listingIds = [listingIds];

    let targetIds = [...listingIds];

    // Exam category select hui hai to us exam ke saare listings ke IDs bhi le lo
    if (examNames.length > 0) {
        const examListings = await Listing.find({ exam: { $in: examNames } }).select("_id");
        targetIds.push(...examListings.map(l => String(l._id)));
    }

    // Duplicates hatao
    targetIds = [...new Set(targetIds.map(String))];

    if (targetIds.length === 0) {
        req.flash("error", "Koi test series select nahi ki gayi");
        return res.redirect(sourceListingId ? `/test/${sourceListingId}` : "/owner/content-library");
    }

    // Jahan pehle se attached hai wahan kuch nahi hoga (addToSet), jahan nahi hai wahan add ho jayega
    await Listing.updateMany(
        { _id: { $in: targetIds } },
        { $addToSet: { contentBlocks: id } }
    );

    req.flash("success", `Block copied to ${targetIds.length} test series`);
    res.redirect(sourceListingId ? `/test/${sourceListingId}` : "/owner/content-library");
};