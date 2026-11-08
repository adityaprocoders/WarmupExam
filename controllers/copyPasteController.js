import Listing from "../models/listing.js";
import Section from "../models/Section.js";
import Folder from "../models/Folder.js";
import File from "../models/File.js";
import Test from "../models/Test.js";
import ExpressError from "../utils/ExpressError.js";
import { copyNode } from "../utils/copyHelpers.js";
import mongoose from "mongoose";
import { isMultiTier, getTierList, getTierConfig } from "../utils/tierHelper.js";

import TestQuestion from "../models/TestQuestion.js";
import { startNdjson, createProgress, countCopyUnits } from "../utils/bulkProgress.js";
import { randomCopyNode, countRandomUnits, normalizeRandomConfig } from "../utils/randomCopy.js";

export const searchSeries = async (req, res) => {
    const rawKeyword = req.query.keyword?.trim();
    // regex special chars escape (warna "(" jaisa keyword 500 deta tha)
    const keyword = rawKeyword ? rawKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : rawKeyword;

    const series = keyword
    ? await Listing.find({
        $or: [
            { title: { $regex: keyword, $options: "i" } },
            { exam: { $regex: keyword, $options: "i" } }
        ]
    }).select("title exam slug type language").limit(10)
    : await Listing.find().select("title exam slug type language").sort({ createdAt: -1 }).limit(20);

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
            return res.status(400).json({ success: false, message: "Source type or source ID is missing." });
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
        res.status(500).json({ success: false, message: "Unable to load available languages." });
    }
};

export const pasteItem = async (req, res) => {
    try {
        const {
            sourceType, sourceId, destListingId, destSectionId,
            destParentType, destParentId,
            selectedLanguage   // 👈 naya field — "All" ya specific language, ya undefined
        } = req.body;

        const okId = (v) => mongoose.isValidObjectId(v);
        if (!["section", "folder", "file", "test"].includes(sourceType) || !okId(sourceId) || !okId(destListingId)) {
            return res.status(400).json({ success: false, message: "Invalid copy request." });
        }
        if (sourceType !== "section") {
            if (!okId(destSectionId)) {
                return res.status(400).json({ success: false, message: "Please select a destination section." });
            }
            const destSec = await Section.findOne({ _id: destSectionId, listing: destListingId }).select("_id").lean();
            if (!destSec) {
                return res.status(400).json({ success: false, message: "Selected section is not part of the destination series." });
            }
        }
        if (destParentType === "file" && sourceType !== "test") {
            return res.status(400).json({ success: false, message: "File ke andar sirf test paste ho sakta hai." });
        }

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

          
        res.json({ success: true, data: newItem, fallbacks: fallbackLog });
    } catch (err) {
        console.error("Paste item error:", err);
        if (err.code === 11000) {
            return res.status(400).json({ success: false, message: "An item with this name already exists. Please use a different name." });
        }
        res.status(500).json({ success: false, message: "Unable to copy the item. Please try again." });
    }
};

export const bulkCopySections = async (req, res) => {
    const { sectionIds, destListingIds, selectedLanguage } = req.body;

    if (!Array.isArray(sectionIds) || sectionIds.length === 0) {
        return res.status(400).json({ success: false, message: "No section selected." });
    }
    if (!Array.isArray(destListingIds) || destListingIds.length === 0) {
        return res.status(400).json({ success: false, message: "No destination test series selected." });
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


export const bulkCopyItems = async (req, res) => {
    const {
        items, destListingIds, selectedLanguage,
        destSectionId, destParentType, destParentId,
        includeTests, randomConfig
    } = req.body;

    const wantsStream = req.body.stream === true;
    const withTests = includeTests !== false && includeTests !== "false";

    // ---- validation (stream shuru hone se PEHLE) ----
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: "No item selected." });
    }
    if (!Array.isArray(destListingIds) || destListingIds.length === 0) {
        return res.status(400).json({ success: false, message: "No destination test series selected." });
    }

    const itemsToCopy = withTests ? items : items.filter(it => it.type !== "test");
    if (itemsToCopy.length === 0) {
        return res.status(400).json({
            success: false,
            message: "Only tests were selected, so nothing is left to copy in 'without tests' mode."
        });
    }

    const hasNonSectionItem = itemsToCopy.some(it => it.type !== "section");
    if (hasNonSectionItem && !destSectionId) {
        return res.status(400).json({ success: false, message: "Please select a destination section." });
    }

        if (destParentType === "file" && itemsToCopy.some(it => it.type !== "test")) {
        return res.status(400).json({ success: false, message: "File ke andar sirf test paste ho sakta hai." });
    }

    // Random mode (sirf with-tests me)
    let randomCfg = null;
    if (withTests && randomConfig) {
        const r = normalizeRandomConfig(randomConfig);
        if (r.error) return res.status(400).json({ success: false, message: r.error });
        randomCfg = r.config;
    }

    const overrideLanguage = (selectedLanguage && selectedLanguage !== "All") ? selectedLanguage : null;

    // ---- live progress ----
    let send = null;
    let progress = null;
    const cumulative = [];
    if (wantsStream) {
        send = startNdjson(res);
        let total = 0;
        for (const item of itemsToCopy) {
            try {
                const units = randomCfg
                    ? await countRandomUnits(item.type, item.id, randomCfg)
                    : await countCopyUnits(item.type, item.id, withTests);
                total += units * destListingIds.length;
            } catch (e) { /* count fail => % thoda kam accurate */ }
            cumulative.push(total);
        }
        progress = createProgress(total, send);
        send({ type: "start", total });
    }
    const onProgress = progress ? (n) => progress.step(n) : null;

    let copied = 0;
    let failed = 0;
    const fallbackLog = [];
    const notes = [];

    for (let i = 0; i < itemsToCopy.length; i++) {
        const item = itemsToCopy[i];
        for (const listingId of destListingIds) {
            try {
                let result;
                if (randomCfg) {
                    result = await randomCopyNode(
                        item.type, item.id, listingId,
                        item.type === "section" ? null : destSectionId,
                        destParentType || "section",
                        destParentId || null,
                        randomCfg,
                        { notes, onProgress }
                    );
                } else {
                    result = await copyNode(
                        item.type, item.id, listingId,
                        item.type === "section" ? null : destSectionId,
                        destParentType || "section",
                        destParentId || null,
                        overrideLanguage, "", fallbackLog,
                        withTests,
                        onProgress
                    );
                }
                if (result === null) failed++; else copied++;
            } catch (err) {
                console.error("Bulk copy item error:", err);
                failed++;
            }
        }
        if (progress) progress.setAtLeast(cumulative[i]);
    }

    if (wantsStream) {
        progress.setAtLeast(progress.total);
        progress.flush();
        send({ type: "done", success: true, copied, failed, fallbacks: fallbackLog, notes });
        return res.end();
    }

    res.json({ success: true, copied, failed, fallbacks: fallbackLog, notes });
};


