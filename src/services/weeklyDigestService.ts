// src/services/weeklyDigestService.ts
// Weekly Email Digest — Gemini 2.5 Flash AI + beautiful HTML email template

import {
  collection, doc, getDoc, setDoc, getDocs,
  query, where, orderBy, Timestamp, addDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { studyPlanService, StudyPlanEvent } from './studyPlanService';
import { aiStudyPlannerService, WeeklyDigestAI } from './aiStudyPlannerService';
import {
  format, startOfWeek, endOfWeek, addDays,
  differenceInDays,
} from 'date-fns';

const GEMINI_KEY  = import.meta.env.VITE_GEMINI_API_KEY   || '';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL       ||
                    import.meta.env.REACT_APP_BACKEND_URL  || '';
const API_KEY     = import.meta.env.VITE_INTERNAL_API_KEY  ||
                    import.meta.env.INTERNAL_API_KEY        || '';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DigestPreferences {
  studentId: string;
  enabled: boolean;
  deliveryDay: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sun … 6=Sat
  deliveryHour: number;                      // 0-23
  email: string;
  includeAIInsights: boolean;
  includeUpcoming: boolean;
  includeProgress: boolean;
  lastSentAt?: Date;
  nextScheduledAt?: Date;
  createdAt: Date;
}

export interface DigestRecord {
  id: string;
  studentId: string;
  sentAt: Date;
  weekLabel: string;
  eventsCount: number;
  completedCount: number;
  aiSummary: string;
  emailPreview: string;
  status: 'sent' | 'failed' | 'preview';
}

export interface DigestPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

// ─── HTML Email Template ──────────────────────────────────────────────────────

function buildHTML(
  studentName: string,
  weekLabel: string,
  upcoming: StudyPlanEvent[],
  completedCount: number,
  totalCount: number,
  streakDays: number,
  ai: WeeklyDigestAI,
  appUrl: string
): string {
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const badge = (p: string) => {
    const m: Record<string, string> = {
      high:   'background:#fef2f2;color:#dc2626',
      medium: 'background:#fffbeb;color:#d97706',
      low:    'background:#f0fdf4;color:#16a34a',
    };
    return `<span style="${m[p] || m.medium};padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600;text-transform:uppercase;">${p}</span>`;
  };

  const typeEmoji = (t: string) =>
    ({ assignment:'📋', exam:'🎯', class:'🏫', study_session:'📚', deadline:'⏰', personal:'📝' }[t] || '📅');

  const rows = upcoming.slice(0, 8).map(e => {
    const d = differenceInDays(e.date, new Date());
    const left = d <= 2 ? 'border-left:4px solid #dc2626' : d <= 5 ? 'border-left:4px solid #d97706' : 'border-left:4px solid #6366f1';
    return `
    <tr><td style="padding:10px 14px;${left};background:#f9fafb;border-radius:8px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td><p style="margin:0 0 3px;font-size:14px;font-weight:600;color:#111827;">${typeEmoji(e.eventType)} ${e.title}</p>
            <p style="margin:0;font-size:12px;color:#6b7280;">${format(e.date,'EEE, MMM d')}${e.startTime ? ` · ${e.startTime}–${e.endTime}` : ''}${e.course ? ` · ${e.course}` : ''}</p></td>
        <td align="right" style="vertical-align:top;">${badge(e.priority)}${d<=1?"<br><span style='font-size:10px;color:#dc2626;font-weight:700;'>⚠️ URGENT</span>":d<=3?"<br><span style='font-size:10px;color:#d97706;font-weight:600;'>Soon</span>":''}</td>
      </tr></table>
    </td></tr><tr><td style="height:5px;"></td></tr>`;
  }).join('');

  const tipsHTML = ai.tips.map((t, i) => `
    <tr><td style="padding:10px 14px;background:#f5f3ff;border-radius:8px;">
      <p style="margin:0;font-size:13px;color:#4c1d95;"><span style="font-weight:700;color:#7c3aed;">${i + 1}.</span> ${t}</p>
    </td></tr><tr><td style="height:5px;"></td></tr>`).join('');

  const urgentBlock = ai.urgentItems.length > 0 ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr><td style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px;">
        <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#dc2626;">⚠️ Urgent This Week</p>
        ${ai.urgentItems.map(u => `<p style="margin:0 0 4px;font-size:13px;color:#7f1d1d;">• ${u}</p>`).join('')}
      </td></tr>
    </table>` : '';

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Weekly Study Digest</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#f3f4f6;">${ai.summary.slice(0,100)}…</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

<!-- Header -->
<tr><td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:16px 16px 0 0;padding:28px 36px;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td><p style="margin:0 0 2px;font-size:11px;font-weight:600;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:1px;">EdTech Platform</p>
        <h1 style="margin:0 0 2px;font-size:24px;font-weight:800;color:#fff;">Weekly Study Digest</h1>
        <p style="margin:0;font-size:13px;color:rgba(255,255,255,.7);">${weekLabel}</p></td>
    <td align="right" valign="top"><div style="background:rgba(255,255,255,.15);border-radius:10px;padding:10px 14px;text-align:center;">
      <p style="margin:0;font-size:26px;font-weight:800;color:#fff;">${streakDays}</p>
      <p style="margin:0;font-size:11px;color:rgba(255,255,255,.7);">🔥 Day Streak</p>
    </div></td>
  </tr></table>
</td></tr>

<!-- Body -->
<tr><td style="background:#fff;padding:28px 36px;">
  <p style="margin:0 0 6px;font-size:19px;font-weight:700;color:#111827;">Hi ${studentName}! 👋</p>
  <p style="margin:0 0 22px;font-size:14px;color:#4b5563;line-height:1.6;">${ai.summary}</p>

  <!-- Stats -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;"><tr>
    <td style="width:32%;background:#f0fdf4;border-radius:12px;padding:14px;text-align:center;">
      <p style="margin:0;font-size:26px;font-weight:800;color:#16a34a;">${completedCount}</p>
      <p style="margin:0;font-size:11px;color:#4b5563;margin-top:2px;">Completed</p></td>
    <td style="width:4%;"></td>
    <td style="width:32%;background:#eff6ff;border-radius:12px;padding:14px;text-align:center;">
      <p style="margin:0;font-size:26px;font-weight:800;color:#2563eb;">${upcoming.length}</p>
      <p style="margin:0;font-size:11px;color:#4b5563;margin-top:2px;">Upcoming</p></td>
    <td style="width:4%;"></td>
    <td style="width:32%;background:#faf5ff;border-radius:12px;padding:14px;text-align:center;">
      <p style="margin:0;font-size:26px;font-weight:800;color:#7c3aed;">${pct}%</p>
      <p style="margin:0;font-size:11px;color:#4b5563;margin-top:2px;">Completion</p></td>
  </tr></table>

  <!-- Progress Bar -->
  <div style="margin-bottom:24px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><p style="margin:0 0 5px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Weekly Completion</p></td>
      <td align="right"><p style="margin:0 0 5px;font-size:11px;font-weight:700;color:#111827;">${pct}%</p></td>
    </tr></table>
    <div style="background:#e5e7eb;border-radius:99px;height:7px;overflow:hidden;">
      <div style="background:linear-gradient(90deg,#6366f1,#7c3aed);height:7px;width:${pct}%;border-radius:99px;"></div>
    </div>
  </div>

  ${urgentBlock}

  ${upcoming.length > 0 ? `
  <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#111827;">📅 Upcoming Events</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">${rows}</table>
  ` : '<p style="color:#6b7280;font-size:13px;margin-bottom:20px;">No upcoming events — consider adding some!</p>'}

  <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#111827;">✨ AI Study Tips</p>
  <p style="margin:0 0 10px;font-size:11px;color:#9ca3af;">Personalized by Gemini 2.5 Flash</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">${tipsHTML}</table>

  <!-- Motivation -->
  <div style="background:linear-gradient(135deg,#ede9fe,#ddd6fe);border-radius:12px;padding:18px;margin-bottom:24px;text-align:center;">
    <p style="margin:0;font-size:14px;font-weight:600;color:#4c1d95;line-height:1.5;">💜 ${ai.motivationalMessage}</p>
  </div>

  <!-- CTA -->
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <a href="${appUrl}/study-plan" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;text-decoration:none;padding:13px 30px;border-radius:12px;font-size:14px;font-weight:700;">
      Open My Study Planner →
    </a>
  </td></tr></table>
</td></tr>

<!-- Footer -->
<tr><td style="background:#f9fafb;border-radius:0 0 16px 16px;padding:16px 36px;border-top:1px solid #e5e7eb;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td><p style="margin:0;font-size:11px;color:#9ca3af;">You enabled weekly digests in your study planner settings.</p>
        <p style="margin:3px 0 0;font-size:11px;color:#9ca3af;">
          <a href="${appUrl}/settings/digest" style="color:#6366f1;text-decoration:none;">Manage</a> ·
          <a href="${appUrl}/settings/digest?unsubscribe=1" style="color:#6b7280;text-decoration:none;">Unsubscribe</a>
        </p></td>
    <td align="right"><p style="margin:0;font-size:11px;color:#9ca3af;">Powered by Gemini 2.5 Flash</p></td>
  </tr></table>
</td></tr>

</table></td></tr></table>
</body></html>`;
}

function buildText(studentName: string, weekLabel: string, upcoming: StudyPlanEvent[], completedCount: number, ai: WeeklyDigestAI): string {
  return [
    `WEEKLY STUDY DIGEST — ${weekLabel}`,
    `Hi ${studentName}!`, '',
    ai.summary, '',
    `Completed: ${completedCount} | Upcoming: ${upcoming.length}`, '',
    upcoming.length > 0 ? 'UPCOMING:\n' + upcoming.slice(0, 8).map(e => `• ${e.title} — ${format(e.date, 'MMM d')}${e.startTime ? ` ${e.startTime}` : ''} [${e.priority}]`).join('\n') : '',
    ai.urgentItems.length > 0 ? '\n⚠️ URGENT:\n' + ai.urgentItems.map(u => `• ${u}`).join('\n') : '',
    '\nAI TIPS:\n' + ai.tips.map((t, i) => `${i + 1}. ${t}`).join('\n'),
    '\n' + ai.motivationalMessage,
  ].filter(Boolean).join('\n');
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const weeklyDigestService = {

  // ── Preferences ──────────────────────────────────────────────────────────────

  async getPreferences(studentId: string): Promise<DigestPreferences | null> {
    const snap = await getDoc(doc(db, 'digestPreferences', studentId));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      ...d,
      lastSentAt:      d.lastSentAt?.toDate(),
      nextScheduledAt: d.nextScheduledAt?.toDate(),
      createdAt:       d.createdAt?.toDate() ?? new Date(),
    } as DigestPreferences;
  },

  async savePreferences(prefs: Omit<DigestPreferences, 'createdAt'>): Promise<void> {
    const ref   = doc(db, 'digestPreferences', prefs.studentId);
    const snap  = await getDoc(ref);
    const next  = weeklyDigestService.calcNextSendDate(prefs.deliveryDay, prefs.deliveryHour);
    const data: any = {
      ...prefs,
      nextScheduledAt: Timestamp.fromDate(next),
      lastSentAt: prefs.lastSentAt ? Timestamp.fromDate(prefs.lastSentAt) : null,
    };
    if (!snap.exists()) data.createdAt = Timestamp.now();
    await setDoc(ref, data, { merge: true });
  },

  calcNextSendDate(deliveryDay: number, deliveryHour: number): Date {
    const now  = new Date();
    const cur  = now.getDay();
    let diff   = deliveryDay - cur;
    if (diff < 0 || (diff === 0 && now.getHours() >= deliveryHour)) diff += 7;
    const next = new Date(now);
    next.setDate(now.getDate() + diff);
    next.setHours(deliveryHour, 0, 0, 0);
    return next;
  },

  // ── Build payload ─────────────────────────────────────────────────────────────

  async buildDigestPayload(
    studentId: string,
    studentName: string,
    studentEmail: string,
    appUrl = BACKEND_URL || 'https://your-app.com'
  ): Promise<DigestPayload> {
    const now       = new Date();
    const wStart    = startOfWeek(now, { weekStartsOn: 1 });
    const wEnd      = endOfWeek(now,   { weekStartsOn: 1 });
    const weekLabel = `${format(wStart, 'MMM d')} – ${format(wEnd, 'MMM d, yyyy')}`;

    const allEvents  = await studyPlanService.getEventsForStudent(studentId);
    const upcoming   = allEvents.filter(e => e.date >= now && !e.completed).sort((a, b) => a.date.getTime() - b.date.getTime());
    const thisWeek   = allEvents.filter(e => e.date >= wStart && e.date <= addDays(wEnd, 7));
    const completed  = thisWeek.filter(e => e.completed);

    const streak     = await studyPlanService.getStreak(studentId);
    const streakDays = streak?.currentStreak ?? 0;

    const subCounts: Record<string, number> = {};
    allEvents.forEach(e => { if (e.course) subCounts[e.course] = (subCounts[e.course] || 0) + 1; });
    const topSubjects = Object.entries(subCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => s);

    let ai: WeeklyDigestAI = {
      summary: `Hi ${studentName}, you have ${upcoming.length} upcoming events this week.`,
      tips: ['Review your notes regularly', 'Use the Pomodoro technique', 'Take breaks to stay focused'],
      urgentItems: upcoming.filter(e => differenceInDays(e.date, now) <= 2).map(e => `${e.title} is due ${format(e.date, 'MMM d')}`),
      motivationalMessage: 'Every session brings you closer to your goals!',
    };

    if (GEMINI_KEY) {
      try {
        ai = await aiStudyPlannerService.generateWeeklyDigestSummary(
          studentName,
          upcoming.slice(0, 8).map(e => ({ title: e.title, eventType: e.eventType, daysUntil: differenceInDays(e.date, now), priority: e.priority })),
          completed.length, thisWeek.length, streakDays, topSubjects, GEMINI_KEY
        );
      } catch (err) { console.warn('Digest AI fallback:', err); }
    }

    const html    = buildHTML(studentName, weekLabel, upcoming, completed.length, thisWeek.length, streakDays, ai, appUrl);
    const text    = buildText(studentName, weekLabel, upcoming, completed.length, ai);
    const subject = `📚 Your Study Digest: ${weekLabel} · ${upcoming.length} events ahead`;

    return { to: studentEmail, subject, html, text };
  },

  // ── Preview (no send, no log) ─────────────────────────────────────────────────

  async previewDigest(studentId: string, studentName: string, studentEmail: string): Promise<DigestPayload> {
    return weeklyDigestService.buildDigestPayload(studentId, studentName, studentEmail);
  },

  // ── Send via backend ──────────────────────────────────────────────────────────

  async sendDigest(studentId: string, studentName: string, studentEmail: string): Promise<{ success: boolean; error?: string }> {
    try {
      const payload = await weeklyDigestService.buildDigestPayload(studentId, studentName, studentEmail);
      const res = await fetch(`${BACKEND_URL}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Email API ${res.status}`);

      await weeklyDigestService._logDigest(studentId, payload, 'sent');

      const prefs = await weeklyDigestService.getPreferences(studentId);
      if (prefs) {
        const next = weeklyDigestService.calcNextSendDate(prefs.deliveryDay, prefs.deliveryHour);
        await weeklyDigestService.savePreferences({ ...prefs, lastSentAt: new Date(), nextScheduledAt: next });
      }
      return { success: true };
    } catch (err: any) {
      console.error('Digest send error:', err);
      return { success: false, error: err.message };
    }
  },

  // ── History ───────────────────────────────────────────────────────────────────

  async getDigestHistory(studentId: string, limit = 10): Promise<DigestRecord[]> {
    const snap = await getDocs(query(collection(db, 'digestLogs'), where('studentId', '==', studentId), orderBy('sentAt', 'desc')));
    return snap.docs.slice(0, limit).map(d => ({
      id: d.id, ...d.data(), sentAt: d.data().sentAt.toDate(),
    })) as DigestRecord[];
  },

  async _logDigest(studentId: string, payload: DigestPayload, status: DigestRecord['status']): Promise<void> {
    await addDoc(collection(db, 'digestLogs'), {
      studentId, sentAt: Timestamp.now(), weekLabel: payload.subject,
      emailPreview: payload.text.slice(0, 200), status, createdAt: Timestamp.now(),
    });
  },

  // ── Auto-send if due ──────────────────────────────────────────────────────────

  async isDue(studentId: string): Promise<boolean> {
    const p = await weeklyDigestService.getPreferences(studentId);
    if (!p?.enabled || !p.nextScheduledAt) return false;
    return new Date() >= p.nextScheduledAt;
  },

  async sendIfDue(studentId: string, studentName: string, studentEmail: string): Promise<void> {
    if (await weeklyDigestService.isDue(studentId)) {
      await weeklyDigestService.sendDigest(studentId, studentName, studentEmail);
    }
  },
};
