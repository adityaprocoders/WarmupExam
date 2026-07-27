const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  const statusCode = err.statusCode || 500;
  const message = err.message || "Something went wrong";

  // Production me generic message do (security ke liye), dev me asli message
  const isProd = process.env.NODE_ENV === "production";
  const safeMessage = (statusCode === 500 && isProd)
    ? "Something went wrong on our end. Please try again."
    : message;

  // Agar request AJAX/API hai to JSON bhejo
  if (req.xhr || req.headers.accept?.includes("application/json")) {
    return res.status(statusCode).json({ success: false, message: safeMessage });
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