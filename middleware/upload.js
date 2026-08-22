import multer from "multer";
import { Readable } from "stream";
import cloudinary from "../config/cloudinary.js";

function addAutoFormat(secureUrl) {
    return secureUrl.replace("/upload/", "/upload/f_auto,q_auto/");
}


function makeCloudinaryStorage(folder, transformation) {
    return {
        _handleFile(req, file, cb) {
            const uploadStream = cloudinary.uploader.upload_stream(
                { folder, transformation },
                (error, result) => {
                    if (error) return cb(error);
                    cb(null, {
                        path: addAutoFormat(result.secure_url),
                        filename: result.public_id,
                        size: result.bytes,
                    });
                }
            );
            file.stream.pipe(uploadStream);
        },
        _removeFile(req, file, cb) {
            cloudinary.uploader.destroy(file.filename, cb);
        },
    };
}

const listingStorage = makeCloudinaryStorage("warmupexam/listings", [{ width: 1200, crop: "limit" }]);
const avatarStorage = makeCloudinaryStorage("warmupexam/avatars", [{ width: 400, height: 400, crop: "fill", gravity: "face" }]);



const imageFileFilter = (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
        return cb(new Error("Invalid file type. Only JPEG, PNG, WEBP allowed"));
    }
    cb(null, true);
};

export const upload = multer({
    storage: listingStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: imageFileFilter         
});

export const uploadAvatar = multer({
    storage: avatarStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: imageFileFilter      
});


// ---------------- EBOOK STORAGE ----------------

// Cover image — same jaisa listing image
const ebookCoverStorage = makeCloudinaryStorage("warmupexam/ebooks/covers", [{ width: 800, crop: "limit" }]);

// PDF file — resource_type "raw" zaroori hai warna Cloudinary corrupt/reject kar sakta hai
function makeCloudinaryRawStorage(folder) {
    return {
        _handleFile(req, file, cb) {
            const uploadStream = cloudinary.uploader.upload_stream(
                { folder, resource_type: "raw" },
                (error, result) => {
                    if (error) return cb(error);
                    cb(null, {
                        path: result.secure_url,
                        filename: result.public_id,
                        size: result.bytes,
                    });
                }
            );
            file.stream.pipe(uploadStream);
        },
        _removeFile(req, file, cb) {
            cloudinary.uploader.destroy(file.filename, { resource_type: "raw" }, cb);
        },
    };
}
const ebookFileStorage = makeCloudinaryRawStorage("warmupexam/ebooks/files");

// Combined storage — fieldname ke hisaab se decide karega kaunsa storage use karna hai
const ebookCombinedStorage = {
    _handleFile(req, file, cb) {
        const target = file.fieldname === "ebookFile" ? ebookFileStorage : ebookCoverStorage;
        target._handleFile(req, file, cb);
    },
    _removeFile(req, file, cb) {
        const target = file.fieldname === "ebookFile" ? ebookFileStorage : ebookCoverStorage;
        target._removeFile(req, file, cb);
    },
};

const ebookFileFilter = (req, file, cb) => {
    if (file.fieldname === "coverImage") {
        const allowed = ["image/jpeg", "image/png", "image/webp"];
        if (!allowed.includes(file.mimetype)) {
            return cb(new Error("Cover image must be JPEG, PNG or WEBP"));
        }
        return cb(null, true);
    }
    if (file.fieldname === "ebookFile") {
        if (file.mimetype !== "application/pdf") {
            return cb(new Error("E-Book file must be a PDF"));
        }
        return cb(null, true);
    }
    cb(new Error("Unexpected field"));
};

export const uploadEbook = multer({
    storage: ebookCombinedStorage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB — PDF ke liye zyada rakha
    fileFilter: ebookFileFilter,
});