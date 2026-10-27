// utils/emailTemplates/purchaseEmail.js
// Purchase confirmation email (Test Series / Custom Test / E-Book) - ek hi template, teeno ke liye.
// Pure function: data lo, { subject, html, text } do. Koi DB / network call nahi.

const BRAND = "#4f35e8";
const BASE_URL = process.env.BASE_URL || "https://warmupexam.com";

// ---------- helpers ----------
const esc = (v) =>
    String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

const money = (n) =>
    "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const dateIST = (d) =>
    new Date(d || Date.now()).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
    });

// kind ke hisaab se label, button aur steps
const KIND = {
    testseries: {
        label: "Test Series",
        cta: "Start Practicing",
        steps: [
            "Log in to WarmupExam with this email address.",
            "Open your series from the Dashboard.",
            "Attempt a test, then check your rank and weak-area analysis.",
        ],
    },
    customtest: {
        label: "Custom Test",
        cta: "Open Custom Tests",
        steps: [
            "Log in to WarmupExam with this email address.",
            "Go to Custom Test and create your paper.",
            "Attempt it and get an instant performance report.",
        ],
    },
    ebook: {
        label: "E-Book",
        cta: "Read E-Book",
        steps: [
            "Log in to WarmupExam with this email address.",
            "Open your e-book from the E-Books page.",
            "Read online or download it anytime during your access period.",
        ],
    },
};

/**
 * @param {object} d
 * d.customerName, d.kind ("testseries"|"customtest"|"ebook"), d.productTitle,
 * d.invoiceNo, d.paymentId, d.methodLabel, d.paidAt,
 * d.baseAmount, d.couponCode, d.couponDiscount, d.donation, d.amount,
 * d.expiresAt (Date|null), d.validityDays, d.accessUrl,
 * d.alreadyEnrolled (bool) - user pehle se enrolled tha aur dobara pay kiya
 */
