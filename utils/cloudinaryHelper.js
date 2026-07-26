export function getPublicIdFromUrl(url) {
    if (!url || !url.includes("cloudinary.com")) return null;
    const parts = url.split("/");
    const fileWithExt = parts[parts.length - 1];
    const folder = parts[parts.length - 2];
    const publicId = fileWithExt.split(".")[0];
    return `${folder}/${publicId}`;
}