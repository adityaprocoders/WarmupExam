// utils/sendPurchaseEmail.js
// PaymentRecord se purchase confirmation email bhejta hai.
// - Kabhi throw nahi karta (email fail hone se payment/enrollment par asar nahi padna chahiye)
// - Atomic claim (emailSentAt) se ek payment par ek hi email jaati hai, chahe verify + webhook dono chalein
import resend from "./mailer.js";
import PaymentRecord from "../models/PaymentRecord.js";
import Listing from "../models/listing.js";
import Ebook from "../models/Ebook.js";
import { buildPurchaseEmail } from "./emailTemplates/purchaseEmail.js";

const BASE_URL = process.env.BASE_URL || "https://warmupexam.com";

async function resolveAccessUrl(rec) {
    try {
        if (rec.kind === "testseries" && rec.itemId) {
            const l = await Listing.findById(rec.itemId).select("slug").lean();
            if (l?.slug) return `${BASE_URL}/series/${l.slug}`;
        }
        if (rec.kind === "ebook" && rec.itemId) {
            const e = await Ebook.findById(rec.itemId).select("slug").lean();
            if (e?.slug) return `${BASE_URL}/ebooks/${e.slug}`;
        }
        if (rec.kind === "customtest") return `${BASE_URL}/custom-test`;
    } catch (err) {
        console.error("[PurchaseEmail] access url lookup failed:", err.message);
    }
    return `${BASE_URL}/dashboard`;
}

/**
 * @param {string} orderId  Razorpay order id (PaymentRecord.orderId)
 * @param {{ force?: boolean }} opts  force=true: pehle bhej chuke ho tab bhi dobara bhejo (owner "resend" ke liye)
 */
export async function sendPurchaseEmail(orderId, { force = false } = {}) {
    let claimedId = null;
    try {
        if (!process.env.RESEND_API_KEY) return { sent: false, reason: "no_api_key" };

        // Atomic claim: sirf ek caller aage badhega
        const rec = force
            ? await PaymentRecord.findOneAndUpdate({ orderId }, { $set: { emailSentAt: new Date() } }, { new: true })
            : await PaymentRecord.findOneAndUpdate(
                { orderId, emailSentAt: null },
                { $set: { emailSentAt: new Date() } },
                { new: true }
            );

        if (!rec) return { sent: false, reason: "already_sent_or_missing" };
        claimedId = rec._id;

        if (!rec.userEmail) {
            await PaymentRecord.updateOne({ _id: rec._id }, { $set: { emailSentAt: null } });
            return { sent: false, reason: "no_email" };
        }

        const methodLabel = [rec.methodType, rec.methodDetail].filter(Boolean).join(" - ");
        const alreadyEnrolled = rec.kind === "testseries" && !rec.expiresAt;

        const { subject, html, text } = buildPurchaseEmail({
            customerName: rec.userName,
            kind: rec.kind,
            productTitle: rec.itemTitle,
            invoiceNo: rec.invoiceNo,
            paymentId: rec.paymentId,
            methodLabel,
            paidAt: rec.paidAt,
            baseAmount: rec.baseAmount,
            couponCode: rec.couponCode,
            couponDiscount: rec.couponDiscount,
            donation: rec.donation,
            amount: rec.amount,
            expiresAt: rec.expiresAt,
            validityDays: rec.validityDays,
            accessUrl: await resolveAccessUrl(rec),
            alreadyEnrolled,
        });

        const sender = process.env.PURCHASE_SENDER_EMAIL || process.env.CONTACT_SENDER_EMAIL;
        const { error } = await resend.emails.send({
            from: `WarmupExam <${sender}>`,
            to: [rec.userEmail],
            replyTo: process.env.SUPPORT_EMAIL || "support@warmupexam.com",
            subject,
            html,
            text,
        });

        if (error) {
            const e = new Error(error.message || JSON.stringify(error));
            // Resend: daily/monthly quota ya rate limit (429)
            e.quota = error.name === "daily_quota_exceeded" || error.name === "monthly_quota_exceeded" || error.statusCode === 429;
            throw e;
        }
        return { sent: true };
    } catch (err) {
        console.error("[PurchaseEmail] FAILED:", orderId, err.message);
        // claim wapas kholo taaki baad me dobara bheja ja sake
        if (claimedId) {
            await PaymentRecord.updateOne({ _id: claimedId }, { $set: { emailSentAt: null } }).catch(() => {});
        }
        return { sent: false, reason: err.quota ? "quota" : "error" };
    }
}

/**
 * Jin paid records ki purchase email nahi gayi (emailSentAt null), unhe dobara bhejta hai.
 * Sirf purchase email ke liye. Quota phir bhi khatam ho to turant ruk jata hai.
 */
export async function retryPendingPurchaseEmails({ limit = 20, maxAgeDays = 2, minAgeMinutes = 5 } = {}) {
    if (!process.env.RESEND_API_KEY) return { tried: 0, sent: 0 };

    const now = Date.now();
    const pending = await PaymentRecord.find({
        emailSentAt: null,
        status: "success",
        userEmail: { $nin: ["", null] },
        createdAt: {
            $gte: new Date(now - maxAgeDays * 24 * 60 * 60 * 1000),
            $lte: new Date(now - minAgeMinutes * 60 * 1000),
        },
    }).sort({ createdAt: 1 }).limit(limit).select("orderId").lean();

    let sent = 0;
    for (const p of pending) {
        const r = await sendPurchaseEmail(p.orderId);
        if (r.sent) sent++;
        if (r.reason === "quota") break;                       // limit abhi bhi khatam hai, aage mat badho
        await new Promise((res) => setTimeout(res, 300));      // Resend rate limit (10/sec) se door raho
    }
    return { tried: pending.length, sent };
}