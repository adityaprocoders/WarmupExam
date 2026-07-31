export function safeJsonStringify(data, replacer = null, space = undefined) {
    return JSON.stringify(data, replacer, space)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026");
}