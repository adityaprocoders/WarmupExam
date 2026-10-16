import Listing from "../models/listing.js";
import Question from "../models/Question.js";
import Test from "../models/Test.js";
import TestQuestion from "../models/TestQuestion.js";
import Section from "../models/Section.js";
import mongoose from "mongoose";
import ExpressError from "../utils/ExpressError.js";
import Category from "../models/Category.js";
import Folder from "../models/Folder.js";
import File from "../models/File.js";


function getMarksForSubject(subjectsConfig, subjectName) {
    let found = subjectsConfig.find(s => s.subject === subjectName);
    if (!found && subjectsConfig.length > 0) found = subjectsConfig[0];
    return found
        ? { positiveMarks: found.positiveMarks, negativeMarks: found.negativeMarks }
        : { positiveMarks: 0, negativeMarks: 0 };
}

/* ============================================================
   NAYA CORE HELPER: is listing ke andar (aur agar sectionIds
   diye hain to un section(s) ke andar) jitne bhi Tests bane hain,
   unki TestQuestion entries hi asli/authoritative source hain —
   Question.listing field IGNORE, kyunki wo sirf "first created
   where" batata hai, shared/reused questions ko miss kar deta hai.
============================================================ */
async function getTestIdsForListing(listingId, sectionIds) {
    if (!mongoose.Types.ObjectId.isValid(String(listingId))) return [];

    const match = { listing: new mongoose.Types.ObjectId(String(listingId)) };

    if (Array.isArray(sectionIds) && sectionIds.length > 0) {
        const validSectionIds = sectionIds
            .map(String)
            .filter(id => mongoose.Types.ObjectId.isValid(id));
        match.section = { $in: validSectionIds };
    }

    const tests = await Test.find(match).select("_id");
    return tests.map(t => t._id);
}

/* ============================================================
   SECTION -> FOLDER/FILE TREE (explorer + scope)
   Folder/File/Test teeno me parentType + parentId hota hai.
   Root items (parentType = "section") ko section id se bucket karte hain.
============================================================ */
async function loadListingTree(listingId) {
    const lid = new mongoose.Types.ObjectId(String(listingId));

    const [folders, files, tests] = await Promise.all([
        Folder.find({ listing: lid }).select("title section parentType parentId createdAt").lean(),
        File.find({ listing: lid }).select("title section parentType parentId createdAt").lean(),
        Test.find({ listing: lid }).select("section parentType parentId").lean()
    ]);

    const childrenOf = new Map();
    const addChild = (kind, item) => {
        const key = item.parentType === "section"
            ? `section:${item.section}`
            : `${item.parentType}:${item.parentId}`;
        if (!childrenOf.has(key)) childrenOf.set(key, { folders: [], files: [], tests: [] });
        childrenOf.get(key)[kind].push(item);
    };
    folders.forEach(f => addChild("folders", f));
    files.forEach(f => addChild("files", f));
    tests.forEach(t => addChild("tests", t));

    const folderMap = new Map(folders.map(f => [String(f._id), f]));
    const fileMap = new Map(files.map(f => [String(f._id), f]));

    return { childrenOf, folderMap, fileMap };
}

// Kisi node (section/folder/file) ke andar ke saare Tests (recursive)
function collectTestIdsFromTree(tree, nodeType, nodeId) {
    const result = [];
    const visited = new Set();

    const walk = (type, id) => {
        const key = `${type}:${id}`;
        if (visited.has(key)) return;
        visited.add(key);

        const kids = tree.childrenOf.get(key);
        if (!kids) return;

        kids.tests.forEach(t => result.push(t._id));
        kids.folders.forEach(f => walk("folder", String(f._id)));
        kids.files.forEach(f => walk("file", String(f._id)));
    };

    walk(nodeType, String(nodeId));
    return result;
}

// Frontend se aaya scope sirf folder/file ho sakta hai (section ke liye purana tareeka chalta hai)
function normalizeScope(scope) {
    if (!scope || typeof scope !== "object") return null;
    const type = scope.type;
    const id = String(scope.id || "");
    if (!["folder", "file"].includes(type) || !mongoose.Types.ObjectId.isValid(id)) return null;
    return { type, id };
}