export const getRandomSubjects = async (req, res) => {
    try {
        const { items, destListingIds } = req.body || {};
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: "No item selected." });
        }
        const norm = (s) => String(s ?? "").trim().toLowerCase();

        let testIds = [];
        for (const it of items) {
            if (!it || !it.type || !it.id) continue;
            testIds = testIds.concat(await collectTestIdsUnderNode(it.type, it.id));
        }

        // source ka subject koi matter nahi karta: sirf ye dekhna hai ki file ke tests me questions hain ya nahi
        const langSet = new Set();
        let totalQuestions = 0;
        if (testIds.length > 0) {
            const fileTests = await Test.find({ _id: { $in: testIds }, parentType: "file" }).select("_id languages");
            fileTests.forEach(t => (t.languages || []).forEach(l => langSet.add(l)));
            const ids = fileTests.map(t => t._id);
            if (ids.length > 0) {
                const uniq = await TestQuestion.distinct("question", { test: { $in: ids } });
                totalQuestions = uniq.length;
            }
        }
        const languages = [...langSet];

        if (totalQuestions === 0) {
            return res.status(400).json({
                success: false,
                message: "Selected folder/file ke andar questions wale tests nahi mile. Random ke liye file ke andar tests chahiye."
            });
        }

        const destIds = Array.isArray(destListingIds) ? destListingIds.filter(Boolean) : [];

        // destination abhi chuna nahi gaya (sirf shuruaati check)
        if (destIds.length === 0) {
            return res.json({ success: true, subjects: [{ name: "All", available: totalQuestions }], languages });
        }

                // subjects sirf DESTINATION series ke marks se (multi-tier ho to tier-wise)
        const listings = await Listing.find({ _id: { $in: destIds } })
            .select("title marks tiers examStructure").lean();
        if (listings.length === 0) {
            return res.status(400).json({ success: false, message: "Destination series nahi mili." });
        }

        const namesOf = (marks) => {
            const m = new Map();
            (marks || []).forEach((x) => {
                const n = String((x && x.subject) ?? "").trim();
                if (n) m.set(norm(n), n);
            });
            return m;
        };
        const commonSubjects = (maps) => {
            let common = maps[0];
            for (const m of maps.slice(1)) common = new Map([...common].filter(([k]) => m.has(k)));
            return [...common.values()]
                .map((name) => ({ name, available: totalQuestions }))
                .sort((a, b) => a.name.localeCompare(b.name));
        };

        const multiCount = listings.filter(isMultiTier).length;
        if (multiCount !== 0 && multiCount !== listings.length) {
            return res.status(400).json({
                success: false,
                message: "Single-tier aur multi-tier series ek saath mat chuno. Alag-alag copy karo."
            });
        }

        let tiers = [];
        let subjects = [];

        if (multiCount === 0) {
            const maps = listings.map((l) => namesOf(getTierConfig(l, null).marks));
            if (maps.some((m) => m.size === 0)) {
                return res.status(400).json({
                    success: false,
                    message: "Destination series me subject-wise marks set nahi hain. Pehle series me subjects/marks set karo."
                });
            }
            subjects = commonSubjects(maps);
            if (subjects.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Chuni hui series me koi common subject nahi hai. Ek-ek series me alag se copy karo."
                });
            }
        } else {
            let keys = getTierList(listings[0]).map((t) => t.key);
            for (const l of listings.slice(1)) {
                const k = new Set(getTierList(l).map((t) => t.key));
                keys = keys.filter((x) => k.has(x));
            }
            if (keys.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Chuni hui series me common tier/part nahi hai. Ek-ek series me alag se copy karo."
                });
            }
            for (const key of keys) {
                const maps = listings.map((l) => namesOf(getTierConfig(l, key).marks));
                const subs = maps.some((m) => m.size === 0) ? [] : commonSubjects(maps);
                const name = getTierList(listings[0]).find((t) => t.key === key)?.name || key;
                tiers.push({ key, name, subjects: subs });
            }
            const firstWithSubjects = tiers.find((t) => t.subjects.length > 0);
            if (!firstWithSubjects) {
                return res.status(400).json({
                    success: false,
                    message: "Kisi bhi tier me subject-wise marks set nahi hain."
                });
            }
            subjects = firstWithSubjects.subjects;
        }

        res.json({ success: true, subjects, tiers, languages });
 

    } catch (err) {
        console.error("Get random subjects error:", err);
        res.status(500).json({ success: false, message: "Unable to load subjects." });
    }
};