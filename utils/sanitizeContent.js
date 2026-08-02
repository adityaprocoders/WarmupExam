import sanitizeHtml from "sanitize-html";

export function sanitizeContent(dirty) {
    if (!dirty) return "";

    return sanitizeHtml(dirty, {
        allowedTags: [
            "div",
            "h1", "h2", "h3", "h4", "h5", "h6",
            "p", "br", "hr",
            "strong", "b", "em", "i", "u", "s", "span", "a",
            "ul", "ol", "li",
            "table", "thead", "tbody", "tfoot", "tr", "th", "td",
            "figure", "figcaption",
            "img",
            "blockquote", "pre", "code"
        ],

        allowedAttributes: {
            "*": ["style", "class"],
            a: ["href", "target", "rel"],
            img: ["src", "alt", "width", "height"],
            table: ["border", "cellpadding", "cellspacing", "width"],
            td: ["colspan", "rowspan", "width", "height"],
            th: ["colspan", "rowspan", "width", "height"]
        },

        // CKEditor table/cell properties inline styles daalta hai — sabko allow karna zaroori hai
        allowedStyles: {
            "*": {
                color: [/^.*$/],
                "background-color": [/^.*$/],
                "background": [/^.*$/],
                "text-align": [/^(left|right|center|justify)$/],
                "vertical-align": [/^(top|middle|bottom|baseline)$/],
                "font-size": [/^.*$/],
                "font-weight": [/^.*$/],
                "font-style": [/^.*$/],
                "text-decoration": [/^.*$/],

                // Table borders/spacing (CKEditor TableProperties/TableCellProperties output)
                "border": [/^.*$/],
                "border-top": [/^.*$/],
                "border-right": [/^.*$/],
                "border-bottom": [/^.*$/],
                "border-left": [/^.*$/],
                "border-color": [/^.*$/],
                "border-style": [/^.*$/],
                "border-width": [/^.*$/],
                "border-collapse": [/^(collapse|separate)$/],

                width: [/^.*$/],
                height: [/^.*$/],
                padding: [/^.*$/],
                "padding-top": [/^.*$/],
                "padding-right": [/^.*$/],
                "padding-bottom": [/^.*$/],
                "padding-left": [/^.*$/],
                margin: [/^.*$/]
            }
        },

        allowedSchemes: ["http", "https", "data"],

        
        allowedSchemesByTag: {
            img: ["http", "https", "data"],
            a: ["http", "https", "mailto", "tel"]
        },

        transformTags: {
            a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" })
        },

         
        disallowedTagsMode: "discard"
    });
}