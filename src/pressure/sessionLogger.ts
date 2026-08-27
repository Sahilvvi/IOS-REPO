/**
 * CSV session logger — records pressure + IMU data for later analysis.
 *
 * Each session writes to a separate CSV file in the app's document directory.
 */
// SDK 54's default `expo-file-system` export dropped documentDirectory /
// EncodingType / etc. in favour of a class-based File/Directory API — the
// `/legacy` subpath keeps the old function-based API this module (and
// SessionService.ts) is written against.
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const SESSION_DIR = `${FileSystem.documentDirectory}sessions/`;
const SAMPLE_HZ = 10;

let sessionFile: string | null = null;
let sessionWriter: string[] = [];
let sessionStartMs = 0;
let subjectId = 'unknown';
let sessionId = '';
let rowCount = 0;
let active = false;
let lastRecordMs = 0;

async function ensureDir() {
 try {
 await FileSystem.makeDirectoryAsync(SESSION_DIR, { intermediates: true });
 } catch {}
}

export async function startSession(sid: string = 'unknown', notes: string = ''): Promise<boolean> {
 if (active) return false;
 await ensureDir();

 subjectId = sid;
 sessionId = `${Date.now()}_${sid}`;
 sessionStartMs = Date.now();
 rowCount = 0;
 sessionWriter = [];
 active = true;
 lastRecordMs = 0;

 const header = [
 'timestamp_ms', 'session_id',
 ...Array.from({ length: 18 }, (_, i) => `n${i}`),
 'ax','ay','az','gx','gy','gz','temp_c',
 'activity', 'source', 'notes',
 ].join(',');
 sessionWriter.push(header);

 if (notes) {
 sessionWriter.push(`# notes: ${notes}`);
 }

 return true;
}

export function record(pressure: number[], imu: Record<string, any>, source: string = 'simulated') {
 if (!active) return;

 const now = Date.now();
 const samplePeriod = (1.0 / SAMPLE_HZ) * 1000;
 if (now - lastRecordMs < samplePeriod) return;
 lastRecordMs = now;

 const p = pressure.slice(0, 18);
 while (p.length < 18) p.push(0);

 const row = [
 now.toString(),
 sessionId,
 ...p.map(v => v.toFixed(3)),
 imu.ax?.toFixed(3) ?? '0.000',
 imu.ay?.toFixed(3) ?? '0.000',
 imu.az?.toFixed(3) ?? '0.000',
 imu.gx?.toFixed(4) ?? '0.0000',
 imu.gy?.toFixed(4) ?? '0.0000',
 imu.gz?.toFixed(4) ?? '0.0000',
 imu.temp?.toFixed(2) ?? '0.00',
 imu.activity ?? 'UNKNOWN',
 source,
 '',
 ].join(',');

 sessionWriter.push(row);
 rowCount++;

 if (rowCount % 50 === 0) {
 flushSync();
 }
}

function flushSync() {
 if (!active || !sessionWriter.length) return;
 const content = sessionWriter.join('\n');
 const path = `${SESSION_DIR}session_${sessionId}.csv`;

 FileSystem.writeAsStringAsync(path, content, { encoding: FileSystem.EncodingType.UTF8 }).catch(() => {});
 sessionWriter = [];
}

export async function endSession(endNotes: string = ''): Promise<string | null> {
 if (!active) return null;
 active = false;

 flushSync();

 const duration_s = (Date.now() - sessionStartMs) / 1000;
 const path = `${SESSION_DIR}session_${sessionId}.csv`;

 try {
 const entry = `${sessionId},${subjectId},${sessionStartMs},${Date.now()},${duration_s.toFixed(1)},${rowCount},${path},${endNotes}\n`;
 const indexPath = `${SESSION_DIR}_index.csv`;
 // expo-file-system has never had an appendStringAsync — read-modify-write
 // the whole index instead. Session indexes stay small (one line per wear
 // session), so this is cheap.
 const info = await FileSystem.getInfoAsync(indexPath);
 if (info.exists) {
 const existing = await FileSystem.readAsStringAsync(indexPath);
 await FileSystem.writeAsStringAsync(indexPath, existing + entry);
 } else {
 await FileSystem.writeAsStringAsync(indexPath, `session_id,subject_id,start_ms,end_ms,duration_s,rows,file,notes\n${entry}`);
 }
 } catch {}

 const sid = sessionId;
 sessionId = '';
 sessionFile = null;
 rowCount = 0;
 return sid;
}

export async function annotateSession(note: string) {
 if (!active || !note) return;
 sessionWriter.push(`# annotation: ${note}`);
}

export function isActive(): boolean {
 return active;
}

export function getStatus() {
 return {
 active,
 session_id: sessionId || null,
 subject_id: subjectId,
 rows: rowCount,
 duration_s: active ? (Date.now() - sessionStartMs) / 1000 : 0,
 };
}
