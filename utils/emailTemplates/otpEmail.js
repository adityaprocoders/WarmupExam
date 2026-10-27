// utils/emailTemplates/otpEmail.js
// Forgot-password OTP email. Pure function: { subject, html, text } return karta hai.

const BRAND = "#4f35e8";
const BASE_URL = process.env.BASE_URL || "https://warmupexam.com";

const esc = (v) =>
    String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

/**
 * @param {object} d
 * d.otp (string), d.resetLink (string), d.expiresInMinutes (number, default 5), d.name (optional)
 */
export function buildOtpEmail({ otp, resetLink, expiresInMinutes = 5, name = "" }) {
    const first = String(name || "").trim().split(/\s+/)[0];
    const hello = first ? `Hi ${esc(first)},` : "Hi,";
    const code = String(otp || "").replace(/\D/g, "");

    const boxes = code
        .split("")
        .map(
            (ch) => `<td align="center" width="44" style="width:44px;height:54px;background-color:#ffffff;border:2px solid #d9d6fb;border-radius:10px;font-family:'Courier New',Courier,monospace;font-size:28px;font-weight:800;color:${BRAND};">${esc(ch)}</td><td width="8" style="width:8px;font-size:0;line-height:0;">&nbsp;</td>`
        )
        .join("");

    const subject = `${code} is your WarmupExam password reset code`;

    const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>Reset your password - WarmupExam</title>
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
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f1f2fb;font-size:1px;line-height:1px;">Your password reset code is ${esc(code)}. It expires in ${esc(expiresInMinutes)} minutes.&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f2fb;">
<tr><td align="center" style="padding:28px 12px 40px 12px;">
<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
<tr><td style="background-color:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e4f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

  <!-- Header -->
  <tr>
    <td class="px" align="center" bgcolor="${BRAND}" style="background-color:${BRAND};background-image:linear-gradient(135deg,#4f35e8 0%,#7c3aed 100%);padding:36px 40px 40px 40px;">
      <a href="${BASE_URL}" target="_blank" style="font-size:24px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;">WarmupExam</a>
      <div style="padding-top:22px;">
        <div style="width:60px;height:60px;line-height:60px;border-radius:30px;background-color:#7d68f0;color:#ffffff;font-size:28px;text-align:center;margin:0 auto;">&#128274;</div>
      </div>
      <h1 class="hero-title" style="margin:16px 0 8px 0;font-size:30px;line-height:38px;font-weight:800;color:#ffffff;">Reset your password</h1>
      <p style="margin:0;font-size:15px;line-height:24px;color:#e0defc;">We received a request to reset your WarmupExam password.</p>
    </td>
  </tr>

  <!-- Body -->
  <tr>
    <td class="px" style="padding:32px 40px 8px 40px;">
      <p style="margin:0 0 6px 0;font-size:16px;line-height:26px;color:#0f1129;font-weight:600;">${hello}</p>
      <p style="margin:0;font-size:15px;line-height:24px;color:#4b5068;">Tap the button below to choose a new password. The link works for the next <strong>${esc(expiresInMinutes)} minutes</strong>.</p>
    </td>
  </tr>

  <!-- Button -->
  <tr>
    <td class="px btn" align="center" style="padding:24px 40px 8px 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td align="center" bgcolor="${BRAND}" style="border-radius:12px;">
          <a href="${esc(resetLink)}" target="_blank" style="display:inline-block;padding:16px 40px;font-size:16px;font-weight:700;color:#ffffff;background-color:${BRAND};border-radius:12px;">Reset Password &rarr;</a>
        </td>
      </tr></table>
    </td>
  </tr>

  <!-- Divider -->
  <tr>
    <td class="px" style="padding:24px 40px 0 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="border-top:1px solid #e2e4f6;font-size:0;line-height:0;" width="42%">&nbsp;</td>
        <td align="center" style="padding:0 10px;font-size:12px;font-weight:700;letter-spacing:1px;color:#a0a4bd;white-space:nowrap;">OR USE CODE</td>
        <td style="border-top:1px solid #e2e4f6;font-size:0;line-height:0;" width="42%">&nbsp;</td>
      </tr></table>
    </td>
  </tr>

  <!-- OTP -->
  <tr>
    <td class="px" align="center" style="padding:20px 40px 8px 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8f9ff;border:1px solid #e2e4f6;border-radius:14px;">
        <tr><td align="center" style="padding:22px 12px;">
          <p style="margin:0 0 14px 0;font-size:13px;color:#7a7f99;">Enter this code on the WarmupExam website</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>${boxes}</tr></table>
          <p style="margin:14px 0 0 0;font-size:13px;color:#b45309;font-weight:600;">&#9201; Expires in ${esc(expiresInMinutes)} minutes</p>
        </td></tr>
      </table>
    </td>
  </tr>

  <!-- Security note -->
  <tr>
    <td class="px" style="padding:20px 40px 36px 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fff7ed;border-radius:12px;">
        <tr><td style="padding:16px 20px;font-size:14px;line-height:22px;color:#7c2d12;">
          <strong>Didn't request this?</strong> You can safely ignore this email &mdash; your password will not change.<br />
          <span style="color:#9a3412;">For your safety, never share this code with anyone. WarmupExam will never ask for it.</span>
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
        <a href="${BASE_URL}/help" target="_blank" style="color:#a5b4fc;font-weight:600;">Help</a><span style="color:#4b5563;">&nbsp;&nbsp;|&nbsp;&nbsp;</span>
        <a href="${BASE_URL}/contactUs" target="_blank" style="color:#a5b4fc;font-weight:600;">Contact</a>
      </div>
    </td>
  </tr>

</table>
</td></tr>

<tr><td align="center" class="px" style="padding:20px 20px 0 20px;font-size:12px;line-height:20px;color:#8b90a8;">
  This is an automated security email from <a href="${BASE_URL}" target="_blank" style="color:${BRAND};">warmupexam.com</a>.<br />
  India, Bihar &nbsp;&bull;&nbsp; &copy; ${new Date().getFullYear()} WarmupExam
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

    const text = [
        "Reset your WarmupExam password",
        "",
        hello,
        `Use this link within ${expiresInMinutes} minutes:`,
        resetLink,
        "",
        `Or enter this code on the website: ${code}`,
        "",
        "Didn't request this? Ignore this email - your password will not change.",
        "Never share this code with anyone.",
    ].join("\n");

    return { subject, html, text };
}