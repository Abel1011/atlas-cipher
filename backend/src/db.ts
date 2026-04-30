import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data.db');

const db = new Database(DB_PATH);

export const LEGACY_GAME_SESSION_PLAYER_ID = '__legacy_local_player__';

export function initDb(): void {
  db.pragma('journal_mode = WAL');
  ensureGameSessionTable();

  db.exec(`
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      template_id TEXT,
      template_slug TEXT,
      template_title TEXT,
      source TEXT NOT NULL DEFAULT 'seed',
      difficulty INTEGER NOT NULL DEFAULT 1,
      min_level INTEGER NOT NULL DEFAULT 1,
      crime_description TEXT NOT NULL,
      correct_suspect_id TEXT NOT NULL,
      handler_agent_id TEXT,
      handler_system_prompt TEXT NOT NULL,
      raw_case_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cities (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES cases(id),
      name TEXT NOT NULL,
      country TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      scene_image_id TEXT,
      panorama_image_id TEXT,
      ambient_sound_id TEXT,
      visit_order INTEGER NOT NULL,
      unlocked INTEGER NOT NULL DEFAULT 0,
      visited INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS witnesses (
      id TEXT PRIMARY KEY,
      city_id TEXT NOT NULL REFERENCES cities(id),
      case_id TEXT NOT NULL REFERENCES cases(id),
      name TEXT NOT NULL,
      personality TEXT NOT NULL,
      backstory TEXT NOT NULL,
      knowledge TEXT NOT NULL,
      portrait_image_id TEXT,
      agent_id TEXT,
      voice_id TEXT,
      voice_description TEXT NOT NULL,
      system_prompt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS suspects (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES cases(id),
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      is_correct INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS clues (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES cases(id),
      witness_id TEXT REFERENCES witnesses(id),
      content TEXT NOT NULL,
      is_misleading INTEGER NOT NULL DEFAULT 0,
      points_to_city_id TEXT REFERENCES cities(id),
      points_to_suspect_id TEXT REFERENCES suspects(id),
      discovered INTEGER NOT NULL DEFAULT 0,
      discovered_at TEXT
    );

    CREATE TABLE IF NOT EXISTS generated_assets (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      data BLOB NOT NULL,
      mime_type TEXT NOT NULL,
      prompt TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS case_templates (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      difficulty INTEGER NOT NULL DEFAULT 1,
      min_level INTEGER NOT NULL DEFAULT 1,
      raw_case_json TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'seed',
      consumed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS player_progress (
      user_id TEXT PRIMARY KEY,
      display_name TEXT,
      level INTEGER NOT NULL DEFAULT 1,
      experience INTEGER NOT NULL DEFAULT 0,
      solved_cases INTEGER NOT NULL DEFAULT 0,
      failed_cases INTEGER NOT NULL DEFAULT 0,
      abandoned_cases INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS player_mission_history (
      user_id TEXT NOT NULL,
      template_id TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, template_id)
    );

    CREATE TABLE IF NOT EXISTS player_mission_snapshots (
      user_id TEXT NOT NULL,
      template_id TEXT NOT NULL,
      case_id TEXT NOT NULL REFERENCES cases(id),
      status TEXT NOT NULL,
      current_city_id TEXT,
      remaining_hours INTEGER NOT NULL,
      total_hours INTEGER NOT NULL,
      remaining_credits INTEGER NOT NULL,
      total_credits INTEGER NOT NULL,
      support_calls_remaining INTEGER NOT NULL,
      city_visit_token INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, template_id)
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS handler_call_memory (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      case_id TEXT NOT NULL REFERENCES cases(id),
      note TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS witness_call_memory (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      case_id TEXT NOT NULL REFERENCES cases(id),
      witness_id TEXT NOT NULL REFERENCES witnesses(id),
      note TEXT NOT NULL,
      transcript TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS witness_visit_contacts (
      user_id TEXT NOT NULL,
      case_id TEXT NOT NULL REFERENCES cases(id),
      witness_id TEXT NOT NULL REFERENCES witnesses(id),
      city_visit_token INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, case_id, witness_id, city_visit_token)
    );

    CREATE TABLE IF NOT EXISTS mission_notes (
      user_id TEXT NOT NULL,
      case_id TEXT NOT NULL REFERENCES cases(id),
      content TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, case_id)
    );

    CREATE TABLE IF NOT EXISTS mission_note_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      case_id TEXT NOT NULL REFERENCES cases(id),
      context_type TEXT NOT NULL DEFAULT 'general',
      context_id TEXT,
      context_label TEXT,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_mission_note_entries_lookup
      ON mission_note_entries(user_id, case_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_handler_call_memory_user_case
      ON handler_call_memory(user_id, case_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_player_mission_history_user_status
      ON player_mission_history(user_id, status, updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_player_mission_snapshots_user_updated
      ON player_mission_snapshots(user_id, updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_witness_call_memory_user_case_witness
      ON witness_call_memory(user_id, case_id, witness_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_witness_visit_contacts_lookup
      ON witness_visit_contacts(user_id, case_id, city_visit_token, witness_id);
  `);

  ensureWitnessVoiceColumn();
  ensureWitnessCallMemoryTranscriptColumn();
  ensureCaseMetadataColumns();
  ensureCaseTemplateColumns();
  ensurePlayerDisplayNameColumn();
  ensureCityUnlockColumn();
  ensureCityPanoramaColumn();
  ensureGameSessionMissionColumns();
  migrateLegacyMissionNotesBlob();
}

