(function () {
    "use strict";

    const { pro, promax, activePlan } = JSON.parse(document.getElementById("ctOrderData").textContent);
    const rows = (activePlan === "promax" ? promax : pro).slice().sort((a, b) => a.months - b.months);

    const grid = document.getElementById("ctOrderDurationGrid");
    const payBtn = document.getElementById("ctOrderPayBtn");
    const sumPlan = document.getElementById("ctOrderSumPlan");
    const sumMonths = document.getElementById("ctOrderSumMonths");
    const sumDiscount = document.getElementById("ctOrderSumDiscount");
    const sumTotal = document.getElementById("ctOrderSumTotal");

    const originalHtml = payBtn.innerHTML; // ✅ button ka original text save karo

    let selected = rows.length ? rows[0] : null;

        let couponCode = null, couponDiscount = 0, donation = 0;
    const $ = (id) => document.getElementById(id);

    function renderGrid() {
        if (!rows.length) {
            grid.innerHTML = `<p class="col-span-full text-sm text-gray-400 text-center py-6">No duration is currently available for this plan.</p>`;
            return;
        }
        grid.innerHTML = rows.map((r, i) => {
            const discount = r.originalPrice > r.price ? Math.round((1 - r.price / r.originalPrice) * 100) : 0;
            return `
              <div class="ct-order-duration-card ${i === 0 ? "selected" : ""}" data-months="${r.months}">
                ${discount > 0 ? `<span class="ct-order-save-badge">Save ${discount}%</span>` : ""}
                <p class="text-xs text-gray-400">${r.months} Month${r.months > 1 ? "s" : ""}</p>
                <p class="text-xl font-bold text-gray-900 mt-1">₹${r.price}</p>
                ${discount > 0 ? `<p class="text-[11px] text-gray-300 line-through">₹${r.originalPrice}</p>` : ""}
              </div>`;
        }).join("");

        grid.querySelectorAll(".ct-order-duration-card").forEach(card => {
            card.addEventListener("click", () => {
                grid.querySelectorAll(".ct-order-duration-card").forEach(c => c.classList.remove("selected"));
                card.classList.add("selected");
                selected = rows.find(r => r.months === Number(card.dataset.months));
                                if (couponCode) applyCoupon(couponCode, true); else renderSummary();
                return;
                renderSummary();
            });
        });
    }

       function renderSummary() {
        if (!selected) { payBtn.disabled = true; return; }
        sumPlan.textContent = activePlan === "promax" ? "Pro Max" : "Pro";
        sumMonths.textContent = selected.months + " Month" + (selected.months > 1 ? "s" : "");
        sumDiscount.textContent = "-₹" + Math.max(0, selected.originalPrice - selected.price);
        $("ctSumCoupon").textContent = "-₹" + couponDiscount;
        $("ctSumDonation").textContent = "+₹" + donation;
        $("ctDonationRow").style.display = donation > 0 ? "flex" : "none";
        sumTotal.textContent = "₹" + Math.max(1, selected.price - couponDiscount + donation);
        payBtn.disabled = false;
    }

        async function applyCoupon(code, silent) {
        const btn = $("ctApplyCouponBtn"), msg = $("ctCouponMsg");
        if (!silent) { btn.disabled = true; btn.textContent = "..."; }
        try {
            const res = await fetch("/api/custom-test/payment/apply-coupon", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code, plan: activePlan, months: selected.months }),
            });
            const data = await res.json();
            if (data.success) {
                couponCode = data.code; couponDiscount = data.discount;
                msg.classList.add("hidden");
                $("ctCouponInputBox").classList.add("hidden");
                $("ctCouponApplied").classList.remove("hidden");
                $("ctCouponApplied").classList.add("flex");
                $("ctAppliedCode").textContent = couponCode;
            } else {
                if (silent) removeCoupon(); // duration badalne par coupon ab valid nahi
                msg.textContent = data.message || "Invalid coupon";
                msg.className = "text-xs mt-2 text-red-600";
            }
        } catch (_) {
            msg.textContent = "Something went wrong, try again";
            msg.className = "text-xs mt-2 text-red-600";
        } finally {
            btn.disabled = false; btn.textContent = "APPLY";
            renderSummary();
        }
    }
    function removeCoupon() {
        couponCode = null; couponDiscount = 0;
        $("ctCouponCode").value = "";
        $("ctCouponInputBox").classList.remove("hidden");
        $("ctCouponApplied").classList.add("hidden");
        $("ctCouponApplied").classList.remove("flex");
        renderSummary();
    }
    $("ctApplyCouponBtn").addEventListener("click", () => {
        const c = $("ctCouponCode").value.trim();
        if (c) applyCoupon(c, false);
    });
    $("ctRemoveCouponBtn").addEventListener("click", removeCoupon);

    const dBtns = document.querySelectorAll(".ct-donation-btn");
    const dOn = ["border-indigo-600", "bg-indigo-50"];
    $("ctDonationEnabled").addEventListener("change", function () {
        $("ctDonationOptions").classList.toggle("hidden", !this.checked);
        if (!this.checked) {
            donation = 0; $("ctCustomDonation").value = "";
            dBtns.forEach((b) => b.classList.remove(...dOn));
            renderSummary();
        }
    });
    dBtns.forEach((b) => b.addEventListener("click", () => {
        dBtns.forEach((x) => x.classList.remove(...dOn));
        b.classList.add(...dOn);
        donation = parseInt(b.dataset.amount) || 0;
        $("ctCustomDonation").value = "";
        renderSummary();
    }));
    $("ctCustomDonation").addEventListener("input", function () {
        dBtns.forEach((x) => x.classList.remove(...dOn));
        donation = Math.min(10000, parseInt(this.value) || 0);
        renderSummary();
    });

    // ✅ Payment logic ab button click pe hi chalega, aur async function ke andar hai
    payBtn.addEventListener("click", async function () {
        if (!selected) return;

        payBtn.disabled = true;
        payBtn.innerHTML = "Processing...";

        try {
            const res = await fetch("/api/custom-test/payment/create-order", {
                method: "POST",
                headers: { "Content-Type": "application/json"},
                body: JSON.stringify({ plan: activePlan, months: selected.months, couponCode, donationAmount: donation }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message || "Failed to create the order.");

            const options = {
                key: data.key, amount: data.amount, currency: data.currency,
                name: "WarmupExam", description: data.name, order_id: data.orderId,
                prefill: { name: data.userName, email: data.userEmail, contact: data.userContact },
                theme: { color: "#4f46e5" },
                handler: async function (response) {
                    try {
                        const verifyRes = await fetch("/api/custom-test/payment/verify", {
                            method: "POST",
                            headers: { "Content-Type": "application/json"},
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                plan: activePlan, months: selected.months,
                            }),
                        });
                        const verifyData = await verifyRes.json();
                        if (verifyData.success) {
                            window.location.href = "/custom-test?upgraded=1";
                        } else {
                            showToast(verifyData.message || "Payment verification failed!", "error");
                            payBtn.disabled = false;
                            payBtn.innerHTML = originalHtml;
                        }
                    } catch (err) {
                       showToast("Verification failed. If money was deducted, please contact support.", "error");
                        payBtn.disabled = false;
                        payBtn.innerHTML = originalHtml;
                    }
                },
                modal: { ondismiss: function () { payBtn.disabled = false; payBtn.innerHTML = originalHtml; } },
            };

            new Razorpay(options).open();
        } catch (err) {
           showToast("Something went wrong: " + err.message, "error");
            payBtn.disabled = false;
            payBtn.innerHTML = originalHtml;
        }
    });

    renderGrid();
    renderSummary();
})();