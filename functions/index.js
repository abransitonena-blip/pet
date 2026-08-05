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
  const userSnap = await db.collection('customerProfiles').doc(uid).get();
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
// Users can only query their own role. Admins can query any user.
exports.getUserRole = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');

  const targetUid = data.uid || context.auth.uid;

  // If querying someone else's role, verify caller is admin
  if (targetUid !== context.auth.uid) {
    const callerSnap = await db.collection('users').doc(context.auth.uid).get();
    if (callerSnap.data()?.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Only admins can query other users roles');
    }
  }

  const snap = await db.collection('users').doc(targetUid).get();
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
      { uid: data.customer?.uid || 'system', role: 'client', name: data.name },
      'create',
      'reservation',
      snap.id,
      null,
      data
    );
  });

// Consolidated onUpdate: notifications, loyalty, referrals, walker stats, history
exports.onReservationUpdate = functions.firestore
  .document('reservations/{docId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const resId = context.params.docId;

    if (before.status === after.status) return;

    // — Notifications —
    if (after.customer?.uid) {
      const statusMessages = {
        assigned: `Tu paseo fue asignado a ${after.assignment?.walkerName || 'un paseador'}`,
        en_camino: `${after.assignment?.walkerName || 'Tu paseador'} va en camino`,
        paseando: `${after.assignment?.walkerName || 'Tu paseador'} está con tu mascota`,
        completed: `¡Paseo completado! Revisa el reporte de ${after.petName}`,
        cancelled: 'Tu reserva fue cancelada',
      };

      const message = statusMessages[after.status];
      if (message) {
        await createNotification(after.customer.uid, {
          title: 'Actualización de reserva',
          message,
          type: 'walk_update',
          data: { reservationId: resId },
        });
      }
    }

    if (after.status === 'assigned' && after.assignment?.walkerId) {
      await createNotification(after.assignment.walkerId, {
        title: 'Paseo asignado',
        message: `Se te asignó un paseo: ${after.petName} (${after.service})`,
        type: 'walk_update',
        data: { reservationId: resId },
      });
    }

    // — Walker stats —
    if (after.assignment?.walkerId) {
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
    }

    // — History —
    const historyEntry = {
      status: after.status,
      timestamp: new Date().toISOString(),
      changedBy: after.assignment?.walkerId || after.customer?.uid || 'system',
    };

    await change.after.ref.update({
      history: admin.firestore.FieldValue.arrayUnion(historyEntry),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // — Loyalty (on completed) —
    if (after.status === 'completed' && after.customer?.uid) {
      const uid = after.customer.uid;
      const loyaltyRef = db.collection('loyalty').doc(uid);

      let newPoints;
      await db.runTransaction(async (t) => {
        const snap = await t.get(loyaltyRef);
        const current = snap.data() || { points: 0, totalWalks: 0, freeWalksEarned: 0, freeWalksUsed: 0 };

        const newWalks = (current.totalWalks || 0) + 1;
        newPoints = (current.points || 0) + 10;

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

      await createNotification(uid, {
        title: '¡Puntos de lealtad!',
        message: `Ganaste 10 puntos por tu paseo. Total: ${newPoints}`,
        type: 'loyalty',
        data: { reservationId: resId },
      });
    }

    // — Referral (on completed) —
    if (after.status === 'completed' && after.referralUid) {
      const refId = after.referralUid;

      const referralsSnap = await db.collection('referrals')
        .where('referrerUid', '==', refId)
        .where('refereePhone', '==', after.phone)
        .limit(1)
        .get();

      if (!referralsSnap.empty) {
        const refDoc = referralsSnap.docs[0];
        if (refDoc.data().status !== 'completed' && refDoc.data().status !== 'rewarded') {
          await refDoc.ref.update({
            status: 'completed',
            convertedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          await createNotification(refId, {
            title: '¡Referido convertido!',
            message: 'Tu amigo completó su primer paseo. ¡Ganaste $20 de descuento!',
            type: 'referral',
            data: { referralId: refDoc.id },
          });

          await sendPushToUser(refId, '¡Referido convertido!', 'Tu amigo completó su primer paseo. ¡Ganaste $20 de descuento!');
        }
      }
    }

    // — Audit log —
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
// 6. REVIEW NOTIFICATIONS
// ═══════════════════════════════════════════

exports.onNewReview = functions.firestore
  .document('reviews/{docId}')
  .onCreate(async (snap) => {
    const data = snap.data();
    await sendPushToAdmins('⭐ Nueva reseña', `${data.name} te dio ${data.rating} estrellas`);
  });

// ═══════════════════════════════════════════
// 7. RATE LIMITING (Reservation creation)
// ═══════════════════════════════════════════

exports.validateReservation = functions.firestore
  .document('reservations/{docId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const uid = data.customer?.uid;

    if (!uid) return;

    // Check for duplicate reservations (same customer, same date, same time)
    const dupSnap = await db.collection('reservations')
      .where('customer.uid', '==', uid)
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
// 8. FCM TOKEN MANAGEMENT
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
    // Customer/walker tokens go to their customerProfile doc
    await db.collection('customerProfiles').doc(context.auth.uid).update({
      fcmTokens: admin.firestore.FieldValue.arrayUnion(token),
    });
  }

  return { success: true };
});

// ═══════════════════════════════════════════
// 9. WALKER ACCOUNT CREATION
// ═══════════════════════════════════════════

// Callable: createWalkerAccount({ email, name, phone, zones, maxDaily, maxWeekly, schedule })
// Creates Firebase Auth user + users doc + walkerProfiles doc with generated temp password
// Includes rollback: if Firestore writes fail after Auth user creation, the Auth user is deleted
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

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid email format');
  }

  // Check if email already exists
  try {
    await auth.getUserByEmail(email);
    throw new functions.https.HttpsError('already-exists', 'Email already registered');
  } catch (e) {
    if (e.code === 'already-exists') throw e;
    // User doesn't exist — good, we can create
  }

  // Generate random temp password (16 chars: alphanumeric + symbol)
  const tempPassword = crypto.randomBytes(12).toString('base64url').slice(0, 16);

  let uid = null;

  try {
    // Create Firebase Auth user with generated password
    const userRecord = await auth.createUser({
      email,
      password: tempPassword,
      displayName: name,
      disabled: false,
    });

    uid = userRecord.uid;

    // Create users doc with role (must exist before walkerProfiles read rules work)
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

  } catch (error) {
    // Rollback: if Auth user was created but Firestore writes failed, delete the Auth user
    if (uid) {
      try {
        await auth.deleteUser(uid);
        console.log(`Rolled back Auth user ${uid} after Firestore write failure`);
      } catch (rollbackError) {
        console.error(`Failed to rollback Auth user ${uid}:`, rollbackError);
      }
    }
    throw error;
  }
});

exports.cleanupPetAhoraStale = functions.pubsub
  .schedule('*/5 * * * *')
  .timeZone('America/Mexico_City')
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now();
    const batch = db.batch();
    let count = 0;

    const expireTerminal = (status) =>
      !['accepted', 'active', 'completed'].includes(status);

    const staleRequests = await db.collection('petAhoraRequests')
      .where('expiresAt', '<', now)
      .get();

    for (const doc of staleRequests.docs) {
      const data = doc.data();
      if (expireTerminal(data.status)) {
        batch.update(doc.ref, { status: 'expired', expiredAt: now });
        count++;
      }
    }

    const staleOffers = await db.collection('petAhoraOffers')
      .where('expiresAt', '<', now)
      .where('status', '==', 'pending')
      .get();

    for (const doc of staleOffers.docs) {
      batch.update(doc.ref, { status: 'declined', respondedAt: now });
      count++;
    }

    const sevenDaysAgo = new admin.firestore.Timestamp(
      now.seconds - 7 * 86400, 0
    );

    const staleLeases = await db.collection('petAhoraLeases')
      .where('status', '==', 'active')
      .where('lockedAt', '<', sevenDaysAgo)
      .get();

    for (const doc of staleLeases.docs) {
      batch.update(doc.ref, { status: 'expired', expiredAt: now });
      count++;
    }

    if (count > 0) {
      await batch.commit();
      console.log(`Cleaned up ${count} stale Pet Ahora records`);
    }
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

// ═══════════════════════════════════════════
// 10. DIGITAL WALLET
// ═══════════════════════════════════════════

// Helper: ensure wallet exists for user, create if not
async function ensureWallet(uid) {
  const ref = db.collection('wallets').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      uid,
      balance: 0,
      totalTopUp: 0,
      totalDeducted: 0,
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { balance: 0, totalTopUp: 0, totalDeducted: 0 };
  }
  return snap.data();
}

// Callable: getWalletBalance()
// Returns current wallet balance for the authenticated user
exports.getWalletBalance = functions.https.onCall(async (_, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');
  const wallet = await ensureWallet(context.auth.uid);
  return { balance: wallet.balance || 0, totalTopUp: wallet.totalTopUp || 0, totalDeducted: wallet.totalDeducted || 0 };
});

// Callable: getWalletTransactions({ limit = 20 })
// Returns recent transactions for the authenticated user
exports.getWalletTransactions = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');

  const txLimit = Math.min(data?.limit || 20, 50);
  const snap = await db.collection('wallets').doc(context.auth.uid)
    .collection('transactions')
    .orderBy('createdAt', 'desc')
    .limit(txLimit)
    .get();

  const transactions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return { transactions };
});

