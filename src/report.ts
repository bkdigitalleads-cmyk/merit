/**
 * Volunteer service hours PDF, generated fully on-device with expo-print.
 * Styled like the paper form schools and programs hand out: dated entries
 * with organization and supervisor, totals against the goal, and a
 * certification block with a supervisor signature line.
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getEntries, getStats, fmtHours, fmtDecimalHours } from './db';
import { resolveGoal, Settings } from './state';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const DEFAULTS: Settings = {
  lockEnabled: false,
  goalKey: '',
  goalHours: null,
  volunteerName: '',
  supervisorName: '',
};

async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem('merit.settings.v1');
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    // fall through to defaults
  }
  return { ...DEFAULTS };
}

export async function buildReportHtml(): Promise<string> {
  const settings = await loadSettings();
  const goal = resolveGoal(settings);
  const entries = await getEntries();
  const stats = await getStats();
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const rows = [...entries]
    .reverse()
    .map(
      (e) => `
    <tr>
      <td>${prettyDate(e.date)}</td>
      <td class="num"><b>${fmtDecimalHours(e.durationMin)}</b></td>
      <td>${esc(e.organization || '—')}</td>
      <td>${esc(e.category || '—')}</td>
      <td>${esc(e.supervisor || '—')}</td>
    </tr>`
    )
    .join('');

  const pct =
    goal.totalHours > 0
      ? Math.min(100, Math.round((stats.totalMin / (goal.totalHours * 60)) * 100))
      : 0;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1d2823; margin: 32px; }
  h1 { font-size: 21px; margin: 0 0 2px; }
  .sub { color: #54655c; font-size: 12px; margin-bottom: 4px; }
  .who { margin: 14px 0 0; font-size: 13px; }
  .who b { font-size: 14px; }
  .summary { display: flex; gap: 10px; margin: 14px 0 6px; }
  .box { flex: 1; background: #eef6f1; border: 1px solid #cfe4d8; border-radius: 10px; padding: 10px 12px; }
  .box .v { font-size: 18px; font-weight: 700; }
  .box .l { font-size: 11px; color: #54655c; margin-top: 1px; }
  .goalbar { height: 9px; background: #e4ede7; border-radius: 5px; margin: 8px 0 2px; overflow: hidden; }
  .goalbar i { display: block; height: 100%; width: ${pct}%; background: #0f7b5f; border-radius: 5px; }
  .goalpct { font-size: 11px; color: #54655c; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #54655c; border-bottom: 2px solid #0f7b5f; padding: 5px 6px; }
  td { border-bottom: 1px solid #e0e9e3; padding: 6px; font-size: 11.5px; vertical-align: top; }
  td.num { white-space: nowrap; }
  .totals td { border-top: 2px solid #0f7b5f; border-bottom: none; font-weight: 700; font-size: 12px; }
  .cert { margin-top: 26px; border: 1px solid #cfdcd3; border-radius: 10px; padding: 14px 16px; font-size: 12px; line-height: 1.5; }
  .sig { display: flex; gap: 28px; margin-top: 26px; }
  .sig div { flex: 1; border-top: 1px solid #1d2823; padding-top: 4px; font-size: 11px; color: #54655c; }
  .footer { margin-top: 24px; color: #8fa096; font-size: 10px; text-align: center; }
</style></head>
<body>
  <h1>Volunteer Service Hours Log</h1>
  <div class="sub">Generated ${today} · Merit for iPhone · All data recorded on-device</div>
  <div class="who">
    ${settings.volunteerName ? `Volunteer: <b>${esc(settings.volunteerName)}</b>` : 'Volunteer: ____________________'}
    &nbsp;·&nbsp; ${esc(goal.label)}
    &nbsp;·&nbsp; Goal: ${goal.totalHours} hours
  </div>
  <div class="summary">
    <div class="box"><div class="v">${fmtHours(stats.totalMin)}</div><div class="l">total volunteer service</div></div>
    <div class="box"><div class="v">${stats.entryCount}</div><div class="l">service ${stats.entryCount === 1 ? 'entry' : 'entries'}</div></div>
    <div class="box"><div class="v">${stats.orgCount}</div><div class="l">${stats.orgCount === 1 ? 'organization' : 'organizations'}</div></div>
  </div>
  <div class="goalbar"><i></i></div>
  <div class="goalpct">${pct}% of the ${goal.totalHours}-hour goal</div>
  <table>
    <tr>
      <th>Date</th><th>Hours</th><th>Organization</th><th>Category</th><th>Supervisor</th>
    </tr>
    ${rows}
    <tr class="totals">
      <td>Total</td>
      <td class="num">${fmtDecimalHours(stats.totalMin)}</td>
      <td colspan="3"></td>
    </tr>
  </table>
  <div class="cert">
    I certify that the volunteer service recorded above was completed as stated.
    <div class="sig">
      <div>Supervisor / coordinator signature</div>
      <div>Printed name</div>
      <div>Date</div>
    </div>
  </div>
  <div class="footer">Logged with Merit — confirm your school's or program's exact submission requirements before turning this in.</div>
</body></html>`;
}

export async function generateAndSharePdf(): Promise<void> {
  const html = await buildReportHtml();
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Your volunteer hours log',
      UTI: 'com.adobe.pdf',
    });
  }
}
