import * as SQLite from 'expo-sqlite';

/** Where the service happened — single-select chips on the entry form. */
export const CATEGORY_OPTIONS = [
  'Community',
  'School',
  'Faith-based',
  'Health',
  'Animals',
  'Environment',
  'Other',
] as const;

export type Category = (typeof CATEGORY_OPTIONS)[number] | '';

export interface Entry {
  id: number;
  /** Calendar date of the service, YYYY-MM-DD (local). */
  date: string;
  /** Minutes of volunteer service. */
  durationMin: number;
  organization: string;
  category: Category;
  /** Supervisor / coordinator who can verify the hours. */
  supervisor: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('merit.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          duration_min INTEGER NOT NULL,
          organization TEXT NOT NULL DEFAULT '',
          category TEXT NOT NULL DEFAULT '',
          supervisor TEXT NOT NULL DEFAULT '',
          notes TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
      `);
      return db;
    })();
  }
  return dbPromise;
}

function rowToEntry(row: any): Entry {
  return {
    id: row.id,
    date: row.date,
    durationMin: row.duration_min ?? 0,
    organization: row.organization ?? '',
    category: (row.category ?? '') as Category,
    supervisor: row.supervisor ?? '',
    notes: row.notes ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface EntryInput {
  date: string;
  durationMin: number;
  organization: string;
  category: Category;
  supervisor: string;
  notes: string;
}

function clean(input: EntryInput): EntryInput {
  return {
    ...input,
    durationMin: Math.max(0, Math.round(input.durationMin)),
    organization: input.organization.trim(),
    supervisor: input.supervisor.trim(),
    notes: input.notes.trim(),
  };
}

export async function insertEntry(input: EntryInput): Promise<number> {
  const db = await getDb();
  const now = Date.now();
  const i = clean(input);
  const res = await db.runAsync(
    `INSERT INTO entries
       (date, duration_min, organization, category, supervisor, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [i.date, i.durationMin, i.organization, i.category, i.supervisor, i.notes, now, now]
  );
  return res.lastInsertRowId;
}

export async function updateEntry(id: number, input: EntryInput): Promise<void> {
  const db = await getDb();
  const i = clean(input);
  await db.runAsync(
    `UPDATE entries SET
       date = ?, duration_min = ?, organization = ?, category = ?,
       supervisor = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
    [i.date, i.durationMin, i.organization, i.category, i.supervisor, i.notes, Date.now(), id]
  );
}

export async function deleteEntry(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM entries WHERE id = ?', [id]);
}

export async function getEntry(id: number): Promise<Entry | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>('SELECT * FROM entries WHERE id = ?', [id]);
  return row ? rowToEntry(row) : null;
}

/** All entries, newest first (by service date, then recency of entry). */
export async function getEntries(): Promise<Entry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM entries ORDER BY date DESC, id DESC LIMIT 5000'
  );
  return rows.map(rowToEntry);
}

export async function countEntries(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>('SELECT COUNT(*) AS n FROM entries');
  return row?.n ?? 0;
}

/** Organizations the user has already logged, most recent first (autofill chips). */
export async function getRecentOrganizations(limit = 6): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT organization, MAX(id) AS last_id FROM entries
     WHERE organization <> ''
     GROUP BY organization
     ORDER BY last_id DESC
     LIMIT ?`,
    [limit]
  );
  return rows.map((r) => r.organization as string);
}

export interface Stats {
  entryCount: number;
  totalMin: number;
  orgCount: number;
  longestMin: number;
  firstDate: string | null;
  lastDate: string | null;
}

export async function getStats(): Promise<Stats> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(
    `SELECT
       COUNT(*) AS n,
       COALESCE(SUM(duration_min), 0) AS total_min,
       COUNT(DISTINCT CASE WHEN organization <> '' THEN organization END) AS org_count,
       COALESCE(MAX(duration_min), 0) AS longest,
       MIN(date) AS first_date,
       MAX(date) AS last_date
     FROM entries`
  );
  return {
    entryCount: row?.n ?? 0,
    totalMin: row?.total_min ?? 0,
    orgCount: row?.org_count ?? 0,
    longestMin: row?.longest ?? 0,
    firstDate: row?.first_date ?? null,
    lastDate: row?.last_date ?? null,
  };
}

export async function deleteAllData(): Promise<void> {
  const db = await getDb();
  await db.execAsync('DELETE FROM entries;');
}

/** CSV export (RFC-4180), oldest first — matches paper-form order. */
export async function exportCsv(): Promise<string> {
  const entries = await getEntries();
  const q = (s: string) => '"' + s.replace(/"/g, '""') + '"';
  const lines = ['date,hours,organization,category,supervisor,notes'];
  for (const e of [...entries].reverse()) {
    lines.push(
      [
        e.date,
        (e.durationMin / 60).toFixed(2),
        q(e.organization),
        q(e.category),
        q(e.supervisor),
        q(e.notes),
      ].join(',')
    );
  }
  return lines.join('\r\n');
}

/** "3h 45m" style formatting used across the app. */
export function fmtHours(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Decimal hours for forms and the PDF totals column ("2.5"). */
export function fmtDecimalHours(min: number): string {
  const h = min / 60;
  return Number.isInteger(h) ? String(h) : h.toFixed(h * 10 === Math.round(h * 10) ? 1 : 2);
}