async function getTestIdsForScope(listingId, scope) {
    if (!scope || !mongoose.Types.ObjectId.isValid(String(listingId))) return [];
    const tree = await loadListingTree(listingId);
    const exists = scope.type === "folder" ? tree.folderMap.has(scope.id) : tree.fileMap.has(scope.id);
    if (!exists) return [];   // dusri listing ka ya galat id
    return collectTestIdsFromTree(tree, scope.type, scope.id);
}

/* ============================================================
   Question source resolve: "This Listing" ya "Other" (dusri listing)
   - sourceListingId khaali ya current jaisa ho -> current listing
   - warna valid ObjectId + listing exist honi chahiye
============================================================ */
async function resolveSourceListingId(currentListingId, sourceListingId) {
    const current = String(currentListingId);

    if (!sourceListingId || String(sourceListingId) === current) {
        return { id: current };
    }
    if (!mongoose.Types.ObjectId.isValid(String(sourceListingId))) {
        return { error: "Invalid source listing.", status: 400 };
    }
    const exists = await Listing.exists({ _id: String(sourceListingId) });
    if (!exists) {
        return { error: "Source listing not found.", status: 404 };
    }
    return { id: String(sourceListingId) };
}


/* ============================================================
   PAGE RENDER — /generate-paper/new
============================================================ */
export const renderGeneratePaper = async (req, res) => {
    const { listingId, sectionId, parentType, parentId, returnUrl } = req.query;
    if (!listingId) throw new ExpressError(400, "listingId query parameter is required.");

    const listing = await Listing.findById(listingId);
    if (!listing) throw new ExpressError(404, "Listing Not Found");

    const sections = await Section.find({ listing: listing._id }).sort({ createdAt: 1 });

    let currentSection = null;
    if (sectionId) currentSection = await Section.findById(sectionId);

    res.render("dashboard/generate", {
        layout: "layouts/dashboard",
        listing,
        sections,
        currentSection,
        folder: null,
        file: null,
        listingId,
        sectionId: sectionId || "",
        parentType: parentType || "section",
        parentId: parentId || "",
        returnUrl: returnUrl || "/",
        selectedStatsSection: "all",     
        statsFilterSections: sections,
        robots: "noindex, nofollow"
    });
};


/* ============================================================
   GET /api/listing/:id/sections
   -> Section model se list (sidebar jaisi)
   -> Count = us section ke Tests ki TestQuestion entries se
      distinct question count (Question.listing NAHI dekha)
============================================================ */
export const getListingSections = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid listing id" });
    }

    const sections = await Section.find({ listing: id }).sort({ order: 1, createdAt: 1 });

    const data = await Promise.all(sections.map(async (sec) => {
        const testIds = await getTestIdsForListing(id, [sec._id.toString()]);
        let count = 0;
        if (testIds.length > 0) {
            const distinctQs = await TestQuestion.distinct("question", { test: { $in: testIds } });
            count = distinctQs.length;
        }
        return { section: sec.title, sectionId: sec._id.toString(), count };
    }));

    res.status(200).json({ success: true, data });
};


/* ============================================================
   GET /api/listing/:id/subjects
   -> Ab TestQuestion se (jo is listing ke Tests me actually
      istemaal hue hain), Question.listing field se NAHI
============================================================ */
export const getListingSubjects = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid listing id" });
    }

    const testIds = await getTestIdsForListing(id, null);
    if (testIds.length === 0) return res.status(200).json({ success: true, data: [] });

    const subjects = (await TestQuestion.distinct("subject", { test: { $in: testIds } }))
        .filter(s => s && s.trim() !== "")
        .sort()
        .map(s => ({ subject: s }));

    res.status(200).json({ success: true, data: subjects });
};


