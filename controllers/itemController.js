import Folder from "../models/Folder.js";
import File from "../models/File.js";
import Test from "../models/Test.js";
import TestQuestion from "../models/TestQuestion.js";
import slugify from "slugify";
import { deleteFolderRecursive, deleteFileRecursive } from "../utils/deleteHelpers.js";
import Listing from "../models/listing.js";
import User from "../models/usersShema.js";

export const createItem = async (req, res) => {
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
    }

    res.status(200).json({ success: true, data: newItem });
};

export const getItem = async (req, res) => {
    const { type, id } = req.params;
    let item;

    if (type === "folder") item = await Folder.findById(id);
    else if (type === "file") item = await File.findById(id);
    else if (type === "test") item = await Test.findById(id);

    if (!item) return res.status(404).json({ success: false, message: "Item not found" });

       if (!checkEnrollment(req, item.listing)) {
        return res.status(403).json({ success: false, message: "Access denied" });
    }

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

    if (type === "folder") {
        await deleteFolderRecursive(id);
    } else if (type === "file") {
        await deleteFileRecursive(id);
    } else if (type === "test") {
        await TestQuestion.deleteMany({ test: id });
        await Test.findByIdAndDelete(id);
    }

    res.json({ success: true });
};