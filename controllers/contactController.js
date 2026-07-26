import resend from "../utils/mailer.js";

export const sendContactMessage = async (req, res) => {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ success: false, message: "Name, email aur message zaroori hai" });
    }

    const subjectMap = {
        general: "General Inquiry",
        payment: "Payment Issue",
        test: "Test / Technical Issue",
        feedback: "Feedback"
    };
    const subjectLabel = subjectMap[subject] || "General Inquiry";

    try {
        const { data, error } = await resend.emails.send({
            from: `WarmupExam Contact Form <${process.env.CONTACT_SENDER_EMAIL}>`,
            to: process.env.CONTACT_RECEIVER_EMAIL,
            replyTo: email,   // seedha "Reply" karke user ko jawab de sako
            subject: `[WarmupExam] ${subjectLabel} — from ${name}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
                    <h2 style="color:#4f46e5;">New Contact Form Message</h2>
                    <table style="width:100%; border-collapse: collapse; margin-top: 16px;">
                        <tr>
                            <td style="padding:8px; font-weight:bold; color:#334155;">Name:</td>
                            <td style="padding:8px; color:#334155;">${name}</td>
                        </tr>
                        <tr>
                            <td style="padding:8px; font-weight:bold; color:#334155;">Email:</td>
                            <td style="padding:8px; color:#334155;">${email}</td>
                        </tr>
                        <tr>
                            <td style="padding:8px; font-weight:bold; color:#334155;">Subject:</td>
                            <td style="padding:8px; color:#334155;">${subjectLabel}</td>
                        </tr>
                    </table>
                    <div style="margin-top:16px; padding:16px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
                        <p style="margin:0; color:#334155; white-space: pre-wrap;">${message}</p>
                    </div>
                </div>
            `
        });

        if (error) {
            console.error("❌ Resend error:", error);
            return res.status(500).json({ success: false, message: "Email bhejne mein error aa gaya, dobara try karo" });
        }

        res.json({ success: true, message: "Message sent successfully!" });
    } catch (err) {
        console.error("❌ Contact mail error:", err.message);
        res.status(500).json({ success: false, message: "Kuch galat ho gaya, dobara try karo" });
    }
};