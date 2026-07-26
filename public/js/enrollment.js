async function enrollNow(listingId, isLoggedIn) {
    if (!isLoggedIn) {
        openAuthModal('login');
        return;
    }

    try {
        const res = await fetch(`/enroll/${listingId}`, { method: "POST" });
        const data = await res.json();

        if (data.success) {
            // Redirect nahi, sirf reload — taaki button "Start Test" ban jaye aur flash dikhe
            window.location.reload();
        } else {
             hideLoader(); 
            alert(data.message || "Enroll nahi ho paya");
        }
    } catch (err) {
         hideLoader(); 
        alert("Kuch galat ho gaya, dobara try karo");
    }
}
 

function buyNow(listingId, isLoggedIn) {
    if (!isLoggedIn) {
        openAuthModal('login');
        return;
    }
    window.location.href = `/order-summary/${listingId}`;
}