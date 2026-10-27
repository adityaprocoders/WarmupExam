// utils/bulkProgress.js
// Bulk copy / bulk delete ka live progress (%) bhejne ke helpers.
//  - startNdjson / createProgress : server se browser ko line-by-line JSON stream
//  - countDeleteUnits / countCopyUnits : kitne items (section/folder/file/test) process honge — % ka total
//
// Count wahi traversal follow karta hai jo asli copy (copyHelpers.js) aur delete (deleteHelpers.js) karte hain.
import Folder from "../models/Folder.js";
import File from "../models/File.js";
import Test from "../models/Test.js";
import Section from "../models/Section.js";

/* ---------------- streaming ---------------- */

export function startNdjson(res) {
    res.status(200);
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    // no-transform: compression() middleware is response ko buffer / compress nahi karega
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof res.flushHeaders === "function") res.flushHeaders();

    return function send(obj) {
        try {
            if (res.writableEnded || res.destroyed) return;
            res.write(JSON.stringify(obj) + "\n");
            if (typeof res.flush === "function") res.flush();
        } catch (e) {
            /* browser chala gaya ho to bhi kaam server par chalta rahega */
        }
    };
}

export function createProgress(total, send) {
    let done = 0;
    let lastSent = 0;
    const emit = (force) => {
        const now = Date.now();
        if (force || now - lastSent >= 120) {
            lastSent = now;
            send({ type: "progress", done: Math.min(done, total), total });
        }
    };
    return {
        total,
        step(n = 1) { done += n; emit(false); },
        setAtLeast(n) { if (n > done) done = n; emit(false); },
        flush() { emit(true); }
    };
}

/* ---------------- delete: kitne units delete honge ---------------- */

export async function countDeleteUnits(type, id) {
    if (type === "test") return 1;

    if (type === "section") {
        // cascadeDeleteSection flat query (section field) se delete karta hai
        const [t, f, fi] = await Promise.all([
            Test.countDocuments({ section: id }),
            Folder.countDocuments({ section: id }),
            File.countDocuments({ section: id })
        ]);
        return 1 + t + f + fi;
    }

    if (type === "file") {
        let n = 1 + (await Test.countDocuments({ parentType: "file", parentId: id }));
        const folders = await Folder.find({ parentType: "file", parentId: id }).select("_id");
        for (const f of folders) n += await countDeleteUnits("folder", f._id);
        const files = await File.find({ parentType: "file", parentId: id }).select("_id");
        for (const f of files) n += await countDeleteUnits("file", f._id);
        return n;
    }

    if (type === "folder") {
        let n = 1 + (await Test.countDocuments({ parentType: "folder", parentId: id }));
        const files = await File.find({ parentType: "folder", parentId: id }).select("_id");
        for (const f of files) n += await countDeleteUnits("file", f._id);
        const folders = await Folder.find({ parentType: "folder", parentId: id }).select("_id");
        for (const f of folders) n += await countDeleteUnits("folder", f._id);
        return n;
    }

    return 0;
}

/* ---------------- copy: kitne units copy honge ---------------- */

export async function countCopyUnits(type, id, includeTests = true) {
    if (type === "test") return includeTests ? 1 : 0;

    if (type === "file") {
        // copyNode(file) sirf file + uske tests copy karta hai
        return 1 + (includeTests ? await Test.countDocuments({ parentType: "file", parentId: id }) : 0);
    }

    if (type === "folder") {
        let n = 1 + (includeTests ? await Test.countDocuments({ parentType: "folder", parentId: id }) : 0);
        const folders = await Folder.find({ parentType: "folder", parentId: id }).select("_id");
        for (const f of folders) n += await countCopyUnits("folder", f._id, includeTests);
        const files = await File.find({ parentType: "folder", parentId: id }).select("_id");
        for (const f of files) n += await countCopyUnits("file", f._id, includeTests);
        return n;
    }

    if (type === "section") {
        const sec = await Section.findById(id).select("listing");
        if (!sec) return 0;
        const root = { listing: sec.listing, section: sec._id, parentType: "section", parentId: null };
        let n = 1;
        if (includeTests) n += await Test.countDocuments(root);
        const folders = await Folder.find(root).select("_id");
        for (const f of folders) n += await countCopyUnits("folder", f._id, includeTests);
        const files = await File.find(root).select("_id");
        for (const f of files) n += await countCopyUnits("file", f._id, includeTests);
        return n;
    }

    return 0;
}