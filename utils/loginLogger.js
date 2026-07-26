import resend from "./mailer.js";
import LoginHistory from "../models/LoginHistory.js";

function parseDevice(userAgent = "") {
  let browser = "Unknown Browser";
  let os = "Unknown OS";

  if (userAgent.includes("Chrome")) browser = "Chrome";
  else if (userAgent.includes("Firefox")) browser = "Firefox";
  else if (userAgent.includes("Safari")) browser = "Safari";
  else if (userAgent.includes("Edg")) browser = "Edge";

  if (userAgent.includes("Windows")) os = "Windows";
  else if (userAgent.includes("Mac")) os = "MacOS";
  else if (userAgent.includes("Android")) os = "Android";
  else if (userAgent.includes("iPhone")) os = "iOS";
  else if (userAgent.includes("Linux")) os = "Linux";

  return `${browser} on ${os}`;
}

export async function logOwnerLogin(req, owner) {
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.socket.remoteAddress;
  const userAgent = req.headers["user-agent"] || "";
  const device = parseDevice(userAgent);

  let location = "Unknown";
  try {
    const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
    const geoData = await geoRes.json();
    if (geoData?.city) location = `${geoData.city}, ${geoData.country_name}`;
  } catch (e) {
    // geo fail ho to ignore
  }

  try {
    await LoginHistory.create({ ownerEmail: owner.email, ipAddress: ip, userAgent, device, location });
  } catch (err) {
    console.error("Login history save failed:", err);
  }

  try {
    await resend.emails.send({
      from: `WarmupExam <${process.env.CONTACT_SENDER_EMAIL}>`,
      to: owner.email,
      subject: "New Owner Login Detected",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color:#4f46e5;">Naya Login Detected</h2>
          <p><b>Time:</b> ${new Date().toLocaleString()}</p>
          <p><b>IP:</b> ${ip}</p>
          <p><b>Location:</b> ${location}</p>
          <p><b>Device:</b> ${device}</p>
          <p style="color:#94a3b8; font-size: 12px;">Agar ye login aapne nahi kiya, turant password change karein.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Login alert email failed:", err);
  }
}