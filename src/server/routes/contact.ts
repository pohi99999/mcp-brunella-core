import { Router, Request, Response } from "express";
import nodemailer from "nodemailer";
import { logInfo, logError, logWarn } from "../../utils/logger.js";

const router = Router();

// Email validáció
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length < 255;
};

// Gmail SMTP konfiguráció
let transporter: nodemailer.Transporter | null = null;

function initializeTransporter() {
  if (transporter) return;

  const gmailUser = process.env.GMAIL_USER;
  const gmailPassword = process.env.GMAIL_PASSWORD;

  if (!gmailUser || !gmailPassword) {
    logError("ContactRoute", "Gmail credentials missing: set GMAIL_USER and GMAIL_PASSWORD in .env");
    return;
  }

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser,
      pass: gmailPassword.replace(/\s+/g, ""), // Gmail app password, not actual password!
    },
  });

  logInfo("ContactRoute", "Gmail SMTP transporter initialized");
}

// Initialize on first request
initializeTransporter();

interface ContactFormPayload {
  name: string;
  email: string;
  message: string;
  website?: string; // honeypot field
}

// POST /api/contact - Form submission endpoint
router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, email, message, website } = req.body as ContactFormPayload;

    // 🚫 Honeypot check
    if (website && website.length > 0) {
      logWarn("ContactRoute", "Honeypot triggered - likely spam");
      return res.json({ ok: false, error: "Honeypot triggered" });
    }

    // 📋 Validáció
    if (!name || !email || !message) {
      return res.status(400).json({
        ok: false,
        error: "Name, email, and message are required",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid email address",
      });
    }

    if (message.length < 10) {
      return res.status(400).json({
        ok: false,
        error: "Message must be at least 10 characters",
      });
    }

    if (message.length > 5000) {
      return res.status(400).json({
        ok: false,
        error: "Message must be less than 5000 characters",
      });
    }

    if (!transporter) {
      logError("ContactRoute", "Transporter not initialized - Gmail credentials missing");
      return res.status(503).json({
        ok: false,
        error: "Email service unavailable",
      });
    }

    // 📧 Email szöveg - Hungarian HTML template
    const htmlTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px 8px 0 0; color: white;">
          <h1 style="margin: 0; font-size: 24px;">Új üzenet a kapcsolati formból</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0; border-top: none;">
          <p style="margin: 0 0 15px 0;"><strong>Feladó:</strong> ${escapeHtml(name)}</p>
          <p style="margin: 0 0 15px 0;"><strong>Email cím:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
          
          <div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #667eea; margin: 15px 0;">
            <h3 style="margin-top: 0; color: #333;">Üzenet:</h3>
            <p style="white-space: pre-wrap; line-height: 1.6; color: #555;">${escapeHtml(message)}</p>
          </div>
          
          <div style="font-size: 12px; color: #999; margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd;">
            <p style="margin: 5px 0;">Küldési idő: ${new Date().toLocaleString("hu-HU")}</p>
            <p style="margin: 5px 0;">IP/Forrás: Brunella Connect Form</p>
          </div>
        </div>
      </div>
    `;

    // 📤 Küldés a tulajdonosnak
    await transporter.sendMail({
      from: process.env.GMAIL_USER!,
      to: "peterpohankapersonal@gmail.com", // direktbe a property owner email-re
      subject: `Új üzenet: ${escapeHtml(name)} - Pohánka & Társa Kontakt Form`,
      html: htmlTemplate,
      replyTo: email,
    });

    logInfo("ContactRoute", `Email sent from ${email} (${name}) to peterpohankapersonal@gmail.com`);

    // ✅ Válasz az ügyfélnek
    return res.json({
      ok: true,
      message: "Üzenet sikeresen elküldve!",
      messageId: `contact-${Date.now()}`,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logError("ContactRoute", `POST /api/contact failed: ${errorMsg}`);

    return res.status(500).json({
      ok: false,
      error: "Nem sikerült elküldeni az üzenetet. Próbáld később!",
    });
  }
});

// Helper: HTML escape
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

export default router;
