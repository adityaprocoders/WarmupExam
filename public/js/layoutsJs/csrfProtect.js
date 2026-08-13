 
    (function () {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
        if (!csrfToken) return;

        // 1. Saare HTML <form> submissions ko automatically CSRF token de do
        document.addEventListener("submit", function (e) {
            const form = e.target;
            if (form.tagName !== "FORM") return;
            if (form.querySelector('input[name="_csrf"]')) return; // pehle se hai to skip

            const input = document.createElement("input");
            input.type = "hidden";
            input.name = "_csrf";
            input.value = csrfToken;
            form.appendChild(input);
        });

        // 2. Saare fetch() calls ko automatically CSRF header de do
        const originalFetch = window.fetch;
        window.fetch = function (url, options = {}) {
            try {
                const method = (options.method || "GET").toUpperCase();
                const isStateChanging = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
                const isSameOrigin = typeof url === "string" && !/^([a-z]+:)?\/\//i.test(url);

                if (isStateChanging && isSameOrigin) {
                    options.headers = options.headers || {};
                    if (!options.headers["x-csrf-token"]) {
                        options.headers["x-csrf-token"] = csrfToken;
                    }
                }
            } catch (err) {
                // agar url malformed ho ya Request object ho, fetch ko fail mat hone do
            }

            return originalFetch(url, options);
        };
    })();
 