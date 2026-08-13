const BASE_PRICE = Number(document.getElementById('orderConfig').dataset.basePrice);
let selectedDonation = 0;

const donationCheckbox = document.getElementById("donationEnabled");
const donationOptions = document.getElementById("donationOptions");
const donationBtns = document.querySelectorAll(".donation-btn");
const customDonationInput = document.getElementById("customDonation");

const sumDonation = document.getElementById("sumDonation");
const sumTotal = document.getElementById("sumTotal");
const donationRow = document.getElementById("donationRow");
const sumCoupon = document.getElementById("sumCoupon");

let appliedCouponCode = null;
let appliedCouponDiscount = 0;
let appliedCouponId = null;

const proceedBtn = document.getElementById("proceedBtn");
const listingId = proceedBtn?.dataset.id;

function updateTotal() {
    const total = Math.max(1, BASE_PRICE - appliedCouponDiscount + selectedDonation);
    sumTotal.innerText = total;
    sumDonation.innerText = selectedDonation;
    sumCoupon.innerText = appliedCouponDiscount;
    donationRow.style.display = selectedDonation > 0 ? "flex" : "none";
}

// ---------------- Donation ----------------
donationCheckbox?.addEventListener("change", function () {
    donationOptions.classList.toggle("hidden", !this.checked);
    if (!this.checked) {
        selectedDonation = 0;
        customDonationInput.value = "";
        donationBtns.forEach(b => b.classList.remove("border-indigo-600", "bg-indigo-50"));
        updateTotal();
    }
});

donationBtns.forEach(btn => {
    btn.addEventListener("click", function () {
        donationBtns.forEach(b => b.classList.remove("border-indigo-600", "bg-indigo-50"));
        this.classList.add("border-indigo-600", "bg-indigo-50");
        selectedDonation = parseInt(this.dataset.amount);
        customDonationInput.value = "";
        updateTotal();
    });
});

customDonationInput?.addEventListener("input", function () {
    donationBtns.forEach(b => b.classList.remove("border-indigo-600", "bg-indigo-50"));
    selectedDonation = parseInt(this.value) || 0;
    updateTotal();
});

// ---------------- Coupon ----------------
const applyCouponBtn = document.getElementById("applyCouponBtn");
const couponCodeInput = document.getElementById("couponCode");
const couponMsg = document.getElementById("couponMsg");
const couponInputBox = document.getElementById("couponInputBox");
const couponApplied = document.getElementById("couponApplied");
const appliedCouponCodeText = document.getElementById("appliedCouponCode");
const removeCouponBtn = document.getElementById("removeCouponBtn");

applyCouponBtn?.addEventListener("click", async function () {
    const code = couponCodeInput.value.trim();
    if (!code) return;

    applyCouponBtn.disabled = true;
    applyCouponBtn.innerText = "...";

    try {
        const res = await fetch("/apply-coupon", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ code, listingId, cartAmount: BASE_PRICE + selectedDonation })
        });
        const data = await res.json();

        couponMsg.classList.remove("hidden");

        if (data.success) {
            appliedCouponDiscount = data.discount;
            appliedCouponCode = code.toUpperCase();

            couponMsg.classList.add("hidden");
            couponInputBox.classList.add("hidden");
            couponApplied.classList.remove("hidden");
            appliedCouponCodeText.innerText = appliedCouponCode;

            updateTotal();
        } else {
            couponMsg.innerText = data.message || "Invalid coupon";
            couponMsg.className = "text-xs mt-2 text-red-600";
        }
    } catch (err) {
        couponMsg.classList.remove("hidden");
        couponMsg.innerText = "Something went wrong, try again";
        couponMsg.className = "text-xs mt-2 text-red-600";
    } finally {
        applyCouponBtn.disabled = false;
        applyCouponBtn.innerText = "APPLY";
    }
});

removeCouponBtn?.addEventListener("click", function () {
    appliedCouponDiscount = 0;
    appliedCouponCode = null;
    couponCodeInput.value = "";
    couponInputBox.classList.remove("hidden");
    couponApplied.classList.add("hidden");
    updateTotal();
});

// ---------------- Razorpay Checkout ----------------
proceedBtn?.addEventListener("click", async function () {
    const btn = this;
    btn.disabled = true;
    btn.innerText = "Processing...";

    try {
        const res = await fetch("/create-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                listingId,
                donationAmount: selectedDonation,
                couponCode: appliedCouponCode
            })
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        const options = {
            key: data.key,
            amount: data.amount,
            currency: data.currency,
            name: "WarmupExam",
            description: data.name,
            order_id: data.orderId,
            prefill: {
                name: data.userName,
                email: data.userEmail,
                contact: data.userContact
            },
            theme: { color: "#4F46E5" },
            config: {
                display: {
                    blocks: {
                        banks: {
                            name: "Pay via UPI/Card/Netbanking",
                            instruments: [
                                { method: "upi" },
                                { method: "card" },
                                { method: "netbanking" }
                            ]
                        }
                    },
                    sequence: ["block.banks"],
                    preferences: { show_default_blocks: false }
                }
            },
            handler: async function (response) {
                const verifyRes = await fetch("/verify-payment", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_signature: response.razorpay_signature,
                        listingId,
                        couponId: data.couponId
                    })
                });

                const verifyData = await verifyRes.json();
                if (verifyData.success) {
                    window.location.href = `/series/${verifyData.slug}`;
                } else {
                    alert("Payment verification failed!");
                }
            },
            modal: {
                ondismiss: function () {
                    btn.disabled = false;
                    btn.innerText = "PROCEED TO BUY";
                }
            }
        };

        const rzp = new Razorpay(options);
        rzp.open();

    } catch (err) {
        alert("Something went wrong: " + err.message);
        btn.disabled = false;
        btn.innerText = "PROCEED TO BUY";
    }
});