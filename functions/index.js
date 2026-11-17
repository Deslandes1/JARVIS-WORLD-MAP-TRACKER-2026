/*
  ============================================================
  FILE: functions/index.js
  LOCATION: your-project/functions/index.js
  PURPOSE: Stores an emergency profile photo (and metadata) in
           Firestore and returns a short ID. The JARVIS map app
           reads that ID to display the photo to the helper.
           No email is sent anymore.
  ============================================================
*/
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

admin.initializeApp();

exports.storeEmergencyProfile = functions.https.onRequest((req, res) =>
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') return res.status(405).send('POST only');
      const { pictureBase64, pictureName, name, lat, lng } = req.body;
      if (!lat || !lng) return res.status(400).json({ error: 'missing lat/lng' });

      // Strip the data URL prefix, keep only the base64 payload
      let base64 = null;
      let contentType = 'image/jpeg';
      if (pictureBase64) {
        const m = pictureBase64.match(/^data:(image\/[a-z]+);base64,(.+)$/i);
        if (m) { contentType = m[1]; base64 = m[2]; }
        else { base64 = pictureBase64; }
      }

      const doc = await admin.firestore().collection('emergency_profiles').add({
        name: name || 'Unknown',
        pictureBase64: base64,
        pictureContentType: contentType,
        pictureName: pictureName || 'profile.jpg',
        lat, lng,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Auto-delete after 24h so old photos don't pile up
      await admin.firestore().collection('emergency_profiles').doc(doc.id)
        .update({ expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });

      return res.json({ id: doc.id });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  })
);

/* Public read endpoint for the JARVIS app to fetch a stored photo by ID */
exports.getEmergencyProfile = functions.https.onRequest((req, res) =>
  cors(req, res, async () => {
    try {
      const id = (req.query.id || '').toString();
      if (!id) return res.status(400).json({ error: 'missing id' });
      const snap = await admin.firestore().collection('emergency_profiles').doc(id).get();
      if (!snap.exists) return res.status(404).json({ error: 'not found' });
      const d = snap.data();
      return res.json({
        name: d.name,
        pictureBase64: d.pictureBase64,
        pictureContentType: d.pictureContentType,
        pictureName: d.pictureName,
        lat: d.lat, lng: d.lng,
        createdAt: d.createdAt ? d.createdAt.toMillis() : null,
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  })
);
