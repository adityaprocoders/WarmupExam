import Listing from "../models/listing.js";
import Section from "../models/section.js";
import Folder from "../models/Folder.js";
import File from "../models/File.js";
import ExpressError from "../utils/ExpressError.js";
import { copyNode } from "../utils/copyHelpers.js";

export const searchSeries = async (req, res) => {
    const keyword = req.query.keyword?.trim();
    if (!keyword) return res.json([]);

    const series = await Listing.find({
        $or: [
            { title: { $regex: keyword, $options: "i" } },
            { exam: { $regex: keyword, $options: "i" } }
        ]
    }).select("title exam slug").limit(10);

    res.json(series);
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

export const pasteItem = async (req, res) => {
    const { sourceType, sourceId, destListingId, destSectionId, destParentType, destParentId } = req.body;

    const newItem = await copyNode(
        sourceType, sourceId, destListingId,
        sourceType === "section" ? null : destSectionId,
        destParentType || "section", destParentId || null
    );

    res.json({ success: true, data: newItem });
};