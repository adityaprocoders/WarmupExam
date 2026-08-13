import multer from "multer";
import { Readable } from "stream";
import cloudinary from "../config/cloudinary.js";

function makeCloudinaryStorage(folder, transformation) {
    return {
        _handleFile(req, file, cb) {
            const uploadStream = cloudinary.uploader.upload_stream(
                { folder, transformation },
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