function migrateLegacyMissionNotesBlob(): void {
  const tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'mission_notes'"
  ).get();
  if (!tableExists) return;

  const blobs = db.prepare(
    "SELECT user_id, case_id, content, updated_at FROM mission_notes WHERE TRIM(content) <> ''"
  ).all() as Array<{ user_id: string; case_id: string; content: string; updated_at: string }>;
  if (!blobs.length) return;

  const hasEntry = db.prepare(
    'SELECT 1 FROM mission_note_entries WHERE user_id = ? AND case_id = ? LIMIT 1'
  );
  const insert = db.prepare(
    `INSERT INTO mission_note_entries (id, user_id, case_id, context_type, context_id, context_label, content, created_at, updated_at)
     VALUES (?, ?, ?, 'general', NULL, NULL, ?, ?, ?)`
  );
  const clear = db.prepare(
    "UPDATE mission_notes SET content = '' WHERE user_id = ? AND case_id = ?"
  );

  for (const row of blobs) {
    if (hasEntry.get(row.user_id, row.case_id)) continue;
    const id = `mn_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
    insert.run(id, row.user_id, row.case_id, row.content, row.updated_at, row.updated_at);
    clear.run(row.user_id, row.case_id);
  }
}

function ensureGameSessionTable(): void {
  const existingTable = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'game_session'"
  ).get() as { name: string } | undefined;

  if (!existingTable) {
    createGameSessionTable();
    return;
  }

  const columns = db.prepare("PRAGMA table_info(game_session)").all() as Array<{ name: string }>;
  if (columns.some(column => column.name === 'user_id')) {
    return;
  }

  const legacyRows = db.prepare(
    'SELECT case_id, current_city_id, status, created_at, updated_at FROM game_session'
  ).all() as Array<{
    case_id: string;
    current_city_id: string | null;
    status: string;
    created_at: string | null;
    updated_at: string | null;
  }>;

  db.exec('ALTER TABLE game_session RENAME TO game_session_legacy');
  createGameSessionTable();

  if (legacyRows.length > 0) {
    const insert = db.prepare(`
      INSERT INTO game_session (
        user_id,
        case_id,
        current_city_id,
        status,
        remaining_hours,
        total_hours,
        remaining_credits,
        total_credits,
        support_calls_remaining,
        city_visit_token,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const [index, row] of legacyRows.entries()) {
      const legacyPlayerId = index === 0
        ? LEGACY_GAME_SESSION_PLAYER_ID
        : `${LEGACY_GAME_SESSION_PLAYER_ID}:${index + 1}`;

      insert.run(
        legacyPlayerId,
        row.case_id,
        row.current_city_id,
        row.status,
        0,
        0,
        0,
        0,
        0,
        1,
        row.created_at || new Date().toISOString(),
        row.updated_at || new Date().toISOString()
      );
    }
  }

  db.exec('DROP TABLE game_session_legacy');
}

function createGameSessionTable(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_session (
      user_id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      current_city_id TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      remaining_hours INTEGER NOT NULL DEFAULT 0,
      total_hours INTEGER NOT NULL DEFAULT 0,
      remaining_credits INTEGER NOT NULL DEFAULT 0,
      total_credits INTEGER NOT NULL DEFAULT 0,
      support_calls_remaining INTEGER NOT NULL DEFAULT 0,
      city_visit_token INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

/* Adds the witnesses.voice_id column for installs created before voice-design support. */
function ensureWitnessVoiceColumn(): void {
  const witnessesExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'witnesses'"
  ).get();
  if (!witnessesExists) return;

  const columns = db.prepare("PRAGMA table_info(witnesses)").all() as Array<{ name: string }>;
  if (!columns.some(c => c.name === 'voice_id')) {
    db.exec('ALTER TABLE witnesses ADD COLUMN voice_id TEXT');
  }
}

function ensureWitnessCallMemoryTranscriptColumn(): void {
  const exists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'witness_call_memory'"
  ).get();
  if (!exists) return;

  const columns = db.prepare("PRAGMA table_info(witness_call_memory)").all() as Array<{ name: string }>;
  if (!columns.some(c => c.name === 'transcript')) {
    db.exec('ALTER TABLE witness_call_memory ADD COLUMN transcript TEXT');
  }
}

