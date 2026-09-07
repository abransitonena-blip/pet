#!/usr/bin/env node

import walkerAdmin from './lib/walker-onboarding-admin.cjs'

const { parseArgs, runOperation, safeFailure, usage } = walkerAdmin
let options = {}

async function main() {
  try {
    options = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(JSON.stringify(safeFailure(error, options), null, 2))
    console.error(usage())
    process.exitCode = 2
    return
  }
  if (options.help) {
    console.log(usage())
    return
  }

  const [{ applicationDefault, getApps, initializeApp }, { getAuth }, firestoreModule] = await Promise.all([
    import('firebase-admin/app'),
    import('firebase-admin/auth'),
    import('firebase-admin/firestore'),
  ])
  const { FieldValue, getFirestore } = firestoreModule
  const existingApp = getApps()[0]
  if (existingApp && existingApp.options.projectId !== options.projectId) {
    throw new walkerAdmin.WalkerOnboardingError('firebase-project-mismatch', 'initialization')
  }
  const app = existingApp || initializeApp({ credential: applicationDefault(), projectId: options.projectId })
  const adminAuth = getAuth(app)
  const db = getFirestore(app)

  const getAuthByEmail = async (email) => {
    try {
      return await adminAuth.getUserByEmail(email)
    } catch (error) {
      if (error && typeof error === 'object' && error.code === 'auth/user-not-found') return null
      throw error
    }
  }
  const inspect = async (email) => {
    const authUser = await getAuthByEmail(email)
    if (!authUser) return { authUser: null, userMirror: null, walkerProfile: null }
    const [userSnap, profileSnap] = await Promise.all([
      db.collection('users').doc(authUser.uid).get(),
      db.collection('walkerProfiles').doc(authUser.uid).get(),
    ])
    return {
      authUser,
      userMirror: userSnap.exists ? userSnap.data() : null,
      walkerProfile: profileSnap.exists ? profileSnap.data() : null,
    }
  }

  const report = await runOperation({
    inspect,
    createAuthUser: (input) => adminAuth.createUser(input),
    setCustomUserClaims: (uid, claims) => adminAuth.setCustomUserClaims(uid, claims),
    createDocumentsAtomically: async (input) => {
      const created = new Set()
      await db.runTransaction(async (transaction) => {
        const userRef = db.collection('users').doc(input.uid)
        const profileRef = db.collection('walkerProfiles').doc(input.uid)
        const [userSnap, profileSnap] = await Promise.all([transaction.get(userRef), transaction.get(profileRef)])
        const now = FieldValue.serverTimestamp()
        if (input.createUserMirror) {
          if (userSnap.exists) throw new Error('concurrent-user-mirror-create')
          transaction.create(userRef, { name: input.name, email: input.email, role: 'walker', createdAt: now, updatedAt: now })
          created.add('users')
        }
        if (input.createWalkerProfile) {
          if (profileSnap.exists) throw new Error('concurrent-walker-profile-create')
          transaction.create(profileRef, {
            uid: input.uid,
            name: input.name,
            email: input.email,
            status: input.status,
            createdAt: now,
            updatedAt: now,
          })
          created.add('walkerProfiles')
        }
      })
      return [...created]
    },
    deleteCreatedDocuments: async (uid, collections) => {
      await db.runTransaction(async (transaction) => {
        for (const collectionName of collections) {
          const ref = db.collection(collectionName).doc(uid)
          const snap = await transaction.get(ref)
          if (!snap.exists || snap.data()?.email !== options.email) throw new Error('compensation-ownership-mismatch')
          transaction.delete(ref)
        }
      })
    },
    deleteCreatedAuthUser: (uid) => adminAuth.deleteUser(uid),
  }, options)
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify(safeFailure(error, options), null, 2))
  process.exitCode = 1
})
