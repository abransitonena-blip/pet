const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');
admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();
const messaging = admin.messaging();

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════

async function getAdminTokens() {
  const snap = await db.collection('admin').doc('tokens').get();
  return snap.data()?.fcmTokens || [];
}

async function sendPushToAdmins(title, body) {
  const tokens = await getAdminTokens();
  if (tokens.length === 0) return;
  await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body, icon: '/icons/icon-192.svg' },
  }).catch(() => {});
}

async function sendPushToUser(uid, title, body) {
  const userSnap = await db.collection('clients').doc(uid).get();
  const tokens = userSnap.data()?.fcmTokens || [];
  if (tokens.length === 0) return;
  await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body, icon: '/icons/icon-192.svg' },
  }).catch(() => {});
}

async function createNotification(uid, notification) {
  await db.collection('notifications').doc(uid).collection('items').add({
    ...notification,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function logAudit(actor, action, entity, entityId, before = null, after = null) {
  await db.collection('audit-logs').add({
    actor,
    action,
    entity,
    entityId,
    before,
    after,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// ═══════════════════════════════════════════
// 1. ROLE MANAGER
// ═══════════════════════════════════════════

// Callable: setUserRole({ uid, role })
// Only admins can call this
exports.setUserRole = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');

  const callerSnap = await db.collection('users').doc(context.auth.uid).get();
  if (callerSnap.data()?.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin only');
  }

  const { uid, role } = data;
  if (!uid || !['admin', 'walker', 'client', 'supervisor'].includes(role)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid role');
  }

  // Set role in Firestore
  await db.collection('users').doc(uid).set({ role, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

  // Set custom claims on Firebase Auth token
  await auth.setCustomUserClaims(uid, { role });

  // Log the change
  await logAudit(
    { uid: context.auth.uid, role: 'admin', name: 'Admin' },
    'assign_role',
    'user',
    uid,
    null,
    { role }
  );

  return { success: true, role };
});

// Callable: getUserRole({ uid })
exports.getUserRole = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');

  const { uid } = data;
  const snap = await db.collection('users').doc(uid || context.auth.uid).get();
  return { role: snap.data()?.role || null };
});

// ═══════════════════════════════════════════
// 2. SESSION COOKIE VALIDATION
// ═══════════════════════════════════════════

// Callable: verifySession()
// Returns the user's role and validates their session
exports.verifySession = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    return { valid: false, role: null };
  }

  const snap = await db.collection('users').doc(context.auth.uid).get();
  const role = snap.data()?.role || 'client';

  return {
    valid: true,
    uid: context.auth.uid,
    role,
    email: context.auth.token.email,
  };
});

// ═══════════════════════════════════════════
// 3. NOTIFICATION DISPATCHER
// ═══════════════════════════════════════════

// On new reservation → notify admin + walker
exports.onReservationCreate = functions.firestore
  .document('reservations/{docId}')
  .onCreate(async (snap) => {
    const data = snap.data();

    // Notify admin
    await sendPushToAdmins(
      '🐾 Nueva reserva',
      `${data.name} agendó "${data.service}" para ${data.petName}`
    );

    // Create in-app notification for admin
    // (We use a system uid for admin notifications)
    const adminUids = [];
    const usersSnap = await db.collection('users').where('role', '==', 'admin').get();
    usersSnap.forEach(doc => adminUids.push(doc.id));

    for (const uid of adminUids) {
      await createNotification(uid, {
        title: 'Nueva reserva',
        message: `${data.name} agendó "${data.service}" para ${data.petName}`,
        type: 'reservation',
        data: { reservationId: snap.id },
      });
    }

    // Log audit
    await logAudit(
      { uid: data.client?.uid || 'system', role: 'client', name: data.name },
      'create',
      'reservation',
      snap.id,
      null,
      data
    );
  });

// On reservation status change → notify relevant parties
exports.onReservationUpdate = functions.firestore
  .document('reservations/{docId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const resId = context.params.docId;

    if (before.status === after.status) return;

    // Notify client on status change
    if (after.client?.uid) {
      const statusMessages = {
        assigned: `Tu paseo fue asignado a ${after.assignment?.walkerName || 'un paseador'}`,
        en_camino: `${after.assignment?.walkerName || 'Tu paseador'} va en camino`,
        paseando: `${after.assignment?.walkerName || 'Tu paseador'} está con tu mascota`,
        completed: `¡Paseo completado! Revisa el reporte de ${after.petName}`,
        cancelled: 'Tu reserva fue cancelada',
      };

      const message = statusMessages[after.status];
      if (message) {
        await createNotification(after.client.uid, {
          title: 'Actualización de reserva',
          message,
          type: 'walk_update',
          data: { reservationId: resId },
        });
      }
    }

    // Notify walker on assignment
    if (after.status === 'assigned' && after.assignment?.walkerId) {
      await createNotification(after.assignment.walkerId, {
        title: 'Paseo asignado',
        message: `Se te asignó un paseo: ${after.petName} (${after.service})`,
        type: 'walk_update',
        data: { reservationId: resId },
      });
    }

    // Log audit
    await logAudit(
      { uid: 'system', role: 'system', name: 'System' },
      'update_status',
      'reservation',
      resId,
      { status: before.status },
      { status: after.status }
    );
  });

