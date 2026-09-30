// Usage: router.post("/api/paper/generate", requireTier("pro"), generatePaperController)
//
// Tier hierarchy: free < pro < promax
const TIER_RANK = { free: 0, pro: 1, promax: 2 };

export function requireTier(minTier) {
    return (req, res, next) => {
        const userTier = req.user?.subscriptionTier || "free";

        if (TIER_RANK[userTier] >= TIER_RANK[minTier]) {
            return next();
        }

        return res.status(403).json({
            success: false,
            error: "UPGRADE_REQUIRED",
            requiredTier: minTier,
            message: `This feature needs a ${minTier.toUpperCase()} subscription.`,
        });
    };
}

// Attaches req.userTier so controllers can branch on it without re-checking req.user each time
export function attachTier(req, res, next) {
    req.userTier = req.user?.subscriptionTier || "free";
    next();
}