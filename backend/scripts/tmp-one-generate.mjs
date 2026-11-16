// Temporary: one cold generation run, to separate "pipeline is broken" from
// "smoke test exhausted the per-minute token budget". Deleted after the run.
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'
import mongoose from 'mongoose'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: join(__dirname, '..', '..', '.env') })

const API = 'http://127.0.0.1:3000/api/v1'
const email = `cold-${Date.now()}@example.test`
const password = 'SmokeTest12345'

async function call(method, path, { body, token } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  let json = null
  try {
    json = await res.json()
  } catch {}
  return { status: res.status, body: json }
}

const days = Number(process.argv[2] ?? 3)

async function main() {
  await mongoose.connect(process.env.MONGODB_URI)
  const users = mongoose.connection.db.collection('users')

  await call('POST', '/auth/register', { body: { fullname: 'Cold Run', email, password } })
  await users.updateOne({ email }, { $set: { emailVerified: true } })
  const login = await call('POST', '/auth/login', { body: { email, password } })
  const token = login.body?.data?.accessToken

  const created = await call('POST', '/trips', {
    token,
    body: {
      title: 'Cold run',
      startDate: '2026-11-10',
      endDate: '2026-11-12',
      durationDays: days,
      travelers: 2,
      budgetTotal: 3000,
      currency: 'MAD',
      cities: ['Marrakech'],
      interests: ['culture'],
      avoid: [],
      comfort: 'mid-range',
      transport: 'walk',
      travelerType: 'couple',
      alreadyInMorocco: false,
      language: 'fr',
    },
  })
  const tripId = created.body?.data?.id
  console.log(`trip ${tripId} (${days} day(s)) created`)

  console.log('waiting 65s for a clean token-per-minute window…')
  await new Promise((r) => setTimeout(r, 65_000))

  const t0 = Date.now()
  const gen = await call('POST', `/trips/${tripId}/generate`, { token })
  const secs = Math.round((Date.now() - t0) / 1000)
  console.log(`generate -> HTTP ${gen.status} in ${secs}s`)
  if (gen.status >= 300) console.log(JSON.stringify(gen.body).slice(0, 300))

  const view = await call('GET', `/trips/${tripId}/view`, { token })
  const items = view.body?.data?.days?.flatMap((d) => d.activities) ?? []
  console.log(`view: ${items.length} item(s) across ${view.body?.data?.days?.length ?? 0} day(s)`)
  for (const i of items.slice(0, 8)) {
    console.log(`  ${i.startTime}-${i.endTime} [${i.kind}] ${i.name} (${i.refId}) ${i.price ?? 'n/a'} MAD`)
  }

  await mongoose.connection.db.collection('trips').deleteMany({ title: 'Cold run' })
  await mongoose.connection.db.collection('tripactivities').deleteMany({})
  await users.deleteMany({ email })
  await mongoose.disconnect()
  process.exit(items.length > 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error('FATAL:', e.message)
  try {
    await mongoose.disconnect()
  } catch {}
  process.exit(1)
})
