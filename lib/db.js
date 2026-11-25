'use strict';
// SQLite storage (built into Node.js 22.5+, no external dependencies).
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function open(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'endocontrol.db'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      pass_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'patient',      -- patient | doctor
      patient_name TEXT,                           -- whose glucose is monitored (e.g. a child)
      birth_year INTEGER,
      diabetes_type TEXT,
      lang TEXT NOT NULL DEFAULT 'en',
      units TEXT NOT NULL DEFAULT 'mg/dl',         -- mg/dl | mmol
      target_low INTEGER NOT NULL DEFAULT 70,      -- mg/dL
      target_high INTEGER NOT NULL DEFAULT 180,    -- mg/dL
      timezone TEXT,
      api_secret_enc TEXT NOT NULL,                -- encrypted, so the owner can see it again
      api_secret_sha1 TEXT NOT NULL UNIQUE,        -- what Nightscout uploaders send in the api-secret header
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'sgv',            -- sgv | mbg | cal
      date INTEGER NOT NULL,                       -- epoch ms
      sgv INTEGER,                                 -- mg/dL
      mbg INTEGER,
      direction TEXT,
      device TEXT,
      noise INTEGER,
      filtered REAL,
      unfiltered REAL,
      rssi INTEGER,
      utc_offset INTEGER,
      source TEXT,                                 -- api | librelinkup | dexcom | nightscout | csv
      UNIQUE (user_id, type, date)
    );
    CREATE INDEX IF NOT EXISTS entries_user_date ON entries(user_id, date);

    CREATE TABLE IF NOT EXISTS treatments (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,                 -- epoch ms
      event_type TEXT NOT NULL,
      carbs REAL,
      insulin REAL,
      glucose REAL,
      notes TEXT,
      entered_by TEXT,
      extra TEXT,                                  -- remaining Nightscout fields as JSON
      UNIQUE (user_id, created_at, event_type)
    );
    CREATE INDEX IF NOT EXISTS treatments_user_date ON treatments(user_id, created_at);

    CREATE TABLE IF NOT EXISTS devicestatus (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS devicestatus_user_date ON devicestatus(user_id, created_at);

    CREATE TABLE IF NOT EXISTS bridges (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,                          -- librelinkup | dexcom | nightscout
      config_enc TEXT NOT NULL,                    -- encrypted credentials
      status TEXT NOT NULL DEFAULT 'pending',      -- pending | ok | error
      last_error TEXT,
      last_poll INTEGER,
      last_data INTEGER,
      PRIMARY KEY (user_id, kind)
    );

    CREATE TABLE IF NOT EXISTS shares (
      token TEXT PRIMARY KEY,                      -- read-only access token (also works as a Nightscout ?token=)
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label TEXT,
      created_at INTEGER NOT NULL,
      expires_at INTEGER,
      revoked INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS doctor_patients (
      doctor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      share_token TEXT NOT NULL REFERENCES shares(token) ON DELETE CASCADE,
      added_at INTEGER NOT NULL,
      PRIMARY KEY (doctor_id, share_token)
    );

    CREATE TABLE IF NOT EXISTS notes (              -- messages and doctor conclusions
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,   -- the patient
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL DEFAULT 'message',        -- message | conclusion
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS notes_user ON notes(user_id, created_at);

    CREATE TABLE IF NOT EXISTS doctor_reads (         -- when a doctor last opened a patient's messages
      doctor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      read_at INTEGER NOT NULL,
      PRIMARY KEY (doctor_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS push_subs (            -- Web Push subscriptions (one per device/browser)
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS push_subs_user ON push_subs(user_id);

    CREATE TABLE IF NOT EXISTS alert_state (           -- last glucose alert sent by push, for de-duplication
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      last_kind TEXT,
      last_at INTEGER,
      snooze_until INTEGER
    );
  `);
  return db;
}

module.exports = { open };
