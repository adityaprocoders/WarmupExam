export function getCustomTestTier(req) {
    if (!req.user) return "free";
    if (req.user.banned) return "free"; 
    if (req.user.role === "owner") return "promax";  
    if (req.user.customTestExpiresAt && new Date(req.user.customTestExpiresAt) < new Date()) return "free";
    return req.user.customTestTier || "free";
}

export function isPaidCustomTestTier(tier) {
    return tier === "pro" || tier === "promax";
}