const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  const statusCode = err.statusCode || 500;
  const message = err.message || "Something went wrong";

  // Agar request AJAX/API hai to JSON bhejo
  if (req.xhr || req.headers.accept?.includes("application/json")) {
    return res.status(statusCode).json({ success: false, message });
  }

  // Normal browser request
  if (typeof req.flash === "function") {
    req.flash("error", message);
    return res.redirect(req.get("Referer") || "/");
  }

  // Agar flash available nahi hai (session/flash se pehle error aaya)
  res.status(statusCode).render("error", { message });
};

export default errorHandler;