function ensureCityUnlockColumn(): void {
  const citiesExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'cities'"
  ).get();
  if (!citiesExists) return;

  const columns = db.prepare("PRAGMA table_info(cities)").all() as Array<{ name: string }>;
  if (!columns.some(c => c.name === 'unlocked')) {
    db.exec('ALTER TABLE cities ADD COLUMN unlocked INTEGER NOT NULL DEFAULT 0');
  }
}

function ensureCityPanoramaColumn(): void {
  const citiesExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'cities'"
  ).get();
  if (!citiesExists) return;

  const columns = db.prepare("PRAGMA table_info(cities)").all() as Array<{ name: string }>;
  if (!columns.some(c => c.name === 'panorama_image_id')) {
    db.exec('ALTER TABLE cities ADD COLUMN panorama_image_id TEXT');
  }
}

function ensureGameSessionMissionColumns(): void {
  const sessionExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'game_session'"
  ).get();
  if (!sessionExists) return;

  const columns = db.prepare("PRAGMA table_info(game_session)").all() as Array<{ name: string }>;
  const missingColumns = [
    ['remaining_hours', 'ALTER TABLE game_session ADD COLUMN remaining_hours INTEGER NOT NULL DEFAULT 0'],
    ['total_hours', 'ALTER TABLE game_session ADD COLUMN total_hours INTEGER NOT NULL DEFAULT 0'],
    ['remaining_credits', 'ALTER TABLE game_session ADD COLUMN remaining_credits INTEGER NOT NULL DEFAULT 0'],
    ['total_credits', 'ALTER TABLE game_session ADD COLUMN total_credits INTEGER NOT NULL DEFAULT 0'],
    ['support_calls_remaining', 'ALTER TABLE game_session ADD COLUMN support_calls_remaining INTEGER NOT NULL DEFAULT 0'],
    ['city_visit_token', 'ALTER TABLE game_session ADD COLUMN city_visit_token INTEGER NOT NULL DEFAULT 1'],
  ] as const;

  for (const [columnName, statement] of missingColumns) {
    if (!columns.some(column => column.name === columnName)) {
      db.exec(statement);
    }
  }
}

function ensureCaseMetadataColumns(): void {
  const casesExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'cases'"
  ).get();
  if (!casesExists) return;

  const columns = db.prepare("PRAGMA table_info(cases)").all() as Array<{ name: string }>;

  if (!columns.some(c => c.name === 'template_id')) {
    db.exec('ALTER TABLE cases ADD COLUMN template_id TEXT');
  }

  if (!columns.some(c => c.name === 'template_slug')) {
    db.exec('ALTER TABLE cases ADD COLUMN template_slug TEXT');
  }

  if (!columns.some(c => c.name === 'template_title')) {
    db.exec('ALTER TABLE cases ADD COLUMN template_title TEXT');
  }

  if (!columns.some(c => c.name === 'source')) {
    db.exec("ALTER TABLE cases ADD COLUMN source TEXT NOT NULL DEFAULT 'seed'");
  }

  if (!columns.some(c => c.name === 'difficulty')) {
    db.exec("ALTER TABLE cases ADD COLUMN difficulty INTEGER NOT NULL DEFAULT 1");
  }

  if (!columns.some(c => c.name === 'min_level')) {
    db.exec("ALTER TABLE cases ADD COLUMN min_level INTEGER NOT NULL DEFAULT 1");
  }
}

function ensureCaseTemplateColumns(): void {
  const templatesExist = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'case_templates'"
  ).get();
  if (!templatesExist) return;

  const columns = db.prepare("PRAGMA table_info(case_templates)").all() as Array<{ name: string }>;

  if (!columns.some(c => c.name === 'difficulty')) {
    db.exec("ALTER TABLE case_templates ADD COLUMN difficulty INTEGER NOT NULL DEFAULT 1");
  }

  if (!columns.some(c => c.name === 'min_level')) {
    db.exec("ALTER TABLE case_templates ADD COLUMN min_level INTEGER NOT NULL DEFAULT 1");
  }
}

function ensurePlayerDisplayNameColumn(): void {
  const tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'player_progress'"
  ).get();
  if (!tableExists) return;

  const columns = db.prepare("PRAGMA table_info(player_progress)").all() as Array<{ name: string }>;
  if (!columns.some(c => c.name === 'display_name')) {
    db.exec("ALTER TABLE player_progress ADD COLUMN display_name TEXT");
  }
}

export default db;
