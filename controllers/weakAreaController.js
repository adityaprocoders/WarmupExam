import mongoose from "mongoose";
import Listing from "../models/listing.js";
import Section from "../models/Section.js";
import Test from "../models/Test.js";
import TestQuestion from "../models/TestQuestion.js";
import Attempt from "../models/TestAttempt.js";
import ExpressError from "../utils/ExpressError.js";
import { checkEnrollment } from "../utils/authHelpers.js";
import { calculateRankFromPredictor } from "../utils/rankHelper.js";

const evaluateAnswer = (q, a) => {
    if (!q || !a) return { attempted: false, isCorrect: false };

    if (q.type === "integer") {
        const attempted = a.numericAnswer !== null && a.numericAnswer !== undefined;
        const isCorrect = attempted && Number(a.numericAnswer) === Number(q.numericAnswer);
        return { attempted, isCorrect };
    }

    const sel = a.selectedOptions || [];
    const attempted = sel.length > 0;
    const correct = q.correctAnswers || [];
    const isCorrect = attempted && sel.length === correct.length && sel.every(i => correct.includes(i));
    return { attempted, isCorrect };
};

const statusFromPct = (pct) => {
    if (pct <= 40) return "Very Weak";
    if (pct <= 60) return "Weak";
    if (pct <= 75) return "Average";
    return "Good";
};

// Attempted-wale pehle (weakest se strongest), unattempted-wale hamesha baad me
const attemptFirstSort = (a, b) => {
    if (a.attemptedQs > 0 && b.attemptedQs === 0) return -1;
    if (a.attemptedQs === 0 && b.attemptedQs > 0) return 1;
    return a.pct - b.pct;
};

const ICON_CYCLE = ["grid", "brain", "desktop", "book", "globe"];
const COLOR_CYCLE = ["indigo", "orange", "green", "blue", "purple"];