// ═══════════════════════════════════════════
// 4. LOYALTY POINTS
// ═══════════════════════════════════════════

// On reservation completed → award loyalty points
exports.onReservationCompleted = functions.firestore
  .document('reservations/{docId}')
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.status === 'completed' || after.status !== 'completed') return;
    if (!after.client?.uid) return;

    const uid = after.client.uid;
    const loyaltyRef = db.collection('loyalty').doc(uid);

    await db.runTransaction(async (t) => {
      const snap = await t.get(loyaltyRef);
      const current = snap.data() || { points: 0, totalWalks: 0, freeWalksEarned: 0, freeWalksUsed: 0 };

      const newWalks = (current.totalWalks || 0) + 1;
      const pointsEarned = 10; // 10 points per walk
      const newPoints = (current.points || 0) + pointsEarned;

      // Check if earned a free walk (every 10 walks)
      let freeWalksEarned = current.freeWalksEarned || 0;
      if (newWalks % 10 === 0) {
        freeWalksEarned += 1;
      }

      t.set(loyaltyRef, {
        points: newPoints,
        totalWalks: newWalks,
        freeWalksEarned,
        freeWalksUsed: current.freeWalksUsed || 0,
        lastWalkAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    // Notify client
    await createNotification(uid, {
      title: '¡Puntos de lealtad!',
      message: `Ganaste 10 puntos por tu paseo. Total: ${(after._loyaltyNewPoints || 0) + 10}`,
      type: 'loyalty',
      data: { reservationId: change.after.id },
    });
  });

// ═══════════════════════════════════════════
// 5. REFERRAL PROCESSING
// ═══════════════════════════════════════════

// On reservation completed with referral → process reward
exports.onReferralConversion = functions.firestore
  .document('reservations/{docId}')
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.status === 'completed' || after.status !== 'completed') return;
    if (!after.referralUid) return;

    const refId = after.referralUid;

    // Find the referral document
    const referralsSnap = await db.collection('referrals')
      .where('referrerUid', '==', refId)
      .where('refereePhone', '==', after.phone)
      .limit(1)
      .get();

    if (referralsSnap.empty) return;

    const refDoc = referralsSnap.docs[0];
    if (refDoc.data().status === 'completed' || refDoc.data().status === 'rewarded') return;

    // Update referral status
    await refDoc.ref.update({
      status: 'completed',
      convertedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Notify referrer
    await createNotification(refId, {
      title: '¡Referido convertido!',
      message: 'Tu amigo completó su primer paseo. ¡Ganaste $20 de descuento!',
      type: 'referral',
      data: { referralId: refDoc.id },
    });

    await sendPushToUser(refId, '¡Referido convertido!', 'Tu amigo completó su primer paseo. ¡Ganaste $20 de descuento!');
  });

// ═══════════════════════════════════════════
// 6. REVIEW NOTIFICATIONS
// ═══════════════════════════════════════════

exports.onNewReview = functions.firestore
  .document('reviews/{docId}')
  .onCreate(async (snap) => {
    const data = snap.data();
    await sendPushToAdmins('⭐ Nueva reseña', `${data.name} te dio ${data.rating} estrellas`);
  });

// ═══════════════════════════════════════════
// 7. WALKER STATS UPDATER
// ═══════════════════════════════════════════

exports.onWalkerReservationUpdate = functions.firestore
  .document('reservations/{docId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.status === after.status) return;
    if (!after.assignment?.walkerId) return;

    const walkerId = after.assignment.walkerId;
    const walkerRef = db.collection('walkers').doc(walkerId);

    await db.runTransaction(async (t) => {
      const snap = await t.get(walkerRef);
      if (!snap.exists) return;

      const data = snap.data();
      const perf = data.performance || {};
      const load = data.currentLoad || {};

      let updates = {};

      if (after.status === 'completed' && before.status !== 'completed') {
        updates = {
          'performance.totalWalks': (perf.totalWalks || 0) + 1,
          'performance.completedWalks': (perf.completedWalks || 0) + 1,
          'currentLoad.todayCompleted': (load.todayCompleted || 0) + 1,
        };
      } else if (after.status === 'en_camino' && before.status === 'assigned') {
        updates = {
          'currentLoad.todayAssigned': Math.max(0, (load.todayAssigned || 1) - 1),
        };
      }

      if (Object.keys(updates).length > 0) {
        t.update(walkerRef, updates);
      }
    });
  });

