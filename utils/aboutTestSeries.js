// utils/aboutTestSeries.js
const FIXED_TOP = [
    {
        icon: "fa-solid fa-fire",
        title: "Daily Warmup",
        text: "Daily test to keep you consistent and improve your preparation.",
    },
];

const FIXED_BOTTOM = [
    {
        icon: "fa-solid fa-chart-column",
        title: "Performance Analysis",
        text: "Track your tests attempted, average score, accuracy, percentile, performance growth, and recent activity in one place.",
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