// api/send.js (CommonJS) - serverless function for Vercel
const nodemailer = require('nodemailer');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const { name, email, phone, message, website, form_time } = req.body || {};

    // 1) Honeypot: silently drop if filled (return success so bots get no feedback)
    if (website && String(website).trim() !== '') {
      console.warn('Honeypot triggered. Dropping submission.', { website });
      return res.status(200).json({ ok: true, message: 'Message sent' });
    }

    // 2) Speed check: if submitted too quickly (<5s), treat as bot and silently drop
    const now = Date.now();
    let loadedAt = parseInt(form_time, 10) || now;
    // Normalize seconds -> ms if necessary
    if (loadedAt > 0 && loadedAt < 1e12 && loadedAt < 1e11) loadedAt = loadedAt * 1000;
    if (!loadedAt || loadedAt <= 0) loadedAt = now;
    const delta = now - loadedAt;
    if (delta < 5000) {
      console.warn('Fast submission detected. Delta:', delta);
      return res.status(200).json({ ok: true, message: 'Message sent' });
    }

    // Basic validation
    if (!email || !message) {
      return res.status(400).json({ ok: false, error: 'Missing required fields' });
    }

    // Configure nodemailer transporter for Mailu SMTP using env vars
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for STARTTLS (587)
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        // set MAILU_TLS_REJECT_UNAUTHORIZED=false only if using self-signed certs (not recommended)
        rejectUnauthorized: process.env.MAILU_TLS_REJECT_UNAUTHORIZED !== 'false'
      }
    });

    // Optional: verify connection/auth
    try {
      await transporter.verify();
      console.log('SMTP verify: OK');
    } catch (vErr) {
      console.error('SMTP verify failed:', vErr && vErr.message ? vErr.message : vErr);
      return res.status(500).json({ ok: false, error: 'SMTP verify failed', details: String(vErr) });
    }

    const fromAddress = process.env.FROM_EMAIL || process.env.SMTP_USER;
    const toAddress = process.env.TO_EMAIL || 'info@windekfisheries.com';

    const mailOptions = {
      from: `"Windek Fisheries Website" <${fromAddress}>`,
      to: toAddress,
      subject: `Website contact from ${name || 'Anonymous'}`,
      replyTo: email,
      text:
          `You have a new contact request from the website.\n\n` +
          `Name: ${name || 'N/A'}\n` +
          `Email: ${email}\n` +
          `Phone: ${phone || 'N/A'}\n\n` +
          `Message:\n${message}\n`
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('sendMail info:', { accepted: info.accepted, response: info.response, messageId: info.messageId });
      return res.status(200).json({ ok: true, message: 'Message sent', info: { messageId: info.messageId, response: info.response } });
    } catch (sendErr) {
      console.error('sendMail failed:', sendErr);
      return res.status(500).json({ ok: false, error: 'Failed to send', details: String(sendErr) });
    }
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ ok: false, error: 'Server error', details: String(err) });
  }
};