/* ============================================================
   GET /api/listing/:id/question-filters?subject=&section=&qsection=&topic=
   -> Sab kuch TestQuestion se (subject/section/topic/subTopic) —
      Question collection ko sirf FINAL pool fetch karte waqt
      generatePaper me use karenge (question ka content chahiye),
      par "kya options hain" ye hamesha TestQuestion se poochna hai.
============================================================ */
export const getQuestionFilters = async (req, res) => {
    const { id } = req.params;
    const { subject, section, qsection, topic, scopeType, scopeId } = req.query;

    const sectionIds = section
        ? section.split(',').map(s => s.trim()).filter(Boolean)
        : [];

    const scope = normalizeScope({ type: scopeType, id: scopeId });
    const testIds = scope
        ? await getTestIdsForScope(id, scope)
        : await getTestIdsForListing(id, sectionIds);
    if (testIds.length === 0) {
        return res.status(200).json({ success: true, data: { qsections: [], topics: [], subTopics: [] } });
    }

    const baseMatch = { test: { $in: testIds } };
    if (subject) baseMatch.subject = subject;

    const qsections = (await TestQuestion.distinct("section", baseMatch))
        .filter(s => s && s.trim() !== "")
        .sort();

    const topicMatch = { ...baseMatch };
    if (qsection) {
        const qsecArr = qsection.split(',').map(s => s.trim()).filter(Boolean);
        if (qsecArr.length > 0) topicMatch.section = { $in: qsecArr };
    }
    const topics = (await TestQuestion.distinct("topic", topicMatch))
        .filter(t => t && t.trim() !== "")
        .sort();

    const subTopicMatch = { ...topicMatch };
    if (topic) {
        const topicArr = topic.split(',').map(s => s.trim()).filter(Boolean);
        if (topicArr.length > 0) subTopicMatch.topic = { $in: topicArr };
    }
    const subTopics = (await TestQuestion.distinct("subTopic", subTopicMatch))
        .filter(st => st && st.trim() !== "")
        .sort();

    res.status(200).json({ success: true, data: { qsections, topics, subTopics } });
};