export function buildPurchaseEmail(d) {
    const k = KIND[d.kind] || KIND.testseries;
    const first = esc(String(d.customerName || "there").trim().split(/\s+/)[0] || "there");
    const dup = Boolean(d.alreadyEnrolled);

    const accessLine = dup
        ? "Already enrolled - no new access added"
        : d.expiresAt
            ? `Access valid till ${dateIST(d.expiresAt)}`
            : d.validityDays
                ? `Access for ${d.validityDays} days`
                : "";

    const heading = dup ? "Payment received" : "Payment successful &#127881;";
    const intro = dup
        ? `Hi ${first}, we received your payment, but you were already enrolled in this item, so no extra access was added. Please write to us and we will help with a refund.`
        : `Hi ${first}, your purchase is confirmed and ready to use.`;

    const subject = dup
        ? "Payment received - please contact WarmupExam support"
        : "Payment successful! Your WarmupExam access is ready 🎉";

    // ---------- receipt rows ----------
    const row = (label, value, color = "#0f1129") => `
      <tr>
        <td style="color:#7a7f99;padding:4px 0;">${label}</td>
        <td align="right" style="color:${color};padding:4px 0;">${value}</td>
      </tr>`;

    const topRows = [
        d.invoiceNo ? row("Invoice no", `<span style="font-weight:600;">${esc(d.invoiceNo)}</span>`) : "",
        d.paymentId ? row("Transaction ID", esc(d.paymentId)) : "",
        row("Date", esc(dateIST(d.paidAt))),
        d.methodLabel ? row("Payment method", esc(d.methodLabel)) : "",
    ].join("");

    const amountRows = [
        d.baseAmount != null ? row("Price", money(d.baseAmount), "#5b6078") : "",
        d.couponDiscount > 0
            ? row(`Coupon${d.couponCode ? " (" + esc(d.couponCode) + ")" : ""}`, "- " + money(d.couponDiscount), "#16a34a")
            : "",
        d.donation > 0 ? row("Donation (thank you!)", "+ " + money(d.donation), "#5b6078") : "",
    ].join("");

    const stepCell = (n, text) => `
      <tr>
        <td width="34" valign="top" style="padding-bottom:12px;">
          <div style="width:26px;height:26px;line-height:26px;border-radius:13px;background-color:#eceafd;color:${BRAND};font-size:13px;font-weight:800;text-align:center;">${n}</div>
        </td>
        <td valign="top" style="padding:3px 0 12px 0;font-size:15px;line-height:23px;color:#3d4259;">${esc(text)}</td>
      </tr>`;

    const stepsBlock = dup
        ? ""
        : `
      <tr>
        <td class="px" style="padding:30px 40px 4px 40px;">
          <p style="margin:0 0 14px 0;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#7a7f99;">How to get started</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${k.steps.map((s, i) => stepCell(i + 1, s)).join("")}
          </table>
        </td>
      </tr>`;

    const ctaHref = esc(d.accessUrl || `${BASE_URL}/dashboard`);
    const ctaText = dup ? "Go to Dashboard" : k.cta;

    const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>Purchase confirmed - WarmupExam</title>
<style>
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
  table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;}
  body{margin:0!important;padding:0!important;width:100%!important;}
  a{text-decoration:none;}
  @media only screen and (max-width:620px){
    .container{width:100%!important;}
    .px{padding-left:20px!important;padding-right:20px!important;}
    .btn a{display:block!important;}
    .hero-title{font-size:25px!important;line-height:33px!important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#f1f2fb;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f1f2fb;font-size:1px;line-height:1px;">${esc(k.label)} purchased: ${esc(d.productTitle)}. ${dup ? "Payment received." : "Your access is ready."}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f2fb;">
<tr><td align="center" style="padding:28px 12px 40px 12px;">
<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
<tr><td style="background-color:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e4f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

  <!-- Header -->
  <tr>
    <td class="px" align="center" bgcolor="${BRAND}" style="background-color:${BRAND};background-image:linear-gradient(135deg,#4f35e8 0%,#7c3aed 100%);padding:36px 40px 56px 40px;">
      <a href="${BASE_URL}" target="_blank" style="font-size:24px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;">WarmupExam</a>
      <div style="padding-top:22px;"><span style="display:inline-block;background-color:#7d68f0;color:#ffffff;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:6px 14px;border-radius:999px;">${esc(k.label)}</span></div>
      <h1 class="hero-title" style="margin:16px 0 8px 0;font-size:30px;line-height:38px;font-weight:800;color:#ffffff;">${heading}</h1>
      <p style="margin:0;font-size:15px;line-height:24px;color:#e0defc;">${intro}</p>
    </td>
  </tr>

  <!-- Product card -->
  <tr>
    <td class="px" style="padding:0 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:-32px;background-color:#ffffff;border:1px solid #e2e4f6;border-radius:14px;box-shadow:0 8px 24px rgba(79,53,232,0.12);">
        <tr><td style="padding:20px 22px;">
          <div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#7a7f99;">You purchased</div>
          <div style="padding-top:6px;font-size:19px;line-height:26px;font-weight:800;color:#0f1129;">${esc(d.productTitle)}</div>
          ${accessLine ? `<div style="padding-top:10px;font-size:13px;color:${dup ? "#b45309" : BRAND};font-weight:700;">&#9201; ${esc(accessLine)}</div>` : ""}
        </td></tr>
      </table>
    </td>
  </tr>

  <!-- CTA -->
  <tr>
    <td class="px btn" align="center" style="padding:28px 40px 4px 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td align="center" bgcolor="${BRAND}" style="border-radius:12px;">
          <a href="${ctaHref}" target="_blank" style="display:inline-block;padding:16px 36px;font-size:16px;font-weight:700;color:#ffffff;background-color:${BRAND};border-radius:12px;">${esc(ctaText)} &rarr;</a>
        </td>
      </tr></table>
    </td>
  </tr>

  <!-- Receipt -->
  <tr>
    <td class="px" style="padding:32px 40px 4px 40px;">
      <p style="margin:0 0 12px 0;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#7a7f99;">Payment receipt</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8f9ff;border:1px solid #e2e4f6;border-radius:12px;">
        <tr><td style="padding:18px 22px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;line-height:22px;">
            ${topRows}
            <tr><td colspan="2" style="padding:8px 0 6px 0;border-bottom:1px dashed #cfd2ee;font-size:0;line-height:0;">&nbsp;</td></tr>
            ${amountRows}
            <tr>
              <td style="color:#0f1129;font-size:16px;font-weight:800;padding:14px 0 0 0;">Total paid</td>
              <td align="right" style="color:${BRAND};font-size:20px;font-weight:800;padding:14px 0 0 0;">${money(d.amount)}</td>
            </tr>
          </table>
        </td></tr>
      </table>
    </td>
  </tr>

  ${stepsBlock}

  <!-- Help -->
  <tr>
    <td class="px" style="padding:30px 40px 36px 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef0ff;border-radius:12px;">
        <tr><td style="padding:16px 20px;font-size:14px;line-height:23px;color:#2d2a7a;">
          <strong>Need help with your order?</strong><br />
          Reply to this email or write to <a href="mailto:support@warmupexam.com" style="color:${BRAND};font-weight:700;">support@warmupexam.com</a><br />
          <span style="color:#5b5a9a;">Support hours: 10:00 AM &ndash; 7:00 PM IST</span>
        </td></tr>
      </table>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td class="px" align="center" style="background-color:#111827;padding:30px 40px;">
      <div style="font-size:19px;font-weight:800;color:#ffffff;">WarmupExam</div>
      <div style="padding-top:8px;font-size:13px;line-height:21px;color:#9ca3af;">India's smartest mock test platform. Prepare smarter. Perform better.</div>
      <div style="padding-top:16px;font-size:13px;line-height:22px;">
        <a href="https://www.instagram.com/warmupexam/" target="_blank" style="color:#a5b4fc;font-weight:600;">Instagram</a><span style="color:#4b5563;">&nbsp;&nbsp;|&nbsp;&nbsp;</span>
        <a href="https://www.youtube.com/@WarmupExam" target="_blank" style="color:#a5b4fc;font-weight:600;">YouTube</a><span style="color:#4b5563;">&nbsp;&nbsp;|&nbsp;&nbsp;</span>
        <a href="${BASE_URL}/aboutUs" target="_blank" style="color:#a5b4fc;font-weight:600;">About</a><span style="color:#4b5563;">&nbsp;&nbsp;|&nbsp;&nbsp;</span>
        <a href="${BASE_URL}/contactUs" target="_blank" style="color:#a5b4fc;font-weight:600;">Contact</a>
      </div>
    </td>
  </tr>

</table>
</td></tr>

<tr><td align="center" class="px" style="padding:20px 20px 0 20px;font-size:12px;line-height:20px;color:#8b90a8;">
  You received this email because you made a purchase on <a href="${BASE_URL}" target="_blank" style="color:${BRAND};">warmupexam.com</a>.<br />
  <a href="${BASE_URL}/Terms-&amp;-Conditions" target="_blank" style="color:#8b90a8;">Terms</a> &nbsp;&bull;&nbsp;
  <a href="${BASE_URL}/privacy-Policy" target="_blank" style="color:#8b90a8;">Privacy</a> &nbsp;&bull;&nbsp;
  <a href="${BASE_URL}/help" target="_blank" style="color:#8b90a8;">Help</a><br />
  India, Bihar &nbsp;&bull;&nbsp; &copy; ${new Date().getFullYear()} WarmupExam
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

    // ---------- plain text (deliverability + clients jo HTML nahi dikhate) ----------
    const text = [
        dup ? "Payment received - WarmupExam" : "Payment successful - WarmupExam",
        "",
        `Hi ${String(d.customerName || "there").trim().split(/\s+/)[0] || "there"},`,
        dup
            ? "We received your payment, but you were already enrolled, so no extra access was added. Reply to this email and we will help with a refund."
            : "Your purchase is confirmed and ready to use.",
        "",
        `${k.label}: ${d.productTitle}`,
        accessLine,
        "",
        d.invoiceNo ? `Invoice no: ${d.invoiceNo}` : "",
        d.paymentId ? `Transaction ID: ${d.paymentId}` : "",
        `Date: ${dateIST(d.paidAt)}`,
        d.methodLabel ? `Payment method: ${d.methodLabel}` : "",
        d.couponDiscount > 0 ? `Coupon discount: -${money(d.couponDiscount)}` : "",
        d.donation > 0 ? `Donation: +${money(d.donation)}` : "",
        `Total paid: ${money(d.amount)}`,
        "",
        `${ctaText}: ${d.accessUrl || BASE_URL + "/dashboard"}`,
        "",
        "Need help? support@warmupexam.com (10:00 AM - 7:00 PM IST)",
    ]
        .filter((l, i, a) => l !== "" || a[i - 1] !== "")
        .join("\n");

    return { subject, html, text };
}