// ═══════════════════════════════════════════
// 8. RATE LIMITING (Reservation creation)
// ═══════════════════════════════════════════

exports.validateReservation = functions.firestore
  .document('reservations/{docId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const uid = data.client?.uid;

    if (!uid) return;

    // Check for duplicate reservations (same client, same date, same time)
    const dupSnap = await db.collection('reservations')
      .where('client.uid', '==', uid)
      .where('date', '==', data.date)
      .where('time', '==', data.time)
      .where('status', 'in', ['pending', 'assigned', 'en_camino', 'paseando'])
      .limit(2)
      .get();

    // If more than 1 result, the new one is a duplicate
    if (dupSnap.size > 1) {
      await snap.ref.update({ status: 'cancelled', notes: 'Auto-cancelled: duplicate reservation' });
      await createNotification(uid, {
        title: 'Reserva duplicada',
        message: 'Se detectó una reserva duplicada y fue cancelada automáticamente.',
        type: 'system',
        data: { reservationId: snap.id },
      });
    }

    // Check daily limit (max 3 active reservations per client per day)
    const dailySnap = await db.collection('reservations')
      .where('client.uid', '==', uid)
      .where('date', '==', data.date)
      .where('status', 'in', ['pending', 'assigned', 'en_camino', 'paseando'])
      .limit(5)
      .get();

    if (dailySnap.size > 3) {
      await snap.ref.update({ status: 'cancelled', notes: 'Auto-cancelled: daily limit exceeded' });
      await createNotification(uid, {
        title: 'Límite diario',
        message: 'Alcanzaste el límite de 3 reservas por día.',
        type: 'system',
        data: { reservationId: snap.id },
      });
    }
  });

// ═══════════════════════════════════════════
// 9. FCM TOKEN MANAGEMENT
// ═══════════════════════════════════════════

// Callable: registerFCMToken({ token })
// Registers a push token for the authenticated user
exports.registerFCMToken = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');

  const { token } = data;
  if (!token) throw new functions.https.HttpsError('invalid-argument', 'Token required');

  // Store in user's token document
  const userSnap = await db.collection('users').doc(context.auth.uid).get();
  const role = userSnap.data()?.role || 'client';

  if (role === 'admin') {
    // Admin tokens go to admin/tokens
    await db.collection('admin').doc('tokens').update({
      fcmTokens: admin.firestore.FieldValue.arrayUnion(token),
    });
  } else {
    // Client/walker tokens go to their client doc
    await db.collection('clients').doc(context.auth.uid).update({
      fcmTokens: admin.firestore.FieldValue.arrayUnion(token),
    });
  }

  return { success: true };
});