/* ============================================================
   POST /api/generate-paper
   -> Pool ab TestQuestion se banega: is listing (+ selected
      global sections) ke Tests ki TestQuestion entries, jo bhi
      row ke Subject/Section/Topic/SubTopic/Difficulty match
      karein — unke "question" refs se asli Question docs fetch
      honge (content ke liye), listing field kabhi check nahi hoga.
============================================================ */
export const generatePaper = async (req, res) => {
    const body = req.body;

    if (!body.listingId) return res.status(400).json({ success: false, message: "listingId is required." });
    if (!Array.isArray(body.criteria) || body.criteria.length === 0) {
        return res.status(400).json({ success: false, message: "At least one criteria row is required." });
    }

    const listingDoc = await Listing.findById(body.listingId).select("marks");
    if (!listingDoc) return res.status(404).json({ success: false, message: "Listing not found" });

    const subjectsConfig = listingDoc.marks || [];
    const noOfPapers = Math.max(1, Number(body.noOfPapers) || 1);
    const maxRepeat = Math.max(1, Number(body.maxRepeat) || 2);
    const visibility = body.visibility === "public" ? "public" : "private";

       const sourceResolved = await resolveSourceListingId(body.listingId, body.sourceListingId);
    if (sourceResolved.error) {
        return res.status(sourceResolved.status).json({ success: false, message: sourceResolved.error });
    }
    const sourceListingId = sourceResolved.id;

    // Other mode = questions dusri listing se, subject current listing ka
    const isOtherSource = sourceListingId !== String(body.listingId);

    if (isOtherSource) {
        for (let i = 0; i < body.criteria.length; i++) {
            const subj = body.criteria[i] && body.criteria[i].subject;
            if (!subj || !subjectsConfig.some(s => s.subject === subj)) {
                return res.status(400).json({
                    success: false,
                    message: `Row ${i + 1}: please choose a subject of this listing.`
                });
            }
        }
    }

    const globalSectionIds = Array.isArray(body.sections) ? body.sections.filter(Boolean) : [];
    const scope = normalizeScope(body.scope);
    const testIds = scope
        ? await getTestIdsForScope(sourceListingId, scope)
        : await getTestIdsForListing(sourceListingId, globalSectionIds.length > 0 ? globalSectionIds : null);
    if (testIds.length === 0) {
        return res.status(400).json({
            success: false,
            message: "No tests or questions are available in this listing or selected section."
        });
    }

        // 👇 NAYA: "Total No of Questions" (All ya Subject-wise) se effective minCount/maxCount decide karo
    const totalQuestionsStrategy = body.totalQuestionsStrategy === 'subject' ? 'subject' : 'all';
    const subjectQuestionCounts = Array.isArray(body.subjectQuestionCounts) ? body.subjectQuestionCounts : [];
    const totalQuestionsCount = Math.max(0, Number(body.totalQuestionsCount) || 0);

    function distributeCount(totalCount, weights) {
        const n = weights.length;
        if (n === 0) return [];
        const sumWeights = weights.reduce((a, b) => a + b, 0);
        const rawShares = weights.map(w => (sumWeights > 0 ? (w / sumWeights) : (1 / n)) * totalCount);
        const floorShares = rawShares.map(x => Math.floor(x));
        let allocated = floorShares.reduce((a, b) => a + b, 0);
        let remainder = totalCount - allocated;

        const fractionalOrder = rawShares
            .map((x, i) => ({ i, frac: x - Math.floor(x) }))
            .sort((a, b) => b.frac - a.frac);

        const result = [...floorShares];
        for (let k = 0; k < remainder; k++) {
            result[fractionalOrder[k % n].i]++;
        }
        return result.map(x => Math.max(0, x));
    }

    let effectiveCounts = null;

    if (totalQuestionsStrategy === 'all' && totalQuestionsCount > 0) {
        const weights = body.criteria.map(c => {
            const minV = Math.max(1, Number(c.minCount) || 1);
            const maxV = Math.max(minV, Number(c.maxCount) || minV);
            return (minV + maxV) / 2;
        });
        const distributed = distributeCount(totalQuestionsCount, weights);
        effectiveCounts = distributed.map(val => ({ minCount: Math.max(1, val), maxCount: Math.max(1, val) }));
    } else if (totalQuestionsStrategy === 'subject' && subjectQuestionCounts.length > 0) {
        effectiveCounts = body.criteria.map(() => null);

        const subjectToRowIndexes = {};
        body.criteria.forEach((c, idx) => {
            if (!c.subject) return;
            if (!subjectToRowIndexes[c.subject]) subjectToRowIndexes[c.subject] = [];
            subjectToRowIndexes[c.subject].push(idx);
        });

        subjectQuestionCounts.forEach(sq => {
            const rowIndexes = subjectToRowIndexes[sq.subject];
            if (!rowIndexes || rowIndexes.length === 0) return;

            const weights = rowIndexes.map(idx => {
                const c = body.criteria[idx];
                const minV = Math.max(1, Number(c.minCount) || 1);
                const maxV = Math.max(minV, Number(c.maxCount) || minV);
                return (minV + maxV) / 2;
            });
            const distributed = distributeCount(Math.max(0, Number(sq.count) || 0), weights);
            rowIndexes.forEach((idx, k) => {
                effectiveCounts[idx] = { minCount: Math.max(1, distributed[k]), maxCount: Math.max(1, distributed[k]) };
            });
        });
    }

        const criteriaPools = [];

    for (let ci = 0; ci < body.criteria.length; ci++) {
        const c = body.criteria[ci];
        const override = effectiveCounts ? effectiveCounts[ci] : null;
        const minCount = override ? override.minCount : Math.max(1, Number(c.minCount) || 1);
        const maxCount = override ? override.maxCount : Math.max(minCount, Number(c.maxCount) || minCount);
        const tqMatch = { test: { $in: testIds } };
        // Other mode me source ke question ka subject matter nahi karta
        if (c.subject && !isOtherSource) tqMatch.subject = c.subject;
        if (Array.isArray(c.section) && c.section.length > 0) tqMatch.section = { $in: c.section };
        if (Array.isArray(c.topic) && c.topic.length > 0) tqMatch.topic = { $in: c.topic };
        if (Array.isArray(c.subTopic) && c.subTopic.length > 0) tqMatch.subTopic = { $in: c.subTopic };

        // 👇 TestQuestion se distinct question IDs nikalo (ye asli pool ke candidates hain)
        const matchingTQs = await TestQuestion.find(tqMatch)
            .select("question subject topic subTopic section")
            .lean();

        // Har question ka asli (TestQuestion wala) subject/topic/section yaad rakho
        const tqMetaByQ = new Map();
        for (const tq of matchingTQs) {
            const key = tq.question.toString();
            if (!tqMetaByQ.has(key)) {
                tqMetaByQ.set(key, {
                    subject: isOtherSource ? (c.subject || "") : (tq.subject || ""),
                    topic: tq.topic || "",
                    subTopic: tq.subTopic || "",
                    section: tq.section || ""
                });
            }
        }
        const uniqueQIds = [...tqMetaByQ.keys()];

        const label = `${c.subject || 'Subject'}${(c.topic && c.topic.length) ? ' / ' + c.topic.join(', ') : ''}`;

        if (uniqueQIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: `No questions were found for "${label}". Please check the selected section, subject, topic, and subtopic.`
            });
        }

        // 👇 Ab asli Question documents fetch karo (content ke liye), aur difficulty yahi se filter karo
        const questionMatch = { _id: { $in: uniqueQIds.map(x => new mongoose.Types.ObjectId(x)) } };
        if (Array.isArray(c.difficulty) && c.difficulty.length > 0) {
            questionMatch.difficulty = { $in: c.difficulty };
        }

         questionMatch.status = { $ne: "Disabled" };

        const pool = await Question.find(questionMatch).lean();
  
         pool.forEach(q => { q._meta = tqMetaByQ.get(q._id.toString()) || null; });

        if (pool.length === 0) {
            return res.status(400).json({
                success: false,
                message: `"${label}" (Difficulty: ${(Array.isArray(c.difficulty) && c.difficulty.length > 0) ? c.difficulty.join('/') : 'Any'}) ke liye koi question nahi mila.`
            });
        }

        const avgDemand = ((minCount + maxCount) / 2) * noOfPapers;
        const maxPossible = pool.length * maxRepeat;
        if (avgDemand > maxPossible) {
            return res.status(400).json({
                success: false,
                message: `Only ${pool.length} questions are available for "${label}". The selected paper configuration requires ${noOfPapers} papers with ${minCount}-${maxCount} questions per paper and a maximum repeat count of ${maxRepeat}.`
            });
        }

        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }

        criteriaPools.push({ criteria: c, minCount, maxCount, pool, label });
    }

    const usageCount = new Map();
    const createdTestIds = [];
    const shortfallWarnings = [];

    for (let p = 0; p < noOfPapers; p++) {
        const pickedQuestions = [];
        const usedInThisPaper = new Set();

        for (const { criteria: c, minCount, maxCount, pool, label } of criteriaPools) {
            const needed = Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount;

            const candidates = pool
                .filter(q => !usedInThisPaper.has(q._id.toString()))
                .filter(q => (usageCount.get(q._id.toString()) || 0) < maxRepeat)
                .sort((a, b) => (usageCount.get(a._id.toString()) || 0) - (usageCount.get(b._id.toString()) || 0));

            const selected = candidates.slice(0, needed);

            if (selected.length < needed) {
                shortfallWarnings.push(
                    `Paper ${p + 1}: "${label}" needs ${needed} questions, but only ${selected.length} were available.`
                );
            }

            for (const q of selected) {
                const idStr = q._id.toString();
                pickedQuestions.push(q);
                usedInThisPaper.add(idStr);
                usageCount.set(idStr, (usageCount.get(idStr) || 0) + 1);
            }
        }

        const subjectOf = (q) => (q._meta && q._meta.subject) || q.subject;

        const calculatedTotalMarks = pickedQuestions.reduce(
            (sum, q) => sum + getMarksForSubject(subjectsConfig, subjectOf(q)).positiveMarks, 0
        );

        const baseTitle = (body.title && body.title.trim()) ? body.title.trim() : "Generated Paper";
        const paperTitle = noOfPapers > 1 ? `${baseTitle} ${p + 1}` : baseTitle;

        const languageMode = body.languageMode === "multiple" ? "multiple" : "single";
        let languages = Array.isArray(body.languages) && body.languages.length > 0
            ? body.languages.map(l => String(l).trim()).filter(Boolean) : ["English"];
        if (languageMode === "single" && languages.length > 1) languages = [languages[0]];

        let showLanguage = body.showLanguage && String(body.showLanguage).trim()
            ? String(body.showLanguage).trim() : "all";
        if (languageMode !== "multiple") showLanguage = "all";
        else if (showLanguage !== "all" && !languages.includes(showLanguage)) showLanguage = "all";

        const testDoc = new Test({
            title: paperTitle,
            listing: body.listingId,
            section: body.sectionId || null,
            parentType: body.parentType || "section",
            parentId: body.parentId || null,
            languageMode, languages, showLanguage,
            timeStrategy: body.timeStrategy || "total",
            duration: body.duration || body.timeLimit || 60,
            subjectTime: body.subjectTime || [],
            totalQuestions: pickedQuestions.length,
            totalMarks: calculatedTotalMarks,
            visibility,
            publishAt: null
        });

        const savedTest = await testDoc.save();

        const mappingDocs = pickedQuestions.map((q, i) => {
            const m = q._meta || {};
            const subj = subjectOf(q);
            const marks = getMarksForSubject(subjectsConfig, subj);
            return {
                test: savedTest._id,
                question: q._id,
                order: i + 1,
                subject: subj || "",
                topic: m.topic || q.topic || "",
                subTopic: m.subTopic || q.subTopic || "",
                section: m.section || q.section || "",
                positiveMarks: marks.positiveMarks,
                negativeMarks: marks.negativeMarks
            };
        });

        if (mappingDocs.length > 0) await TestQuestion.insertMany(mappingDocs);
        createdTestIds.push(savedTest._id);
    }

    res.status(200).json({
        success: true,
        message: `${createdTestIds.length} paper(s) generated successfully.`,
        testIds: createdTestIds,
        warnings: shortfallWarnings.length > 0 ? shortfallWarnings : undefined
    });
};


