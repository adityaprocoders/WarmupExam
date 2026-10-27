import Folder from "../models/Folder.js";
import File from "../models/File.js";
import Test from "../models/Test.js";
import TestQuestion from "../models/TestQuestion.js";
import slugify from "slugify";
import { cascadeDeleteSection, cascadeDeleteFolder, cascadeDeleteFile, cascadeDeleteTest } from "../utils/deleteHelpers.js";
import Listing from "../models/listing.js";
import User from "../models/usersShema.js";
import { startNdjson, createProgress, countDeleteUnits } from "../utils/bulkProgress.js";


export const createItem = async (req, res) => {
    try {
        const { type, title, icon, listingId, sectionId, parentType, parentId, questions, marks, minutes } = req.body;
                if (!title || !String(title).trim()) {
            return res.status(400).json({ success: false, message: "Title is required" });
        }
        const slug = slugify(title, { lower: true, strict: true });

        let newItem;

        if (type === 'folder') {
            const folderData = { title, section: sectionId, listing: listingId, slug, parentType, parentId: parentId || null };
            if (icon && icon.trim() !== "") folderData.icon = icon.trim();
            newItem = await Folder.create(folderData);

        } else if (type === 'file') {
            const fileData = { title, section: sectionId, listing: listingId, slug, parentType, parentId: parentId || null };
            if (icon && icon.trim() !== "") fileData.icon = icon.trim();
            newItem = await File.create(fileData);

        } else if (type === 'test') {
            newItem = await Test.create({
                title, section: sectionId, listing: listingId, parentType, parentId: parentId || null,
                totalQuestions: questions, totalMarks: marks, duration: minutes
            });
        } else {
            return res.status(400).json({ success: false, message: "Invalid type" });
        }

        res.status(200).json({ success: true, data: newItem });

    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ success: false, message: "An item with this name already exists here. Please choose a different name." });
        }
        console.error("Create item error:", err);
        res.status(500).json({ success: false, message: err.message || "Unable to create the item. Please try again." });
    }
};

export const getItem = async (req, res) => {
    const { type, id } = req.params;
    let item;

    if (type === "folder") item = await Folder.findById(id);
    else if (type === "file") item = await File.findById(id);
    else if (type === "test") item = await Test.findById(id);

    if (!item) return res.status(404).json({ success: false, message: "Item not found" });

    res.json({ success: true, data: item });
};


export const updateItem = async (req, res) => {
    const { id } = req.params;
    const { type, title, icon, questions, marks, minutes } = req.body;

    let updatedItem;

    try {
        if (type === "folder") {
            const data = { title, icon: icon ? icon.trim() : "" };
            if (title) data.slug = slugify(title, { lower: true, strict: true });
            updatedItem = await Folder.findByIdAndUpdate(id, data, { new: true });

        } else if (type === "file") {
            const data = { title };
            if (title) data.slug = slugify(title, { lower: true, strict: true });
            if (icon && icon.trim() !== "") data.icon = icon.trim();
            updatedItem = await File.findByIdAndUpdate(id, data, { new: true });

        } else if (type === "test") {
            updatedItem = await Test.findByIdAndUpdate(id, {
                title, totalQuestions: questions, totalMarks: marks, duration: minutes
            }, { new: true });
        }

        res.json({ success: true, data: updatedItem });

    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ success: false, message: "An item with this name already exists here. Please choose a different name." });
        }
        console.error("Update item error:", err);
        res.status(500).json({ success: false, message: err.message || "Unable to update the item. Please try again." });
    }
};

export const deleteItem = async (req, res) => {
    const { id } = req.params;
    const { type } = req.body;

    if (!["folder", "file", "test"].includes(type)) {
        return res.status(400).json({ success: false, message: "Invalid type" });
    }

    try {
        if (type === "folder") {
            await cascadeDeleteFolder(id);
        } else if (type === "file") {
            await cascadeDeleteFile(id);
        } else if (type === "test") {
            await cascadeDeleteTest(id);
        }
        res.json({ success: true });
    } catch (err) {
        console.error("Delete error:", err);
        res.status(500).json({ success: false, message: err.message || "Unable to delete the item. Please try again." });
    }
};



/**
 * Bulk delete: selected Section / Folder / File / Test.
 * Har item par WAHI cascade functions chalte hain jo manual delete me chalte hain,
 * isliye andar ka sab kuch pura delete hota hai.
 * Parent aur uske andar ka child dono select ho to bhi safe hai.
 * stream:true => live progress (%) line-by-line bhejte hain, warna purana single JSON response.
 */
export const bulkDeleteItems = async (req, res) => {
    const { items } = req.body || {};
    const wantsStream = !!req.body && req.body.stream === true;

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: "No item selected." });
    }
    if (items.length > 300) {
        return res.status(400).json({ success: false, message: "Too many items selected at once (max 300)." });
    }

    const handlers = {
        section: cascadeDeleteSection,
        folder: cascadeDeleteFolder,
        file: cascadeDeleteFile,
        test: cascadeDeleteTest
    };
    const priority = { section: 0, folder: 1, file: 2, test: 3 };

    const seen = new Set();
    const clean = [];
    for (const it of items) {
        const type = it && it.type;
        const id = it && String(it.id || "");
        if (!handlers[type] || !/^[0-9a-fA-F]{24}$/.test(id)) {
            return res.status(400).json({ success: false, message: "Invalid item in selection." });
        }
        const key = type + ":" + id;
        if (seen.has(key)) continue;
        seen.add(key);
        clean.push({ type, id });
    }
    clean.sort((a, b) => priority[a.type] - priority[b.type]);

    // ---- live progress setup (sirf stream mode me) ----
    let send = null;
    let progress = null;
    const cumulative = [];
    if (wantsStream) {
        send = startNdjson(res);
        let total = 0;
        for (const it of clean) {
            try { total += await countDeleteUnits(it.type, it.id); } catch (e) { /* count fail => % thoda kam accurate */ }
            cumulative.push(total);
        }
        progress = createProgress(total, send);
        send({ type: "start", total });
    }
    const onUnit = progress ? (n) => progress.step(n) : null;

    let deleted = 0;
    let failed = 0;
    for (let i = 0; i < clean.length; i++) {
        const it = clean[i];
        try {
            await handlers[it.type](it.id, onUnit);
            deleted++;
        } catch (err) {
            console.error("Bulk delete error:", it.type, it.id, err);
            failed++;
        }
        // parent ke andar ka child pehle hi delete ho chuka ho (overlap) to bhi % sahi jaye
        if (progress) progress.setAtLeast(cumulative[i]);
    }

    if (wantsStream) {
        progress.setAtLeast(progress.total);
        progress.flush();
        send({ type: "done", success: failed === 0, deleted, failed });
        return res.end();
    }

    res.json({ success: failed === 0, deleted, failed });
};
 