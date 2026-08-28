import Folder from "../models/Folder.js";
import File from "../models/File.js";
import Test from "../models/Test.js";
import TestQuestion from "../models/TestQuestion.js";
import slugify from "slugify";
import { cascadeDeleteFolder, cascadeDeleteFile, cascadeDeleteTest } from "../utils/deleteHelpers.js";
import Listing from "../models/listing.js";
import User from "../models/usersShema.js";

export const createItem = async (req, res) => {
    try {
        const { type, title, icon, listingId, sectionId, parentType, parentId, questions, marks, minutes } = req.body;
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
            return res.status(400).json({ success: false, message: "Is naam ka item is jagah pehle se maujood hai. Alag naam try karo." });
        }
        console.error("Create item error:", err);
        res.status(500).json({ success: false, message: err.message || "Item create karte waqt error aaya" });
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

    if (type === "folder") {
        const data = { title, icon: icon ? icon.trim() : "" };
        updatedItem = await Folder.findByIdAndUpdate(id, data, { new: true });

    } else if (type === "file") {
        const data = { title };
        if (icon && icon.trim() !== "") data.icon = icon.trim();
        updatedItem = await File.findByIdAndUpdate(id, data, { new: true });

    } else if (type === "test") {
        updatedItem = await Test.findByIdAndUpdate(id, {
            title, totalQuestions: questions, totalMarks: marks, duration: minutes
        }, { new: true });
    }

    res.json({ success: true, data: updatedItem });
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
        res.status(500).json({ success: false, message: err.message || "Delete karte waqt error aaya" });
    }
};