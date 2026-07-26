 
export function calculateRankFromPredictor(score, rankPredictorData) {
    if (!rankPredictorData || rankPredictorData.length === 0) {
        return { rank: "", totalUsers: "" };
    }

    const sorted = [...rankPredictorData].sort((a, b) => a.marks - b.marks);
    const totalUsers = Math.max(...sorted.map(p => p.rank));

    if (score >= sorted[sorted.length - 1].marks) {
        return { rank: sorted[sorted.length - 1].rank, totalUsers };
    }

    if (score <= sorted[0].marks) {
        return { rank: sorted[0].rank, totalUsers };
    }

    for (let i = 0; i < sorted.length - 1; i++) {
        const lower = sorted[i];
        const upper = sorted[i + 1];

        if (score >= lower.marks && score <= upper.marks) {
            if (upper.marks === lower.marks) return { rank: lower.rank, totalUsers };

            const ratio = (score - lower.marks) / (upper.marks - lower.marks);
            const interpolatedRank = Math.round(lower.rank + ratio * (upper.rank - lower.rank));
            return { rank: interpolatedRank, totalUsers };
        }
    }

    return { rank: "--", totalUsers };
}