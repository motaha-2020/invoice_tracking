import { describe, expect, it } from 'vitest';
import { backupAlertEmail, backupHealth, parseBackupStatus } from './backup';

const now = new Date('2026-10-16T10:00:00Z');
const ok = { ok: true, at: '2026-10-16T02:15:00Z', okAt: '2026-10-16T02:15:00Z', error: null, dbBytes: 1000, uploadsBytes: 0, copies: 3 };

describe('parseBackupStatus', () => {
  it('rejects junk', () => {
    expect(parseBackupStatus(null)).toBeNull();
    expect(parseBackupStatus('x')).toBeNull();
    expect(parseBackupStatus([])).toBeNull();
    expect(parseBackupStatus({ ok: true })).toBeNull();
    expect(parseBackupStatus({ ok: true, at: 'not a date' })).toBeNull();
  });
  it('reads a full status and tolerates missing fields', () => {
    expect(parseBackupStatus(ok)).toEqual(ok);
    expect(parseBackupStatus({ ok: false, at: ok.at, dbBytes: 'big' })).toMatchObject({ ok: false, okAt: null, dbBytes: null, error: null });
  });
});

describe('backupHealth', () => {
  it('never when nothing recorded', () => expect(backupHealth(undefined, now)).toEqual({ k: 'never' }));
  it('ok within the window', () => {
    const h = backupHealth(ok, now);
    expect(h.k).toBe('ok');
    expect(h.k !== 'never' && h.ageHours).toBeCloseTo(7.75);
  });
  it('stale when the last success is too old', () => {
    expect(backupHealth({ ...ok, at: '2026-10-14T02:15:00Z', okAt: '2026-10-14T02:15:00Z' }, now).k).toBe('stale');
    expect(backupHealth(ok, now, 5).k).toBe('stale');
  });
  it('failed when the last attempt failed, keeping the last success age', () => {
    const h = backupHealth({ ...ok, ok: false, at: '2026-10-16T02:15:00Z', okAt: '2026-10-15T02:15:00Z', error: 'pg_dump' }, now);
    expect(h.k).toBe('failed');
    expect(h.k !== 'never' && Math.round(h.ageHours ?? 0)).toBe(32);
  });
  it('failed with no success ever', () => {
    const h = backupHealth({ ok: false, at: ok.at, error: 'init' }, now);
    expect(h).toMatchObject({ k: 'failed', ageHours: null });
  });
});

describe('backupAlertEmail', () => {
  it('explains the failure step', () => {
    const h = backupHealth({ ...ok, ok: false, error: 'verify_db' }, now);
    if (h.k !== 'failed') throw new Error('expected failed');
    const e = backupAlertEmail(h, 'مدير النظام');
    expect(e.subject).toContain('فشل');
    expect(e.body).toContain('غير صالح');
    expect(e.body).toContain('7 ساعة');
  });
  it('stale without any success', () => {
    const e = backupAlertEmail({ k: 'stale', status: parseBackupStatus({ ok: true, at: ok.at })!, ageHours: null }, 'x');
    expect(e.subject).toContain('تأخر');
    expect(e.body).toContain('لا توجد نسخة ناجحة');
  });
});
