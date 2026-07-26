export const validateBody = (schema, key = null) => {
    return (req, res, next) => {
        const dataToValidate = key ? req.body[key] : req.body;

        const { error, value } = schema.validate(dataToValidate, { abortEarly: false, stripUnknown: true });

        if (error) {
            const message = error.details.map(d => d.message).join(", ");
            if (req.xhr || req.headers.accept?.includes("json") || req.is("json")) {
                return res.status(400).json({ success: false, message });
            }
            req.flash("error", message);
            return res.redirect(req.get("Referer") || "/");
        }

        if (key) {
            req.body[key] = value; // sirf nested part update karo
        } else {
            req.body = value;
        }
        next();
    };
};