/* ============================================================
   GET /api/listing/:id/question-bank-stats
============================================================ */
export const getQuestionBankStats = async (req, res) => {
    const { id } = req.params;
    const testIds = await getTestIdsForListing(id, null);
    const totalQuestions = testIds.length > 0
        ? (await TestQuestion.distinct("question", { test: { $in: testIds } })).length
        : 0;

    const subjectBreakdown = testIds.length > 0
        ? await TestQuestion.aggregate([
            { $match: { test: { $in: testIds } } },
            { $group: { _id: "$subject", count: { $sum: 1 } } },
            { $project: { _id: 0, subject: "$_id", count: 1 } },
            { $sort: { subject: 1 } }
        ])
        : [];

    res.status(200).json({ success: true, data: { totalQuestions, subjectBreakdown } });
};


/* ============================================================
   GET /api/listing/:id/question-count?subject=&section=&topic=&difficulty=
   (Fallback/simple endpoint — TestQuestion se count)
============================================================ */
export const getQuestionCount = async (req, res) => {
    const { id } = req.params;
    const { subject, section, topic, difficulty } = req.query;

    const testIds = await getTestIdsForListing(id, null);
    const match = { test: { $in: testIds } };
    if (subject) match.subject = subject;
    if (section) match.section = section;
    if (topic) match.topic = topic;

    let count = await TestQuestion.countDocuments(match);

    if (difficulty && difficulty !== "Any" && testIds.length > 0) {
        const tqs = await TestQuestion.find(match).select("question");
        const qIds = [...new Set(tqs.map(t => t.question.toString()))];
        count = await Question.countDocuments({ _id: { $in: qIds }, difficulty });
    }

    res.status(200).json({ success: true, data: { count } });
};


