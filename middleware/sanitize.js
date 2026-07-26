function sanitizeObject(obj) {
    if (obj && typeof obj === "object") {
        for (const key in obj) {
            if (/^\$/.test(key) || key.includes(".")) {
                delete obj[key];
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
    // req.query ko Express 5 mein reassign nahi karte, sirf uske andar ke keys clean karte hain
    if (req.query) sanitizeObject(req.query);
    next();
}