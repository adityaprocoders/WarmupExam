const errorHandler = (err, req, res, next) => {
  if (err.code === "EBADCSRFTOKEN" || err.message === "invalid csrf token") {
     req.flash("error", "Your session has expired. Please try again.");
    return res.redirect(req.get("Referer") || "/");
  }

  if (err.name === "CastError") {
    err.statusCode = 404;
    err.message = "Not found";
  } else if (err.name === "MulterError") {
    err.statusCode = 400;
    err.message = err.code === "LIMIT_FILE_SIZE" ? "File is too large (max 5MB)." : "Invalid file upload.";
  } else if (err.message && /^(Invalid file type|Cover image must|E-Book file must|Unexpected field)/.test(err.message)) {
    err.statusCode = 400;
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || "Something went wrong";

  if (statusCode >= 400) {
    res.set("X-Robots-Tag", "noindex, nofollow");
  }
 
  
  if (statusCode >= 500) {
    console.error("🔴 SERVER ERROR:", err);
  }

  const safeMessage = statusCode >= 500
    ? "Something went wrong on our end. Please try again."
    : message;

  // Agar request AJAX/API hai to JSON bhejo
  if (req.originalUrl.startsWith("/api/") || req.xhr || req.headers.accept?.includes("application/json")) {    return res.status(statusCode).json({ success: false, message: safeMessage });
  }

  // 404 (Not Found) ke liye alag page — behtar UX
  if (statusCode === 404) {
    return res.status(404).render("pages/404", { layout: false });
  }

  // Flash + redirect (chhote errors ke liye, jaise form validation)
  // Sirf 400 range ke errors (client mistakes) ke liye use karo
  if (statusCode < 500 && typeof req.flash === "function" && req.get("Referer")) {
    req.flash("error", safeMessage);
    return res.redirect(req.get("Referer"));
  }

  // Server errors (500) ya jab flash available nahi — direct error page dikhao
  res.status(statusCode).render("pages/error", { message: safeMessage, layout: false });
};

export default errorHandler;