export const showWeakAreas = async (req, res) => {
    const { slug } = req.params;

    if (req.user.role !== "owner" && typeof req.user.populate === "function") {
        await req.user.populate([
            { path: "enrolledListings.listing" },
            { path: "lastAccessedBatch" }
        ]);
    }

    const listing = await Listing.findOne({ slug });
    if (!listing) throw new ExpressError(404, "Series Not Found");

    if (!checkEnrollment(req, listing._id)) {
        req.flash("error", "You must be enrolled in this batch to access this page.");
        return res.redirect(`/test/${listing._id}`);
    }

    const sections = await Section.find({ listing: listing._id }).sort({ createdAt: 1 });

    const allTests = await Test.find({ listing: listing._id }).select("_id title").sort({ createdAt: -1 });
    const allTestIds = allTests.map(t => t._id);

    if (allTestIds.length === 0) {
        return res.render("dashboard/weaakarea", {
            layout: "layouts/dashboard",
            listing, sections,
            currentSection: null,
            isWeakAreaPage: true,
            weakAreaData: null,
            mockTests: [],
            selectedTestId: null
        });
    }

    // Hamesha saare attempted tests ka combined weak-area analysis
    const testFilterIds = allTestIds;

    const attempts = await Attempt.find({
        test: { $in: testFilterIds },
        user: req.user._id
    }).populate("answers.question").sort({ createdAt: -1 });

    if (attempts.length === 0) {
        return res.render("dashboard/weaakarea", {
            layout: "layouts/dashboard",
            listing, sections,
            currentSection: null,
            isWeakAreaPage: true,
            weakAreaData: null,
            mockTests: allTests,
            selectedTestId: null
        });
    }

    const attemptTestIds = [...new Set(attempts.map(a => String(a.test)))];
    const tqMappings = await TestQuestion.find({ test: { $in: attemptTestIds } });
    const marksMap = {};
    tqMappings.forEach(m => {
        marksMap[`${m.test}_${m.question}`] = {
            positiveMarks: m.positiveMarks || 0,
            negativeMarks: m.negativeMarks || 0
        };
    });

    const subjectStats = {};
    const topicStats = {};
    const subtopicStats = {};

    attempts.forEach(attempt => {
        attempt.answers.forEach(a => {
            const q = a.question;
            if (!q) return;

            const subject = q.subject;
            const topic = q.topic;
            const subTopic = q.subTopic && q.subTopic.trim() ? q.subTopic : topic;
            const { attempted, isCorrect } = evaluateAnswer(q, a);
            const marks = marksMap[`${attempt.test}_${q._id}`] || { positiveMarks: 0, negativeMarks: 0 };

            if (!subjectStats[subject]) subjectStats[subject] = { correct: 0, wrong: 0, skipped: 0, total: 0 };
            subjectStats[subject].total += 1;
            if (!attempted) subjectStats[subject].skipped += 1;
            else if (isCorrect) subjectStats[subject].correct += 1;
            else subjectStats[subject].wrong += 1;

            if (!topicStats[subject]) topicStats[subject] = {};
            if (!topicStats[subject][topic]) topicStats[subject][topic] = { correct: 0, wrong: 0, total: 0, marksLost: 0 };
            topicStats[subject][topic].total += 1;
            if (attempted && isCorrect) {
                topicStats[subject][topic].correct += 1;
            } else {
                if (attempted) topicStats[subject][topic].wrong += 1;
                topicStats[subject][topic].marksLost += marks.positiveMarks;
            }

            if (!subtopicStats[subject]) subtopicStats[subject] = {};
            if (!subtopicStats[subject][topic]) subtopicStats[subject][topic] = {};
            if (!subtopicStats[subject][topic][subTopic]) subtopicStats[subject][topic][subTopic] = { correct: 0, wrong: 0, total: 0 };
            subtopicStats[subject][topic][subTopic].total += 1;
            if (attempted && isCorrect) subtopicStats[subject][topic][subTopic].correct += 1;
            else if (attempted && !isCorrect) subtopicStats[subject][topic][subTopic].wrong += 1;
        });
    });

    // ---- subjects[] : attempted-weak pehle, phir unattempted ----
    const subjects = Object.entries(subjectStats).map(([subject, s], idx) => {
        const attemptedQs = s.correct + s.wrong;
        const pct = attemptedQs > 0 ? Math.round((s.correct / attemptedQs) * 100) : 0;
        const totalQs = s.total;
        const correctPct = totalQs > 0 ? Math.round((s.correct / totalQs) * 100) : 0;
        const wrongPct = totalQs > 0 ? Math.round((s.wrong / totalQs) * 100) : 0;
        const skippedPct = totalQs > 0 ? Math.round((s.skipped / totalQs) * 100) : 0;
        return {
            name: subject,
            pct,
            attemptedQs,
            status: attemptedQs > 0 ? statusFromPct(pct) : "Not Attempted",
            correct: s.correct,
            wrong: s.wrong,
            skipped: s.skipped,
            correctPct,
            wrongPct,
            skippedPct,
            icon: ICON_CYCLE[idx % ICON_CYCLE.length],
            color: COLOR_CYCLE[idx % COLOR_CYCLE.length]
        };
    }).sort(attemptFirstSort);

    const focusSubject = subjects.length > 0 ? subjects[0].name : null;

    let topics = [];
    if (focusSubject && topicStats[focusSubject]) {
        topics = Object.entries(topicStats[focusSubject]).map(([topic, t]) => {
            const attemptedQs = t.correct + t.wrong;
            const pct = attemptedQs > 0 ? Math.round((t.correct / attemptedQs) * 100) : 0;
            const skipped = t.total - attemptedQs;
            const wrongPct = t.total > 0 ? Math.round((t.wrong / t.total) * 100) : 0;
            const skippedPct = t.total > 0 ? Math.round((skipped / t.total) * 100) : 0;
            return {
                name: topic, pct, attemptedQs,
                status: attemptedQs > 0 ? statusFromPct(pct) : "Not Attempted",
                trend: pct >= 60 ? "up" : "down",
                wrong: t.wrong, wrongPct, skippedPct,
                marksLost: t.marksLost
            };
        }).sort(attemptFirstSort);
    }

    const focusTopic = topics.length > 0 ? topics[0].name : null;

    let subtopics = [];
    if (focusSubject && focusTopic && subtopicStats[focusSubject]?.[focusTopic]) {
        subtopics = Object.entries(subtopicStats[focusSubject][focusTopic]).map(([subTopic, st]) => {
            const attemptedQs = st.correct + st.wrong;
            const pct = attemptedQs > 0 ? Math.round((st.correct / attemptedQs) * 100) : 0;
            const wrongPct = st.total > 0 ? Math.round((st.wrong / st.total) * 100) : 0;
            return {
                name: subTopic, pct, wrong: st.wrong, wrongPct, attemptedQs,
                status: attemptedQs > 0 ? statusFromPct(pct) : "Not Attempted"
            };
        }).sort(attemptFirstSort);
    }

    // ---- Har subject ke saare topics (dropdown ke liye) ----
    const topicsBySubject = {};
    Object.entries(topicStats).forEach(([subject, tMap]) => {
        topicsBySubject[subject] = Object.entries(tMap).map(([topic, t]) => {
            const attemptedQs = t.correct + t.wrong;
            const pct = attemptedQs > 0 ? Math.round((t.correct / attemptedQs) * 100) : 0;
            const skipped = t.total - attemptedQs;
            const wrongPct = t.total > 0 ? Math.round((t.wrong / t.total) * 100) : 0;
            const skippedPct = t.total > 0 ? Math.round((skipped / t.total) * 100) : 0;
            return {
                name: topic, pct, attemptedQs,
                status: attemptedQs > 0 ? statusFromPct(pct) : "Not Attempted",
                trend: pct >= 60 ? "up" : "down",
                wrong: t.wrong, wrongPct, skippedPct
            };
        }).sort(attemptFirstSort);
    });

    // ---- Har subject+topic ke saare subtopics (dropdown ke liye) ----
    const subtopicsByTopic = {};
    Object.entries(subtopicStats).forEach(([subject, tMap]) => {
        Object.entries(tMap).forEach(([topic, stMap]) => {
            const key = `${subject}|||${topic}`;
            subtopicsByTopic[key] = Object.entries(stMap).map(([subTopic, st]) => {
                const attemptedQs = st.correct + st.wrong;
                const pct = attemptedQs > 0 ? Math.round((st.correct / attemptedQs) * 100) : 0;
                const wrongPct = st.total > 0 ? Math.round((st.wrong / st.total) * 100) : 0;
                return {
                    name: subTopic, pct, wrong: st.wrong, wrongPct, attemptedQs,
                    status: attemptedQs > 0 ? statusFromPct(pct) : "Not Attempted"
                };
            }).sort(attemptFirstSort);
        });
    });

    // ---- Top 5 weakest topics — marksLost/wrong/subject rakhe, sirf display ke liye strip baad me ----
    const weakAreasFull = Object.entries(topicStats)
        .flatMap(([subject, tMap]) => Object.entries(tMap).map(([topic, t]) => {
            const attemptedQs = t.correct + t.wrong;
            const pct = attemptedQs > 0 ? Math.round((t.correct / attemptedQs) * 100) : 0;
            return { name: topic, subject, pct, qs: t.total, attemptedQs, wrong: t.wrong, marksLost: t.marksLost };
        }))
        .filter(t => t.attemptedQs > 0 && t.pct <= 60) // sirf real weakness
        .sort((a, b) => a.pct - b.pct)
        .slice(0, 5);

    const weakAreas = weakAreasFull.map(t => ({ name: t.name, subject: t.subject, pct: t.pct, action: "Practice" }));
    const weakAreasAll = weakAreasFull.slice(0, 50).map(t => ({ name: t.name, subject: t.subject, pct: t.pct, action: "Practice" }));

    const allTopicNames = [...new Set(Object.values(topicStats).flatMap(tMap => Object.keys(tMap)))];
    const heatmapRows = Object.entries(topicStats).map(([subject, tMap]) => ({
        name: subject,
        vals: allTopicNames.map(topicName => {
            const t = tMap[topicName];
            if (!t) return null;
            const attemptedQs = t.correct + t.wrong;
            return attemptedQs > 0 ? Math.round((t.correct / attemptedQs) * 100) : null;
        })
    }));

    // ---- AI Recommendation ----
    const top2Weak = weakAreasFull.slice(0, 2).map(w => w.name);
    const estimatedMarksLosing = weakAreasFull.slice(0, 2).reduce((sum, w) => sum + (w.marksLost || 0), 0);
    const totalWrongInWeakAreas = weakAreasFull.slice(0, 2).reduce((sum, w) => sum + (w.wrong || 0), 0);

    const weakTopicsCount = Object.values(topicStats)
        .flatMap(tMap => Object.values(tMap))
        .filter(t => {
            const attemptedQs = t.correct + t.wrong;
            if (attemptedQs === 0) return false;
            const pct = Math.round((t.correct / attemptedQs) * 100);
            return pct <= 60;
        }).length;

    let estimatedImprovementAIR = null;
    if (listing.rankPredictorData && listing.rankPredictorData.length > 0) {
        const latestScore = attempts[0].score;
        const { rank: currentRank } = calculateRankFromPredictor(latestScore, listing.rankPredictorData);
        const improvedScore = Math.min(latestScore + estimatedMarksLosing, attempts[0].totalMarks);
        const { rank: improvedRank } = calculateRankFromPredictor(improvedScore, listing.rankPredictorData);
        if (typeof currentRank === "number" && typeof improvedRank === "number") {
            estimatedImprovementAIR = currentRank - improvedRank;
        }
    }

    const aiRecommendation = {
        weakTopicsText: top2Weak.length > 0 ? top2Weak.join(" and ") : "N/A",
        estimatedMarksLosing,
        totalMarksReference: attempts[0].totalMarks,
        practiceQuestionsCount: totalWrongInWeakAreas,
        weakConceptsCount: weakTopicsCount,
        estimatedImprovementAIR
    };

    const weakAreaData = {
        subjects, topics, subtopics, weakAreas, heatmapRows,
        heatmapCols: allTopicNames,
        focusSubject, focusTopic,
        aiRecommendation,
        topicsBySubject,
        subtopicsByTopic,
        weakAreasAll
    };

    res.render("dashboard/weaakarea", {
        layout: "layouts/dashboard",
        listing, sections,
        currentSection: null,
        isWeakAreaPage: true,
        weakAreaData,
        mockTests: allTests,
        selectedTestId: null
    });
};