const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.onNewReservation = functions.firestore
  .document('reservations/{docId}')
  .onCreate(async (snap) => {
    const data = snap.data();
    const tokensSnap = await admin.firestore().collection('admin').doc('tokens').get();
    const tokens = tokensSnap.data()?.fcmTokens || [];
    if (tokens.length === 0) return;
    await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: '\ud83d\udc3e Nueva reserva',
        body: `${data.name} agendo "${data.service}" para ${data.petName}`,
        icon: '/icons/icon-192.svg',
      },
    });
  });

exports.onNewReview = functions.firestore
  .document('reviews/{docId}')
  .onCreate(async (snap) => {
    const data = snap.data();
    const tokensSnap = await admin.firestore().collection('admin').doc('tokens').get();
    const tokens = tokensSnap.data()?.fcmTokens || [];
    if (tokens.length === 0) return;
    await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: '\u2b50 Nueva rese\u00f1a',
        body: `${data.name} te dio ${data.rating} estrellas`,
        icon: '/icons/icon-192.svg',
      },
    });
  });
