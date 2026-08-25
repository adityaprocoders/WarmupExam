// utils/locationPath.js

// Test ke parentType/parentId se upar chal ke folder/file names ka path banata hai
// (Section tak — Section khud path me nahi aata, uska naam alag se dikhta hai)
export async function buildTestLocationPath(test, Folder, File) {
    const path = [];
    let type = test.parentType;
    let id = test.parentId;

    // Safety: infinite loop na ho jaye kabhi galat data ki wajah se
    let guard = 0;

    while ((type === "folder" || type === "file") && id && guard < 20) {
        guard++;

        if (type === "folder") {
            const folder = await Folder.findById(id).select("title parentType parentId");
            if (!folder) break;
            path.unshift(folder.title);
            type = folder.parentType;
            id = folder.parentId;
        } else {
            const file = await File.findById(id).select("title parentType parentId");
            if (!file) break;
            path.unshift(file.title);
            type = file.parentType;
            id = file.parentId;
        }
    }

    return path;
}

// Fix premium color palette — section ke position (order) ke hisab se cycle karega
const SECTION_COLOR_PALETTE = [
    { dot: "bg-indigo-500", text: "text-indigo-600" },
    { dot: "bg-emerald-500", text: "text-emerald-600" },
    { dot: "bg-amber-500", text: "text-amber-600" },
    { dot: "bg-rose-500", text: "text-rose-600" },
    { dot: "bg-violet-500", text: "text-violet-600" },
    { dot: "bg-cyan-500", text: "text-cyan-600" },
];

export function getSectionColor(index) {
    return SECTION_COLOR_PALETTE[index % SECTION_COLOR_PALETTE.length];
}