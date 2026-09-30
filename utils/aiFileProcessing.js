import sharp from "sharp";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const MAX_IMAGE_WIDTH = 1024;
const JPEG_QUALITY = 75;

// Image buffer ko resize+compress karke base64 banata hai (token-saving)
async function compressImageToBase64(buffer) {
    const out = await sharp(buffer)
        .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY })
        .toBuffer();
    return out.toString("base64");
}

// Multer files (images) -> [{ mimeType, data }]
export async function processImageFiles(files) {
    const results = [];
    for (const f of files) {
        const base64 = await compressImageToBase64(f.buffer);
        results.push({ mimeType: "image/jpeg", data: base64 });
    }
    return results;
}

// PDF buffer -> { mode: "text", text } ya throws error agar scanned PDF ho
export async function processPDFFile(buffer) {
    const parsed = await pdfParse(buffer);
    const text = (parsed.text || "").trim();

    if (text.length > 60) {
        return { mode: "text", text: text.slice(0, 20000) }; // safety cap
    }

    // Text nahi mila — likely scanned/image-based PDF
    const err = new Error("SCANNED_PDF_NOT_SUPPORTED");
    err.code = "SCANNED_PDF_NOT_SUPPORTED";
    throw err;
}