/* ============================================================
   GET /api/listing/:id/languages
============================================================ */
export const getListingLanguages = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid listing id" });
    }

    const testIds = await getTestIdsForListing(id, null);
    if (testIds.length === 0) return res.status(200).json({ success: true, data: [] });

    const uniqueQIds = [...new Set((await TestQuestion.distinct("question", { test: { $in: testIds } })).map(x => x.toString()))];

    const languageSet = new Set();

    const singleModeCount = await Question.countDocuments({
        _id: { $in: uniqueQIds }, languageMode: "single"
    });
    if (singleModeCount > 0) languageSet.add("English");

    const multiLangResult = await Question.distinct("translations.lang", {
        _id: { $in: uniqueQIds }, languageMode: "multiple"
    });
    multiLangResult.filter(l => l && l.trim() !== "").forEach(l => languageSet.add(l));

    const languages = Array.from(languageSet).sort();
    res.status(200).json({ success: true, data: languages });
};


/* ============================================================
   "OTHER" SOURCE — Category -> Exam -> Listing
============================================================ */
export const getSourceCategories = async (req, res) => {
    const categories = await Category.find({}).select("name").sort({ name: 1 }).lean();
    res.status(200).json({
        success: true,
        data: categories.map(c => ({ id: c._id.toString(), name: c.name }))
    });
};