// ═══════════════════════════════════════════
// 10. SCHEDULE CRON — Reset daily walker loads
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
// 11. WALKER ACCOUNT CREATION
// ═══════════════════════════════════════════

// Callable: createWalkerAccount({ email, name, phone, zones, maxDaily, maxWeekly, schedule })
// Creates Firebase Auth user + users doc + walkerProfiles doc with generated temp password
exports.createWalkerAccount = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');

  const callerSnap = await db.collection('users').doc(context.auth.uid).get();
  if (callerSnap.data()?.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin only');
  }

  const { email, name, phone, zones, maxDaily, maxWeekly, schedule } = data;
  if (!email || !name) {
    throw new functions.https.HttpsError('invalid-argument', 'Email and name required');
  }

  // Check if email already exists
  try {
    await auth.getUserByEmail(email);
    throw new functions.https.HttpsError('already-exists', 'Email already registered');
  } catch (e) {
    if (e.code === 'already-exists') throw e;
    // User doesn't exist — good, we can create
  }

  // Generate random temp password (12 chars: upper, lower, digit, symbol)
  const tempPassword = crypto.randomBytes(9).toString('base64url').slice(0, 12);

  // Create Firebase Auth user with generated password
  const userRecord = await auth.createUser({
    email,
    password: tempPassword,
    displayName: name,
    disabled: false,
  });

  const uid = userRecord.uid;

  // Create users doc with role
  await db.collection('users').doc(uid).set({
    role: 'walker',
    name,
    email,
    phone: phone || '',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Create walkerProfiles doc with force password change flag
  await db.collection('walkerProfiles').doc(uid).set({
    uid,
    name,
    email,
    phone: phone || '',
    zones: zones || [],
    maxDaily: maxDaily || 8,
    maxWeekly: maxWeekly || 40,
    schedule: schedule || {},
    status: 'active',
    forcePasswordChange: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Set custom claim
  await auth.setCustomUserClaims(uid, { role: 'walker' });

  // Log audit
  await logAudit(
    { uid: context.auth.uid, role: 'admin', name: 'Admin' },
    'create_walker',
    'walker',
    uid,
    null,
    { name, email }
  );

  // Notify admin
  await sendPushToAdmins('👤 Paseador creado', `Cuenta creada para ${name} (${email})`);

  // Return temp password (one-time display, never stored in plaintext after this)
  return { uid, tempPassword, success: true };
});

// ═══════════════════════════════════════════
// 12. RESERVATION STATUS HISTORY
// ═══════════════════════════════════════════

// On reservation update → append to history array
exports.onReservationStatusHistory = functions.firestore
  .document('reservations/{docId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const resId = context.params.docId;

    if (before.status === after.status) return;

    // Append to history
    const historyEntry = {
      status: after.status,
      timestamp: new Date().toISOString(),
      changedBy: after.assignment?.walkerId || after.client?.uid || 'system',
    };

    // Use arrayUnion to append (creates array if doesn't exist)
    await change.after.ref.update({
      history: admin.firestore.FieldValue.arrayUnion(historyEntry),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

exports.resetDailyWalkerLoads = functions.pubsub
  .schedule('0 0 * * *') // Every midnight
  .timeZone('America/Mexico_City')
  .onRun(async () => {
    const walkersSnap = await db.collection('walkers').where('status', '==', 'active').get();

    const batch = db.batch();
    walkersSnap.forEach(doc => {
      batch.update(doc.ref, {
        'currentLoad.todayAssigned': 0,
        'currentLoad.todayCompleted': 0,
      });
    });

    await batch.commit();
    console.log(`Reset daily loads for ${walkersSnap.size} walkers`);
  });