// Callable: adminTopUpWallet({ uid, amount, concept })
// Admin adds funds to a client's wallet
exports.adminTopUpWallet = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');

  const callerSnap = await db.collection('users').doc(context.auth.uid).get();
  if (callerSnap.data()?.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin only');
  }

  const { uid, amount, concept } = data;
  if (!uid || !amount || amount <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Valid uid and amount required');
  }

  await ensureWallet(uid);

  const walletRef = db.collection('wallets').doc(uid);
  const txRef = db.collection('wallets').doc(uid).collection('transactions').doc();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(walletRef);
    const currentBalance = snap.data()?.balance || 0;

    tx.update(walletRef, {
      balance: admin.firestore.FieldValue.increment(amount),
      totalTopUp: admin.firestore.FieldValue.increment(amount),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    tx.set(txRef, {
      type: 'topup',
      amount,
      balanceBefore: currentBalance,
      balanceAfter: currentBalance + amount,
      concept: concept || 'Carga de saldo',
      createdBy: context.auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await createNotification(uid, {
    title: '💰 Saldo actualizado',
    message: `Se añadieron $${amount.toLocaleString()} a tu billetera.`,
    type: 'wallet',
    data: { amount },
  });

  return { success: true, amount, transactionId: txRef.id };
});

// Callable: deductFromWallet({ amount, concept, reservationId })
// Client deducts from their wallet (e.g. to pay for a reservation)
exports.deductFromWallet = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');

  const { amount, concept, reservationId } = data;
  if (!amount || amount <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Valid amount required');
  }

  const uid = context.auth.uid;
  await ensureWallet(uid);

  const walletRef = db.collection('wallets').doc(uid);
  const txRef = db.collection('wallets').doc(uid).collection('transactions').doc();

  let success = false;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(walletRef);
    const currentBalance = snap.data()?.balance || 0;

    if (currentBalance < amount) {
      throw new functions.https.HttpsError('failed-precondition', 'Saldo insuficiente');
    }

    tx.update(walletRef, {
      balance: admin.firestore.FieldValue.increment(-amount),
      totalDeducted: admin.firestore.FieldValue.increment(amount),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    tx.set(txRef, {
      type: 'deduction',
      amount: -amount,
      balanceBefore: currentBalance,
      balanceAfter: currentBalance - amount,
      concept: concept || 'Pago de reserva',
      reservationId: reservationId || '',
      createdBy: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    success = true;
  });

  return { success, amount, transactionId: txRef.id };
});

// Callable: redeemFreeWalk({ uid })
// Client redeems a free walk from loyalty program
exports.redeemFreeWalk = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');

  const { uid } = data;
  if (!uid) throw new functions.https.HttpsError('invalid-argument', 'UID required');
  if (uid !== context.auth.uid) throw new functions.https.HttpsError('permission-denied', 'Can only redeem for yourself');

  const loyaltyRef = db.collection('loyalty').doc(uid);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(loyaltyRef);
    if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Loyalty record not found');

    const data = snap.data();
    const earned = data.freeWalksEarned || 0;
    const used = data.freeWalksUsed || 0;
    const available = earned - used;

    if (available <= 0) throw new functions.https.HttpsError('failed-precondition', 'No free walks available');

    tx.update(loyaltyRef, {
      freeWalksUsed: admin.firestore.FieldValue.increment(1),
    });

    await createNotification(uid, {
      title: '🎉 Paseo gratis canjeado',
      message: 'Has canjeado un paseo gratis. Te contactaremos para agendarlo.',
      type: 'loyalty',
      data: { action: 'redeemed' },
    });
  });

  return { success: true };
});