export const getSourceExams = async (req, res) => {
    const { category } = req.query;
    if (typeof category !== "string" || !mongoose.Types.ObjectId.isValid(category)) {
        return res.status(400).json({ success: false, message: "Invalid category id" });
    }

    const exams = (await Listing.distinct("exam", { category: new mongoose.Types.ObjectId(category) }))
        .filter(e => e && String(e).trim() !== "")
        .sort();

    res.status(200).json({ success: true, data: exams });
};

export const getSourceListings = async (req, res) => {
    const { category, exam } = req.query;
    if (typeof category !== "string" || !mongoose.Types.ObjectId.isValid(category)) {
        return res.status(400).json({ success: false, message: "Invalid category id" });
    }
    if (typeof exam !== "string" || exam.trim() === "") {
        return res.status(400).json({ success: false, message: "Exam is required" });
    }

    const listings = await Listing.find({
        category: new mongoose.Types.ObjectId(category),
        exam: exam
    }).select("title").sort({ title: 1 }).lean();

    res.status(200).json({
        success: true,
        data: listings.map(l => ({ id: l._id.toString(), title: l.title }))
    });
};

// Current listing ke marks me jo subjects hain (Other mode me Subject dropdown yahin se aayega)
export const getMarksSubjects = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid listing id" });
    }

    const listing = await Listing.findById(id).select("marks").lean();
    if (!listing) return res.status(404).json({ success: false, message: "Listing not found" });

    const seen = new Set();
    const data = [];
    for (const m of (listing.marks || [])) {
        if (m.subject && !seen.has(m.subject)) {
            seen.add(m.subject);
            data.push({ subject: m.subject });
        }
    }

    res.status(200).json({ success: true, data });
};



/* ============================================================
   GET /api/listing/:id/explorer?nodeType=section|folder|file&nodeId=
   -> Us position ke andar ke folders + files (har ek me kitne tests),
      aur us position ke total tests / distinct questions.
============================================================ */
export const getExplorerNode = async (req, res) => {
    const { id } = req.params;
    const { nodeType, nodeId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid listing id" });
    }
    if (!["section", "folder", "file"].includes(nodeType) ||
        typeof nodeId !== "string" || !mongoose.Types.ObjectId.isValid(nodeId)) {
        return res.status(400).json({ success: false, message: "Invalid node" });
    }

    const tree = await loadListingTree(id);

    let title = "";
    if (nodeType === "section") {
        const sec = await Section.findOne({ _id: nodeId, listing: id }).select("title").lean();
        if (!sec) return res.status(404).json({ success: false, message: "Section not found" });
        title = sec.title;
    } else {
        const node = (nodeType === "folder" ? tree.folderMap : tree.fileMap).get(nodeId);
        if (!node) return res.status(404).json({ success: false, message: "Location not found" });
        title = node.title;
    }

    const kids = tree.childrenOf.get(`${nodeType}:${nodeId}`) || { folders: [], files: [], tests: [] };

    const byCreated = (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    const toItem = (type) => (n) => ({
        id: String(n._id),
        title: n.title,
        testCount: collectTestIdsFromTree(tree, type, n._id).length
    });

    const folders = [...kids.folders].sort(byCreated).map(toItem("folder"));
    const files = [...kids.files].sort(byCreated).map(toItem("file"));

    // Section root par purana tareeka (Test.section), baaki jagah tree se
    const scopeTestIds = nodeType === "section"
        ? await getTestIdsForListing(id, [nodeId])
        : collectTestIdsFromTree(tree, nodeType, nodeId);

    const questionCount = scopeTestIds.length > 0
        ? (await TestQuestion.distinct("question", { test: { $in: scopeTestIds } })).length
        : 0;

    res.status(200).json({
        success: true,
        data: {
            node: { type: nodeType, id: nodeId, title },
            folders,
            files,
            testCount: scopeTestIds.length,
            questionCount
        }
    });
};