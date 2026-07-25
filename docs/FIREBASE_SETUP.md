# Firebase setup for بصيرة

Everything below is a one-time setup. Until it is done the app still runs — the
Quran reader, hadith search and prayer times are unaffected — but tafsir source
cards show «يتطلب عرض … اتصالًا بالإنترنت» because there is nowhere to fetch the
text from yet.

Commands are written for **PowerShell on Windows**. Bash equivalents are noted
where they differ.

---

## What you are creating

| Thing | Why | Cost |
|---|---|---|
| Firebase project | container for everything | free |
| Web App | gives the 6 `EXPO_PUBLIC_FIREBASE_*` values | free |
| Cloud Firestore | holds 11,518 tafsir passages (~64 MB) | free tier: 1 GiB stored, 50k reads/day, 20k writes/day |
| Service-account key | lets the import script write | free |

**Stay on the Spark (free) plan.** The import is ~11,522 writes, inside the
20k/day free quota, and a question costs ~3 reads (0 on a cache hit). No Cloud
Functions are used, because the assistant explanation is deterministic rather
than AI-generated — so Blaze is not required.

---

## 1. Install the CLI and sign in

```powershell
npm install -g firebase-tools
firebase login
```

`firebase login` opens a browser for Google sign-in. Do this yourself — never
paste Google credentials into any tool.

## 2. The project

This repo targets the existing project **`bassera-fe862`**, already set in
`.firebaserc`. Confirm the CLI agrees:

```powershell
firebase use
firebase projects:list
```

If you ever need to point somewhere else: `firebase use --add`.

## 3. Firestore database

Console → **Build → Firestore Database**.

If a database already exists, note its region and skip ahead — **the region is
permanent and cannot be moved**. That is fine for this app either way: tafsir
passages are cached on-device after first read, so region only affects the
first fetch of each passage.

If there is no database yet, **Create database**:

- **Production mode.** Do NOT pick test mode — it leaves the database
  world-writable for 30 days, and this repo ships real rules already.
- Region **`me-central1` (Doha)** — closest to Jordan and the Gulf.

CLI alternative (availability varies by CLI version):

```powershell
firebase firestore:databases:create "(default)" --location=me-central1
```

> **Reusing an existing project:** `firebase deploy --only firestore:rules`
> **replaces** whatever rules are currently live. If anything else already
> talks to `bassera-fe862`, check what collections exist and what rules are
> deployed before step 5, or you may break it.

## 4. Register a Web App and capture the config

Console → **Project settings ⚙ → Your apps → Web (`</>`)**, register it, then
copy the `firebaseConfig` values. Or:

```powershell
firebase apps:create web "Baseera"
firebase apps:sdkconfig web
```

Copy `.env.example` to `.env` and fill in the six values:

```powershell
Copy-Item .env.example .env
notepad .env
```

```
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=1:...:web:...
```

`.env` is gitignored. These values are **not secrets** — Firebase client config
is designed to ship inside the app, and security rules are what control access.

## 5. Deploy rules and the index exemption

```powershell
firebase deploy --only firestore:rules,firestore:indexes
```

### Why the index exemption matters

`firestore.indexes.json` disables indexing on `tafsir_content.t` and
`tafsir_index.runs` (`"indexes": []`).

Firestore indexes every field automatically and caps an index entry at roughly
1,500 bytes. Tafsir explanations average 9–14 KB and peak at **145.9 KB**, so
without the exemption **most writes fail with `INVALID_ARGUMENT`** — and any
that succeeded would roughly double storage cost for an index nothing queries,
since passages are always fetched by document id.

Deploy this **before** importing. The importer also writes the single largest
document first as a canary, so if the exemption is missing it aborts on write #1
with instructions instead of failing partway through 11,518 documents.

## 6. Get a service-account key (import only)

Console → **Project settings ⚙ → Service accounts → Generate new private key**.

Save it **outside the repo** — e.g. `C:\Users\motas\keys\baseera-admin.json`.

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\Users\motas\keys\baseera-admin.json"
```

Bash: `export GOOGLE_APPLICATION_CREDENTIALS=/c/Users/motas/keys/baseera-admin.json`

This key bypasses all security rules. Never commit it, never put it in `.env`,
never paste it into a chat. `.gitignore` already covers `serviceAccount*.json`,
`firebase-admin*.json` and `*-firebase-adminsdk-*.json`, but keeping it outside
the repo is safer still.

## 7. Validate, then import

Run these **in order**. Nothing uploads until the last one.

```powershell
npm run firebase:tafsir:validate    # data shape, sizes, projected writes
npm run firebase:tafsir:selfcheck   # proves the model is lossless, offline
npm run firebase:tafsir:dry-run     # exact write plan, still writes nothing
npm run firebase:tafsir:import      # the only command that uploads
npm run firebase:tafsir:verify      # re-reads samples and diffs them
```

Expected from `validate`:

```
مستندات المحتوى          11518
الحجم المخزَّن             64.16 MB
عمليات الكتابة           11522
✓ الاستيراد يقع ضمن الحصة المجانية.
```

Expected from `selfcheck` — this is the important one, it rebuilds every ayah
from the Firestore model and diffs it against the original JSON:

```
✓ تفسير السعدي     أعيد بناء 6236/6236  مفقود=0  مختلف=0
✓ تفسير ابن كثير   أعيد بناء 6236/6236  مفقود=0  مختلف=0
✓ تفسير الطبري     أعيد بناء 6236/6236  مفقود=0  مختلف=0
```

The import takes a few minutes. It is **resumable and idempotent** — document
ids are the sha256 of the text, so re-running after an interruption is always
safe and converges to identical bytes. A single source can be done at a time:

```powershell
node scripts/firebase/importTafsir.mjs --source=al_saadi
```

## 8. Run the app

```powershell
npm run web
```

Ask «ما تفسير الآية 255 من سورة البقرة؟» and you should get three source cards —
السعدي، ابن كثير، الطبري — each with its own verbatim text.

---

## Optional: Storage (only needed for avatars, not yet built)

Console → **Build → Storage → Get started**, then:

```powershell
firebase deploy --only storage
```

## Optional: emulators

Requires a **JDK**, which is not currently installed on this machine. Without
Java the Firestore emulator cannot start.

```powershell
firebase emulators:start
```

Then set `EXPO_PUBLIC_USE_FIREBASE_EMULATOR=1` in `.env`. The app only honours
that flag in development — a production build never connects to emulators.

---

## Troubleshooting

**`INVALID_ARGUMENT` on the first write** — the index exemption from step 5 is
missing. Deploy it, then re-run the import.

**`GOOGLE_APPLICATION_CREDENTIALS` not set** — step 6. The variable only lives
for the current terminal session; re-set it in a new window.

**Cards still say «يتطلب … اتصالًا بالإنترنت» after importing** — `.env` is
missing or still has placeholder values. Restart the Expo dev server after
editing `.env`; Expo inlines `EXPO_PUBLIC_*` at build time, so a running server
will not pick up changes.

**`PERMISSION_DENIED` reading tafsir from the app** — rules were not deployed
(step 5). `tafsir_content` must be world-readable and client-write-denied.

---

## What is NOT set up yet

Auth, user profiles, bookmark/reading-progress/settings sync, chat history and
avatars are designed and their rules are already deployed by step 5, but the
client code for them is not written yet. The app continues to store all user
data locally on the device, exactly as it does today.
