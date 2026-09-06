import Listing from "../models/listing.js";
import Section from "../models/Section.js";
import Folder from "../models/Folder.js";
import File from "../models/File.js";
import Test from "../models/Test.js";
import ExpressError from "../utils/ExpressError.js";
import { copyNode } from "../utils/copyHelpers.js";

export const searchSeries = async (req, res) => {
    const keyword = req.query.keyword?.trim();

    const series = keyword
        ? await Listing.find({
            $or: [
                { title: { $regex: keyword, $options: "i" } },
                { exam: { $regex: keyword, $options: "i" } }
            ]
        }).select("title exam slug").limit(10)
        : await Listing.find().select("title exam slug").sort({ createdAt: -1 }).limit(20);

    // 👇 NAYA — har listing ke andar jo bhi Tests hain, unki unique languages nikaalo
    const listingIds = series.map(s => s._id);
    const tests = await Test.find({ listing: { $in: listingIds } }).select("listing languages");

    const langMap = {};
    tests.forEach(t => {
        const key = t.listing.toString();
        if (!langMap[key]) langMap[key] = new Set();
        (t.languages || []).forEach(l => langMap[key].add(l));
    });

    const result = series.map(s => ({
        ...s.toObject(),
        languages: langMap[s._id.toString()] ? Array.from(langMap[s._id.toString()]) : []
    }));

    res.json(result);
};

export const getSeriesTree = async (req, res) => {
    const { slug } = req.params;
    const { section, parentType, parentId } = req.query;

    const listing = await Listing.findOne({ slug });
    if (!listing) throw new ExpressError(404, "Series Not Found");

    if (!section) {
        const sections = await Section.find({ listing: listing._id }).sort({ createdAt: 1 });
        return res.json({ listing, sections });
    }

    const filter = {
        listing: listing._id, section,
        parentType: parentType || "section",
        parentId: parentId || null
    };

    const folders = await Folder.find(filter).sort({ createdAt: 1 });
    const files = await File.find(filter).sort({ createdAt: 1 });

    res.json({ folders, files });
};

// 👇 NAYA: Section/Folder/File/Test ke andar jitne bhi Tests hain,
// unki saari unique languages nikaal ke bhejta hai (popup ke liye)
async function collectTestIdsUnderNode(sourceType, sourceId) {
    if (sourceType === "test") return [sourceId];

    if (sourceType === "file") {
        const tests = await Test.find({ parentType: "file", parentId: sourceId }).select("_id");
        return tests.map(t => t._id);
    }

    if (sourceType === "folder") {
        let ids = [];
        const directTests = await Test.find({ parentType: "folder", parentId: sourceId }).select("_id");
        ids = ids.concat(directTests.map(t => t._id));

        const childFolders = await Folder.find({ parentType: "folder", parentId: sourceId }).select("_id");
        for (const f of childFolders) {
            ids = ids.concat(await collectTestIdsUnderNode("folder", f._id));
        }

        const childFiles = await File.find({ parentType: "folder", parentId: sourceId }).select("_id");
        for (const f of childFiles) {
            ids = ids.concat(await collectTestIdsUnderNode("file", f._id));
        }

        return ids;
    }

    if (sourceType === "section") {
        let ids = [];
        const section = await Section.findById(sourceId);
        if (!section) return ids;

        const rootFolders = await Folder.find({
            listing: section.listing, section: section._id, parentType: "section", parentId: null
        }).select("_id");
        for (const f of rootFolders) {
            ids = ids.concat(await collectTestIdsUnderNode("folder", f._id));
        }

        const rootFiles = await File.find({
            listing: section.listing, section: section._id, parentType: "section", parentId: null
        }).select("_id");
        for (const f of rootFiles) {
            ids = ids.concat(await collectTestIdsUnderNode("file", f._id));
        }

        const rootTests = await Test.find({
            listing: section.listing, section: section._id, parentType: "section", parentId: null
        }).select("_id");
        ids = ids.concat(rootTests.map(t => t._id));

        return ids;
    }

    return [];
}

export const getAvailableLanguages = async (req, res) => {
    try {
        const { sourceType, sourceId } = req.query;

        if (!sourceType || !sourceId) {
            return res.status(400).json({ success: false, message: "sourceType/sourceId missing hai" });
        }

        const testIds = await collectTestIdsUnderNode(sourceType, sourceId);

        if (testIds.length === 0) {
            // koi test nahi mila andar — language option dikhane ki zaroorat nahi
            return res.json({ success: true, languages: [] });
        }

        const tests = await Test.find({ _id: { $in: testIds } }).select("languages");

        const langSet = new Set();
        tests.forEach(t => (t.languages || []).forEach(l => langSet.add(l)));

        res.json({ success: true, languages: Array.from(langSet) }); // frontend "All" khud add karega
    } catch (err) {
        console.error("Get available languages error:", err);
        res.status(500).json({ success: false, message: "Languages fetch karte waqt error aaya" });
    }
};

export const pasteItem = async (req, res) => {
    try {
        const {
            sourceType, sourceId, destListingId, destSectionId,
            destParentType, destParentId,
            selectedLanguage   // 👈 naya field — "All" ya specific language, ya undefined
        } = req.body;

        // "All" ya khaali/undefined ka matlab: original test ka showLanguage hi rahega
        const overrideLanguage = (selectedLanguage && selectedLanguage !== "All") ? selectedLanguage : null;

        const fallbackLog = [];   // 👈 NAYA

        const newItem = await copyNode(
            sourceType, sourceId, destListingId,
            sourceType === "section" ? null : destSectionId,
            destParentType || "section", destParentId || null,
            overrideLanguage,
            "", fallbackLog
        );

         const destListing = await Listing.findById(destListingId).select("slug");

        res.json({ success: true, data: newItem, fallbacks: fallbackLog });
    } catch (err) {
        console.error("Paste item error:", err);
        if (err.code === 11000) {
            return res.status(400).json({ success: false, message: "Naam clash ho gaya, dobara try karo." });
        }
        res.status(500).json({ success: false, message: err.message || "Copy karte waqt error aaya" });
    }
};

export const bulkCopySections = async (req, res) => {
    const { sectionIds, destListingIds, selectedLanguage } = req.body;

    if (!Array.isArray(sectionIds) || sectionIds.length === 0) {
        return res.status(400).json({ success: false, message: "Koi section select nahi kiya" });
    }
    if (!Array.isArray(destListingIds) || destListingIds.length === 0) {
        return res.status(400).json({ success: false, message: "Koi destination series select nahi ki" });
    }

    const overrideLanguage = (selectedLanguage && selectedLanguage !== "All") ? selectedLanguage : null;

    let copied = 0;
    let failed = 0;
    const fallbackLog = [];   // 👈 NAYA — jitne bhi "all" pe fallback huye, sab yahan collect honge

    for (const sectionId of sectionIds) {
        for (const listingId of destListingIds) {
            try {
                await copyNode("section", sectionId, listingId, null, "section", null, overrideLanguage, "", fallbackLog);
                copied++;
            } catch (err) {
                console.error("Bulk copy error:", err);
                failed++;
            }
        }
    }

    res.json({ success: true, copied, failed, fallbacks: fallbackLog });
};