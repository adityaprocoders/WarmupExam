// utils/aboutTestSeries.js
const FIXED_TOP = [
    {
        icon: "fa-solid fa-tower-broadcast",
        title: "Live Test",
        text: "Attempt tests based on the actual exam pattern with real timing and marks distribution, then get instant analysis with leaderboard and rank — available for 24 hours.",
    },
    {
        icon: "fa-solid fa-fire",
        title: "Daily Warmup",
        text: "Get 10 questions every day for 10 minutes, personalized based on your weak areas and previously wrong question topics.",
    },
];

const FIXED_BOTTOM = [
    {
        icon: "fa-solid fa-chart-column",
        title: "Performance Analysis",
        text: "Track your attempted tests, average score, accuracy, and percentile comparison, along with subject and topic-wise weak area analysis to know exactly where you're losing marks.",
    },
    {
        icon: "fa-solid fa-headset",
        title: "24x7 Support",
        text: "Get help whenever you need it from our dedicated support team.",
    },
];

export async function buildAboutTestSeries(listingId, Section, Test) {
    const sections = await Section.find({ listing: listingId }).sort({ order: 1 });

    const testCounts = await Test.aggregate([
        { $match: { listing: listingId } },
        { $group: { _id: "$section", count: { $sum: 1 } } },
    ]);
    const countMap = {};
    testCounts.forEach(t => { countMap[String(t._id)] = t.count; });

    const dynamicItems = sections.map(sec => ({
        icon: sec.icon,
        title: sec.title,
        text: `${countMap[String(sec._id)] || 0} ${sec.unit}`,
    }));

    return [...FIXED_TOP, ...dynamicItems, ...FIXED_BOTTOM];
}