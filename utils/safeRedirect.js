export function isSafeRedirectPath(value) {
    if (typeof value !== "string") return false;
    if (value.length === 0 || value.length > 2000) return false;
    if (value[0] !== "/") return false;
    if (value[1] === "/" || value[1] === "\\") return false;
    if (/[\\\u0000-\u001f\u007f]/.test(value)) return false;
    try {
        const base = "http://safe.local";
        return new URL(value, base).origin === base;
    } catch {
        return false;
    }
}