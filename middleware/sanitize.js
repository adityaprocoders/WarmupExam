import xss from "xss";
 
const SKIP_FIELDS = ["description", "html"];

function sanitizeObject(obj) {
    if (obj && typeof obj === "object") {
        for (const key in obj) {
            // Prototype pollution + Mongo operator injection block
            if (/^\$/.test(key) || key.includes(".") || key === "__proto__" || key === "constructor" || key === "prototype") {
                delete obj[key];
                continue;
            }

            // Rich text fields ko yahan skip karo — ye alag se
            // (utils/sanitizeContent.js) via sanitize-html clean honge
            if (SKIP_FIELDS.includes(key)) {
                continue;
            }

            if (typeof obj[key] === "string") {
                // XSS sanitize - HTML/script tags clean karo
                obj[key] = xss(obj[key]);
            } else if (typeof obj[key] === "object") {
                sanitizeObject(obj[key]);
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