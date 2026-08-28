import Folder from "../models/Folder.js";
import File from "../models/File.js";
import Test from "../models/Test.js";
import TestQuestion from "../models/TestQuestion.js";
import Question from "../models/Question.js";
import Attempt from "../models/TestAttempt.js";
import AttemptSession from "../models/AttemptSession.js";
import Section from "../models/Section.js";
import User from "../models/usersShema.js";

/**
 * Ek Test ko poori tarah delete karta hai:
 * - TestQuestion mappings
 * - Attempt + AttemptSession (sab users ke)
 * - Test doc khud
 * - Question — SIRF wo jo ab kisi aur test me linked nahi (orphan check, dedup ke wajah se zaroori)
 *
 * Yeh ek hi function hai jo Test se related SAB kuch handle karta hai.
 * Folder/File/Section/Listing cascade — sab isi function ko reuse karte hain,
 * taaki logic kahin duplicate na ho aur naya related model (jaise kal koi aur) miss na ho.
 */
export async function cascadeDeleteTest(testId) {
    const mappings = await TestQuestion.find({ test: testId }).select("question");
    const questionIds = [...new Set(mappings.map(m => m.question.toString()))];

    await TestQuestion.deleteMany({ test: testId });
    await Attempt.deleteMany({ test: testId });
    await AttemptSession.deleteMany({ test: testId });
    await Test.findByIdAndDelete(testId);

    // Orphan question cleanup — sirf wahi Question delete jo ab kahin aur reference nahi ho raha
    for (const qId of questionIds) {
        const stillUsed = await TestQuestion.exists({ question: qId });
        if (!stillUsed) {
            await Question.findByIdAndDelete(qId);
        }
    }
}

/**
 * Folder ke andar jo bhi ho (sub-folders, sub-files, tests — kisi bhi depth tak recursively) —
 * sabko delete karta hai, fir folder khud delete hota hai.
 */
export async function cascadeDeleteFolder(folderId) {
    const childTests = await Test.find({ parentType: "folder", parentId: folderId }).select("_id");
    for (const t of childTests) {
        await cascadeDeleteTest(t._id);
    }

    const childFiles = await File.find({ parentType: "folder", parentId: folderId }).select("_id");
    for (const f of childFiles) {
        await cascadeDeleteFile(f._id);
    }

    const childFolders = await Folder.find({ parentType: "folder", parentId: folderId }).select("_id");
    for (const sub of childFolders) {
        await cascadeDeleteFolder(sub._id);
    }

    await Folder.findByIdAndDelete(folderId);
}

/**
 * File ke andar jo bhi ho (sub-folders, sub-files, tests — kisi bhi depth tak recursively) —
 * sabko delete karta hai, fir file khud delete hoti hai.
 */
export async function cascadeDeleteFile(fileId) {
    const childTests = await Test.find({ parentType: "file", parentId: fileId }).select("_id");
    for (const t of childTests) {
        await cascadeDeleteTest(t._id);
    }

    const childFolders = await Folder.find({ parentType: "file", parentId: fileId }).select("_id");
    for (const f of childFolders) {
        await cascadeDeleteFolder(f._id);
    }

    const childFiles = await File.find({ parentType: "file", parentId: fileId }).select("_id");
    for (const sub of childFiles) {
        await cascadeDeleteFile(sub._id);
    }

    await File.findByIdAndDelete(fileId);
}

/**
 * Section ke andar jo bhi ho — Test/Folder/File — sab `section` field se flat query karke
 * (kisi bhi depth ke) delete karta hai. Recursive parentId traversal ki zaroorat nahi
 * kyunki har Test/File/Folder ka `section` field top-level Section ki id hi rakhta hai,
 * chahe wo kitni bhi depth par nested ho.
 */
export async function cascadeDeleteSection(sectionId) {
    // 1. Section ke andar ke SAARE Test (kisi bhi depth par)
    const sectionTests = await Test.find({ section: sectionId }).select("_id");
    for (const t of sectionTests) {
        await cascadeDeleteTest(t._id);
    }

    // 2. Section ke andar ke SAARE Folder aur File (kisi bhi depth par) — flat delete
    //    (inke andar ke tests already step 1 me clear ho chuke, kyunki section field
    //    depth-independent hai)
    await Folder.deleteMany({ section: sectionId });
    await File.deleteMany({ section: sectionId });

    // 3. Section khud
    await Section.findByIdAndDelete(sectionId);
}

/**
 * Poori Listing delete — uske saare Sections (jo apna poora cascade karenge) +
 * safety-net cleanup (agar koi orphan Folder/File/Test bina section ke reh gaya ho) +
 * User enrollments cleanup.
 */
export async function cascadeDeleteListing(listingId) {
    const sections = await Section.find({ listing: listingId }).select("_id");
    for (const sec of sections) {
        await cascadeDeleteSection(sec._id);
    }

    // Safety net — agar koi Test/Folder/File section ke bina hi listing se directly linked ho
    const orphanTests = await Test.find({ listing: listingId }).select("_id");
    for (const t of orphanTests) {
        await cascadeDeleteTest(t._id);
    }
    await Folder.deleteMany({ listing: listingId });
    await File.deleteMany({ listing: listingId });

    // User enrollments cleanup
    await User.updateMany(
        { "enrolledListings.listing": listingId },
        { $pull: { enrolledListings: { listing: listingId } } }
    );
    await User.updateMany(
        { lastAccessedBatch: listingId },
        { $set: { lastAccessedBatch: null } }
    );
}