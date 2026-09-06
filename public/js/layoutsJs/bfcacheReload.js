window.addEventListener('pageshow', function (event) {
    if (!event.persisted) return;

    // Sirf un pages pe reload karo jaha stale/cached form dikhna problem create karega
    // (jaise test-builder — jaha submit ke baad purana form cache se dikh sakta hai).
    // Baaki normal list/dashboard pages ke liye bfcache restore hi behtar hai —
    // isse "back" button ek hi click me kaam karega, reload nahi hoga.
    const reloadOnBfcachePaths = ['/test-builder'];

    const shouldReload = reloadOnBfcachePaths.some(prefix =>
        window.location.pathname.startsWith(prefix)
    );

    if (shouldReload) {
        window.location.reload();
    }
});