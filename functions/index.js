/*
  ============================================================
  FILE: functions/index.js
  LOCATION: your-project/functions/index.js
  PURPOSE: Cloud Function that sends the emergency email
           (with profile picture attachment) via Gmail SMTP.
  ============================================================
*/
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const cors = require('cors')({ origin: true });

admin.initializeApp();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

exports.sendEmergencyEmail = functions.https.onRequest((req, res) =>
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') return res.status(405).send('POST only');
      const { to, subject, text, pictureBase64, wa1, wa2, lat, lng } = req.body;
      if (!to || !text) return res.status(400).json({ error: 'missing to/text' });

      const attachments = [];
      if (pictureBase64) {
        const m = pictureBase64.match(/^data:(image\/[a-z]+);base64,(.+)$/i);
        if (m) {
          attachments.push({
            filename: 'profile.jpg',
            content: m[2],
            encoding: 'base64',
            contentType: m[1],
          });
        }
      }

      await transporter.sendMail({
        from: `"JARVIS Emergency" <${process.env.SMTP_USER}>`,
        to,
        subject: subject || '🚨 EMERGENCY',
        text,
        attachments,
      });

      await admin.firestore().collection('emergency_logs').add({
        to, wa1, wa2, lat, lng,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.json({ ok: true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  })
);
