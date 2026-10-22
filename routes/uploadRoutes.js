import express from "express";
import { upload } from "../middleware/upload.js";
import { isOwner } from "../middleware/isLoggedIn.js";
import { doubleCsrfProtection } from "../config/csrf.js";

const router = express.Router();

router.post("/api/upload-image", isOwner, doubleCsrfProtection, upload.single("image"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: "Image file zaroori hai" });
    }
    res.status(200).json({ success: true, url: req.file.path });
});

export default router;