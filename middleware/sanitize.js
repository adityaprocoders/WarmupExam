import xss from "xss";

function sanitizeObject(obj, depth = 0) {
    if (depth > 10) return obj;
    if (obj && typeof obj === "object") {
        for (const key in obj) {
            if (/^\$/.test(key) || key.includes(".") || key === "__proto__" || key === "constructor" || key === "prototype") {
                delete obj[key];
                continue;
            }

            if (typeof obj[key] === "string") {
                obj[key] = xss(obj[key]);
            } else if (typeof obj[key] === "object") {
                sanitizeObject(obj[key], depth + 1);
            }
        }
    }
    return obj;
}

export default function sanitizeMiddleware(req, res, next) {
    if (req.body) sanitizeObject(req.body);
    if (req.params) sanitizeObject(req.params);
    if (req.query) sanitizeObject(req.query);
    next();
}