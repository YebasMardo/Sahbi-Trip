// Temporary HTTP smoke test — exercises the exact endpoints the frontend calls.
// Deleted after the run; not part of the app.
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'
import mongoose from 'mongoose'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: join(__dirname, '..', '..', '.env') })

const API = 'http://127.0.0.1:3000/api/v1'
const email = `smoke-${Date.now()}@example.test`
const password = 'SmokeTest12345'

let pass = 0
let fail = 0

function ok2xx(r) {
  return r.status >= 200 && r.status < 300
}

function check(name, ok, detail = '') {
  if (ok) {
    pass++
    console.log(`  PASS  ${name}`)
  } else {
    fail++
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function call(method, path, { body, token } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    /* empty body */
  }
  return { status: res.status, body: json }
}

async function main() {
  console.log('\n--- public catalogue ---')
  const stats = await call('GET', '/activities/stats')
  check('GET /activities/stats', stats.status === 200 && stats.body.data.total === 46, JSON.stringify(stats.body).slice(0, 120))

  const list = await call('GET', '/activities?city=Marrakech&limit=3')
  check('GET /activities filtered', list.status === 200 && list.body.data.items.length === 3)
  check('activity carries slug id', typeof list.body?.data?.items?.[0]?.id === 'string')

  const health = await call('GET', '/ai/health')
  check('GET /ai/health all providers ok', health.body?.data?.llm?.ok && health.body?.data?.embed?.ok && health.body?.data?.rerank?.ok)

  console.log('\n--- auth ---')
  const reg = await call('POST', '/auth/register', { body: { fullname: 'Smoke Tester', email, password } })
  check('POST /auth/register -> OTP pending', ok2xx(reg) && reg.body?.data?.status === 'EMAIL_VERIFICATION_PENDING', `status ${reg.status}`)

  // The OTP is emailed and stored argon2-hashed, so it cannot be read back.
  // Mark the account verified directly — this is the test fixture, not a code path.
  await mongoose.connect(process.env.MONGODB_URI)
  const users = mongoose.connection.db.collection('users')
  const updated = await users.updateOne({ email }, { $set: { emailVerified: true } })
  check('test fixture: user marked verified', updated.matchedCount === 1)

  const login = await call('POST', '/auth/login', { body: { email, password } })
  const token = login.body?.data?.accessToken
  check('POST /auth/login -> session', login.status === 200 && !!token, `status ${login.status} ${JSON.stringify(login.body).slice(0, 160)}`)
  if (!token) throw new Error('cannot continue without a session')

  const me = await call('GET', '/auth/me', { token })
  check('GET /auth/me', me.status === 200 && me.body?.data?.email === email)

  console.log('\n--- trip lifecycle ---')
  const emptyList = await call('GET', '/trips', { token })
  check('GET /trips (empty)', emptyList.status === 200 && Array.isArray(emptyList.body.data) && emptyList.body.data.length === 0)

  const created = await call('POST', '/trips', {
    token,
    body: {
      title: 'Smoke trip',
      startDate: '2026-11-10',
      endDate: '2026-11-12',
      durationDays: 3,
      travelers: 2,
      budgetTotal: 3000,
      currency: 'MAD',
      cities: ['Marrakech'],
      interests: ['culture', 'gastronomie'],
      avoid: ['overly_touristic'],
      comfort: 'mid-range',
      transport: 'walk',
      travelerType: 'couple',
      alreadyInMorocco: false,
      language: 'fr',
    },
  })
  const tripId = created.body?.data?.id
  check('POST /trips', ok2xx(created) && !!tripId, `status ${created.status} ${JSON.stringify(created.body).slice(0, 220)}`)
  if (!tripId) throw new Error('cannot continue without a trip')

  const draftView = await call('GET', `/trips/${tripId}/view`, { token })
  check('GET /trips/:id/view (draft)', draftView.status === 200 && draftView.body.data.days.length === 3)
  check('view status is draft', draftView.body?.data?.status === 'draft')

  console.log('  (running the real AI pipeline — may take ~30s)')
  const started = Date.now()
  const generated = await call('POST', `/trips/${tripId}/generate`, { token })
  check(
    `POST /trips/:id/generate (${Math.round((Date.now() - started) / 1000)}s)`,
    ok2xx(generated),
    JSON.stringify(generated.body).slice(0, 260),
  )

  const proposal = await call('GET', `/trips/${tripId}/view`, { token })
  const proposedItems = proposal.body?.data?.days?.flatMap((d) => d.activities) ?? []
  check('proposal has activities', proposedItems.length > 0, `got ${proposedItems.length}`)
  check('activity item exposes refId', proposedItems.every((a) => typeof a.refId === 'string' && a.refId.length > 0))
  check('activity item exposes status', proposedItems.every((a) => typeof a.status === 'string'))
  check('budget categories present', (proposal.body?.data?.budgetCategories ?? []).length === 4)
  if (proposedItems[0]) {
    console.log(`        e.g. ${proposedItems[0].startTime} ${proposedItems[0].name} (refId=${proposedItems[0].refId}, ${proposedItems[0].price ?? 'n/a'} MAD)`)
  }

  const confirmed = await call('POST', `/trips/${tripId}/confirm`, { token })
  check('POST /trips/:id/confirm', ok2xx(confirmed), JSON.stringify(confirmed.body).slice(0, 220))

  const status = await call('GET', `/trips/${tripId}/dashboard-status`, { token })
  check('GET /trips/:id/dashboard-status', status.status === 200 && status.body.data.dashboardReady === true, JSON.stringify(status.body).slice(0, 180))

  const confirmedView = await call('GET', `/trips/${tripId}/view`, { token })
  const items = confirmedView.body?.data?.days?.flatMap((d) => d.activities) ?? []
  check('confirmed view has real TripActivity ids', items.length > 0 && items.every((a) => /^[a-f0-9]{24}$/.test(a.id)), items[0]?.id)

  console.log('\n--- itinerary edits ---')
  const added = await call('POST', `/trips/${tripId}/activities`, {
    token,
    body: { type: 'activity', refId: 'marrakech-jardin-majorelle', day: 1, startTime: '08:00', endTime: '09:15' },
  })
  check('POST /trips/:id/activities', ok2xx(added), JSON.stringify(added.body).slice(0, 200))
  const newItemId = added.body?.data?.id ?? added.body?.data?._id

  if (newItemId) {
    const patched = await call('PATCH', `/trips/${tripId}/activities/${newItemId}`, {
      token,
      body: { status: 'visited' },
    })
    check('PATCH activity status', ok2xx(patched), JSON.stringify(patched.body).slice(0, 180))

    const reTimed = await call('PATCH', `/trips/${tripId}/activities/${newItemId}`, {
      token,
      body: { startTime: '10:00', endTime: '11:30' },
    })
    check('PATCH activity schedule', ok2xx(reTimed))

    const afterEdit = await call('GET', `/trips/${tripId}/view`, { token })
    const edited = afterEdit.body?.data?.days
      ?.flatMap((d) => d.activities)
      ?.find((a) => a.id === newItemId)
    check('edit reflected in view', edited?.status === 'visited' && edited?.startTime === '10:00', JSON.stringify(edited).slice(0, 160))

    const removed = await call('DELETE', `/trips/${tripId}/activities/${newItemId}`, { token })
    check('DELETE activity', ok2xx(removed))
  }

  console.log('\n--- AI actions ---')
  const firstActivity = items.find((a) => a.kind === 'activity')
  if (firstActivity) {
    const alts = await call('POST', `/trips/${tripId}/activities/${firstActivity.id}/replace`, { token })
    check('POST replace -> alternatives', ok2xx(alts) && Array.isArray(alts.body?.data?.alternatives), JSON.stringify(alts.body).slice(0, 200))
    console.log(`        ${alts.body?.data?.alternatives?.length ?? 0} alternative(s) proposed`)
  }

  const optimized = await call('POST', `/trips/${tripId}/optimize`, { token, body: { day: 1 } })
  check('POST /trips/:id/optimize', ok2xx(optimized), JSON.stringify(optimized.body).slice(0, 200))

  const chat = await call('POST', `/trips/${tripId}/chat`, { token, body: { message: 'Quelles activités gratuites me proposes-tu ?' } })
  check('POST /trips/:id/chat', ok2xx(chat) && typeof chat.body?.data?.reply === 'string' && chat.body.data.reply.length > 0)
  if (chat.body?.data?.reply) console.log(`        reply: ${chat.body.data.reply.slice(0, 140).replace(/\s+/g, ' ')}…`)

  const extracted = await call('POST', '/trips/extract-profile', {
    token,
    body: { text: "Je suis à Marrakech, j'ai 1500 DH pour 2 jours, nous sommes 2, j'aime la culture et la nourriture." },
  })
  check(
    'POST /trips/extract-profile',
    ok2xx(extracted) && extracted.body?.data?.travelers === 2 && extracted.body?.data?.budgetTotal === 1500,
    `status ${extracted.status} ${JSON.stringify(extracted.body).slice(0, 200)}`,
  )

  console.log('\n--- ownership isolation ---')
  const otherEmail = `smoke-other-${Date.now()}@example.test`
  await call('POST', '/auth/register', { body: { fullname: 'Other', email: otherEmail, password } })
  await users.updateOne({ email: otherEmail }, { $set: { emailVerified: true } })
  const otherLogin = await call('POST', '/auth/login', { body: { email: otherEmail, password } })
  const otherToken = otherLogin.body?.data?.accessToken
  const stolen = await call('GET', `/trips/${tripId}/view`, { token: otherToken })
  check("another user gets 404 on someone else's trip", stolen.status === 404, `status ${stolen.status}`)

  // Cleanup
  await mongoose.connection.db.collection('trips').deleteMany({})
  await mongoose.connection.db.collection('tripactivities').deleteMany({})
  await users.deleteMany({ email: { $in: [email, otherEmail] } })
  await mongoose.disconnect()

  console.log(`\n${pass} passed, ${fail} failed\n`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error('\nFATAL:', e.message)
  try {
    await mongoose.disconnect()
  } catch {
    /* already closed */
  }
  process.exit(1)
})
