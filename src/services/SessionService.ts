/**
 * Session data service — read, list, delete, and export recorded sessions.
 *
 * Reads the session index written by sessionLogger.ts and provides
 * typed access to session metadata and CSV data.
 */
// See sessionLogger.ts for why this is the /legacy subpath.
import * as FileSystem from 'expo-file-system/legacy';

const SESSION_DIR = `${FileSystem.documentDirectory}sessions/`;
const INDEX_PATH = `${SESSION_DIR}_index.csv`;

export interface SessionMeta {
 id: string;
 subjectId: string;
 startMs: number;
 endMs: number;
 durationSec: number;
 rows: number;
 file: string;
 notes: string;
}

/**
 * Read and parse the session index CSV.
 * Returns an empty array if the index does not exist yet.
 */
export async function listSessions(): Promise<SessionMeta[]> {
 try {
 const exists = await FileSystem.getInfoAsync(INDEX_PATH);
 if (!exists.exists) return [];
 const raw = await FileSystem.readAsStringAsync(INDEX_PATH);
 return parseIndex(raw);
 } catch {
 return [];
 }
}

/**
 * Parse the raw index CSV into SessionMeta objects.
 * Handles a header row and drops any malformed lines.
 */
function parseIndex(raw: string): SessionMeta[] {
 const lines = raw.trim().split('\n');
 if (lines.length < 2) return [];

 const entries: SessionMeta[] = [];
 for (let i = 1; i < lines.length; i++) {
 const line = lines[i].trim();
 if (!line) continue;
 const cols = line.split(',');
 if (cols.length < 7) continue;

 const [id, subjectId, startMsStr, endMsStr, durationStr, rowsStr, file] = cols;
 const notes = cols.slice(7).join(',') || '';

 const meta: SessionMeta = {
 id: id || '',
 subjectId: subjectId || 'unknown',
 startMs: Number(startMsStr) || 0,
 endMs: Number(endMsStr) || 0,
 durationSec: Number(durationStr) || 0,
 rows: Number(rowsStr) || 0,
 file: file || '',
 notes,
 };

 if (meta.id) entries.push(meta);
 }

 return entries;
}

/**
 * Read the CSV data for a single session.
 * Returns the raw CSV content, or null if the file is missing.
 */
export async function readSessionCsv(sessionId: string): Promise<string | null> {
 const sessions = await listSessions();
 const meta = sessions.find(s => s.id === sessionId);
 if (!meta) return null;

 try {
 const info = await FileSystem.getInfoAsync(meta.file);
 if (!info.exists) return null;
 return await FileSystem.readAsStringAsync(meta.file);
 } catch {
 return null;
 }
}

/**
 * Parse CSV rows from a session file.
 * Returns array of arrays of strings (values).
 * Skips comment lines starting with '#'.
 */
export function parseCsvRows(csv: string): string[][] {
 const rows: string[][] = [];
 for (const line of csv.split('\n')) {
 const trimmed = line.trim();
 if (!trimmed || trimmed.startsWith('#')) continue;
 rows.push(trimmed.split(','));
 }
 return rows;
}

/**
 * Extract pressure readings (first 18 channels) from parsed CSV rows.
 * Returns an array of number arrays, one per sample.
 */
export function extractPressureData(rows: string[][]): number[][] {
 const data: number[][] = [];
 for (const row of rows) {
 if (row.length < 20) continue;
 const timestamp = Number(row[0]);
 if (!timestamp) continue;
 const channels = row.slice(2, 20).map(v => Number(v));
 if (channels.some(v => !isNaN(v))) {
 data.push(channels);
 }
 }
 return data;
}

/**
 * Compute peak pressure per sample row (max of first 18 channels).
 */
export function extractPeakPressure(rows: string[][]): number[] {
 const peaks: number[] = [];
 for (const row of rows) {
 if (row.length < 20) continue;
 if (!Number(row[0])) continue;
 const vals = row.slice(2, 20).map(Number).filter(v => !isNaN(v));
 if (vals.length) {
 peaks.push(Math.max(...vals));
 }
 }
 return peaks;
}

/**
 * Delete a session: remove its CSV file and remove the entry from the index.
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
 const sessions = await listSessions();
 const meta = sessions.find(s => s.id === sessionId);
 if (!meta) return false;

 try {
 // Remove the session CSV file
 await FileSystem.deleteAsync(meta.file, { idempotent: true });
 } catch {
 // File may not exist — continue
 }

 // Rewrite the index without this entry
 try {
 const raw = await FileSystem.readAsStringAsync(INDEX_PATH);
 const lines = raw.split('\n');
 const kept = lines.filter(l => !l.startsWith(`${sessionId},`));
 const header = 'session_id,subject_id,start_ms,end_ms,duration_s,rows,file,notes\n';
 await FileSystem.writeAsStringAsync(INDEX_PATH, header + kept.join('\n'));
 return true;
 } catch {
 return false;
 }
}

/**
 * Export a session by writing it to a temp location and sharing it.
 * Returns the local URI of the exported file, or null on failure.
 */
export async function exportSession(sessionId: string): Promise<string | null> {
 const meta = (await listSessions()).find(s => s.id === sessionId);
 if (!meta) return null;

 try {
 const csvContent = await FileSystem.readAsStringAsync(meta.file);
 const date = new Date(meta.startMs);
 const stamp = date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
 const exportName = `AVA_Fit_${stamp}_${meta.subjectId}.csv`;
 const exportUri = `${FileSystem.cacheDirectory}${exportName}`;

 await FileSystem.writeAsStringAsync(exportUri, csvContent, {
 encoding: FileSystem.EncodingType.UTF8,
 });
 return exportUri;
 } catch {
 return null;
 }
}

/**
 * Get today's session stats: count of sessions and total duration in seconds.
 */
export async function getTodaySessionStats(): Promise<{ count: number; totalHours: number }> {
 const sessions = await listSessions();
 const today = new Date();
 today.setHours(0, 0, 0, 0);
 const todayStart = today.getTime();

 const todaySessions = sessions.filter(s => s.startMs >= todayStart);
 const totalSec = todaySessions.reduce((sum, s) => sum + s.durationSec, 0);

 return {
 count: todaySessions.length,
 totalHours: totalSec / 3600,
 };
}

/**
 * Format seconds into a human-readable duration string.
 */
export function formatDuration(seconds: number): string {
 const h = Math.floor(seconds / 3600);
 const m = Math.floor((seconds % 3600) / 60);
 if (h > 0) return `${h}h ${m}m`;
 if (m > 0) return `${m}m`;
 return '<1m';
}

/**
 * Format a Unix ms timestamp into a readable date string.
 */
export function formatDate(ms: number): string {
 const d = new Date(ms);
 const now = new Date();
 const isToday = d.toDateString() === now.toDateString();

 const time = d.toLocaleTimeString('en-US', {
 hour: 'numeric',
 minute: '2-digit',
 hour12: true,
 });

 if (isToday) return `Today · ${time}`;

 const yesterday = new Date(now);
 yesterday.setDate(yesterday.getDate() - 1);
 if (d.toDateString() === yesterday.toDateString()) return `Yesterday · ${time}`;

 return d.toLocaleDateString('en-US', {
 month: 'short',
 day: 'numeric',
 }) + ` · ${time}`;
}
