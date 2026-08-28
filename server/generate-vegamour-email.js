#!/usr/bin/env node
// Vegamour Performance Brief — NCAC-primary HTML generator (email-safe, mobile-responsive)
// Co-branded: Vegamour + Melleka Marketing
// Usage: node generate-vegamour-email.js data.json
//
// Expected JSON shape:
// {
//   "dateShort": "Aug 17",
//   "dateLong": "August 17, 2026",
//   "periods": {
//     "yesterday": { "ncac": 42.50, "spend": 3200.00, "newCustomers": 75, "revenue": 9600.00, "roas": 300 },
//     "d7":        { "ncac": 38.20, "spend": 21000.00, "newCustomers": 550, "revenue": 63000.00, "roas": 300 },
//     "d14":       { "ncac": 40.10, "spend": 40000.00, "newCustomers": 997, "revenue": 116000.00, "roas": 290 },
//     "d30":       { "ncac": 39.50, "spend": 85000.00, "newCustomers": 2152, "revenue": 247000.00, "roas": 291 }
//   },
//   "campaigns": [
//     { "name": "Shopping - Brand", "spend": 1200, "newCustomers": 40, "ncac": 30.00, "revenue": 4800, "roas": 400 }
//   ],
//   "insights": [
//     { "title": "NCAC EFFICIENCY", "body": "7-day NCAC of $38.20 is tracking well below last month's average of $41.00." }
//   ],
//   "trend": [
//     { "date": "Aug 13", "spend": 3100, "newCustomers": 72, "ncac": 43.06, "roas": 295 }
//   ],
//   "attributionNote": "Yesterday data may shift by 5-10% as overnight conversions seal within the 7-day attribution window.",
//   "pdfUrl": "https://server-production-0486.up.railway.app/api/public/vegamour/daily-2026-08-17"
// }

const fs = require('fs');
const raw = fs.readFileSync(process.argv[2] || '/dev/stdin', 'utf8');
const d = JSON.parse(raw);

function roasColor(roas) {
  if (roas >= 300) return '#15803D';
  if (roas >= 200) return '#1D4ED8';
  if (roas >= 100) return '#C2410C';
  return '#DC2626';
}

function money(n) {
  if (n == null || isNaN(n)) return 'N/A';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ncacStr(n) {
  if (n == null || isNaN(n) || n === 0) return 'N/A';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function roasPct(n) {
  if (n == null || isNaN(n)) return 'N/A';
  return Math.round(Number(n)) + '%';
}

const p = d.periods;

// NCAC cards (4 periods)
function ncacCard(label, period, padRight) {
  const padStyle = padRight ? 'padding:0 5px 0 0' : 'padding:0 0 0 5px';
  return `<td width="25%" style="${padStyle};vertical-align:top;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td height="3" style="background:#2D6741;border-radius:3px 3px 0 0;font-size:0;line-height:3px;">&nbsp;</td></tr>
      <tr><td style="background:#FFFFFF;border:1px solid #E5E5E0;border-top:none;border-radius:0 0 8px 8px;padding:12px 12px 14px;">
        <p style="margin:0 0 8px;font-size:8px;font-weight:700;letter-spacing:2.5px;color:#9CA3AF;text-transform:uppercase;font-family:Arial,sans-serif;">${label}</p>
        <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.5px;">${ncacStr(period.ncac)}</p>
        <p style="margin:0 0 3px;font-size:10px;color:#6B7280;font-family:Arial,sans-serif;">Spend: <strong style="color:#374151;">${money(period.spend)}</strong></p>
        <p style="margin:0;font-size:10px;color:#6B7280;font-family:Arial,sans-serif;">New Cust.: <strong style="color:#374151;">${period.newCustomers != null ? Number(period.newCustomers).toLocaleString('en-US') : 'N/A'}</strong></p>
      </td></tr>
    </table>
  </td>`;
}

// ROAS summary table rows
const roasPeriods = [
  { label: 'Yesterday', data: p.yesterday },
  { label: '7-Day',     data: p.d7 },
  { label: '14-Day',    data: p.d14 },
  { label: '30-Day',    data: p.d30 },
];
const roasRows = roasPeriods.map((rp, i) => {
  const bg = i % 2 === 0 ? '#FFFFFF' : '#F9FAFB';
  const roas = rp.data.roas;
  const color = roasColor(roas);
  const border = i < roasPeriods.length - 1 ? '1px solid #F3F4F6' : 'none';
  return `<tr>
    <td style="padding:11px 14px;font-size:12px;font-weight:600;color:#374151;background:${bg};border-bottom:${border};font-family:Arial,sans-serif;">${rp.label}</td>
    <td style="padding:11px 14px;font-size:12px;color:#6B7280;background:${bg};border-bottom:${border};text-align:right;font-family:Arial,sans-serif;">${money(rp.data.spend)}</td>
    <td style="padding:11px 14px;font-size:12px;color:#6B7280;background:${bg};border-bottom:${border};text-align:right;font-family:Arial,sans-serif;">${money(rp.data.revenue)}</td>
    <td style="padding:11px 14px;font-size:13px;font-weight:700;color:${color};background:${bg};border-bottom:${border};text-align:right;font-family:Arial,sans-serif;">${roasPct(roas)}</td>
  </tr>`;
}).join('\n');

// Campaign breakdown rows
const sortedCampaigns = [...(d.campaigns || [])].sort((a, b) => b.spend - a.spend);
const campaignRows = sortedCampaigns.map((c, i) => {
  const bg = i % 2 === 0 ? '#FFFFFF' : '#F9FAFB';
  const color = roasColor(c.roas);
  const nc = c.newCustomers != null ? Number(c.newCustomers).toLocaleString('en-US') : 'N/A';
  return `<tr>
    <td style="padding:11px 14px;font-size:12px;color:#374151;background:${bg};border-bottom:1px solid #F3F4F6;font-family:Arial,sans-serif;">${c.name}</td>
    <td style="padding:11px 14px;font-size:12px;color:#6B7280;background:${bg};border-bottom:1px solid #F3F4F6;text-align:right;font-family:Arial,sans-serif;">${money(c.spend)}</td>
    <td style="padding:11px 14px;font-size:12px;color:#374151;background:${bg};border-bottom:1px solid #F3F4F6;text-align:right;font-family:Arial,sans-serif;">${nc}</td>
    <td style="padding:11px 14px;font-size:13px;font-weight:700;color:#111827;background:${bg};border-bottom:1px solid #F3F4F6;text-align:right;font-family:Arial,sans-serif;">${ncacStr(c.ncac)}</td>
    <td style="padding:11px 14px;font-size:12px;color:#6B7280;background:${bg};border-bottom:1px solid #F3F4F6;text-align:right;font-family:Arial,sans-serif;">${money(c.revenue)}</td>
    <td style="padding:11px 14px;font-size:13px;font-weight:700;color:${color};background:${bg};border-bottom:1px solid #F3F4F6;text-align:right;font-family:Arial,sans-serif;">${roasPct(c.roas)}</td>
  </tr>`;
}).join('\n');

// Insight cards
const insightAccents = ['#D97706', '#15803D', '#DC2626', '#7C3AED', '#0284C7'];
const insightCards = (d.insights || []).map((ins, i) => {
  const color = insightAccents[i % insightAccents.length];
  return `<tr><td style="padding:0 0 10px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="3" style="background:${color};border-radius:3px 0 0 3px;">&nbsp;</td>
        <td style="background:#FFFFFF;padding:14px 18px;border:1px solid #E5E5E0;border-left:none;border-radius:0 6px 6px 0;">
          <p style="margin:0 0 5px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;font-family:Arial,sans-serif;">${ins.title}</p>
          <p style="margin:0;font-size:12px;color:#4B5563;line-height:1.65;font-family:Arial,sans-serif;">${ins.body}</p>
        </td>
      </tr>
    </table>
  </td></tr>`;
}).join('\n');

// 5-day trend rows
const trendRows = (d.trend || []).map((t, i) => {
  const bg = i % 2 === 0 ? '#FFFFFF' : '#F9FAFB';
  const color = roasColor(t.roas);
  const nc = t.newCustomers != null ? Number(t.newCustomers).toLocaleString('en-US') : 'N/A';
  return `<tr>
    <td style="padding:10px 14px;font-size:12px;color:#374151;background:${bg};border-bottom:1px solid #F3F4F6;font-family:Arial,sans-serif;">${t.date}</td>
    <td style="padding:10px 14px;font-size:12px;color:#6B7280;background:${bg};border-bottom:1px solid #F3F4F6;text-align:right;font-family:Arial,sans-serif;">${t.spend ? money(t.spend) : '&mdash;'}</td>
    <td style="padding:10px 14px;font-size:12px;color:#374151;background:${bg};border-bottom:1px solid #F3F4F6;text-align:right;font-family:Arial,sans-serif;">${nc}</td>
    <td style="padding:10px 14px;font-size:13px;font-weight:600;color:#111827;background:${bg};border-bottom:1px solid #F3F4F6;text-align:right;font-family:Arial,sans-serif;">${ncacStr(t.ncac)}</td>
    <td style="padding:10px 14px;font-size:12px;font-weight:600;color:${color};background:${bg};border-bottom:1px solid #F3F4F6;text-align:right;font-family:Arial,sans-serif;">${roasPct(t.roas)}</td>
  </tr>`;
}).join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Vegamour Performance Brief &mdash; ${d.dateShort}</title>
<style>
body,table,td,p,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
table,td{mso-table-lspace:0;mso-table-rspace:0;}
</style>
</head>
<body style="margin:0;padding:0;background:#EEEEE8;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#EEEEE8">
<tr><td align="center" style="padding:24px 10px 40px;">
<table width="680" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;">

  <!-- Header -->
  <tr><td style="background:#2D6741;border-radius:8px 8px 0 0;padding:28px 32px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td>
          <p style="margin:0 0 4px;font-size:20px;font-weight:800;color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.3px;">VEGAMOUR</p>
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.65);font-family:Arial,Helvetica,sans-serif;letter-spacing:0.5px;">Google Ads Performance Brief</p>
        </td>
        <td align="right">
          <p style="margin:0 0 2px;font-size:10px;color:rgba(255,255,255,0.5);font-family:Arial,sans-serif;text-align:right;">Prepared by</p>
          <p style="margin:0;font-size:13px;font-weight:700;color:rgba(255,255,255,0.9);font-family:Arial,sans-serif;text-align:right;">Melleka Marketing</p>
        </td>
      </tr>
    </table>
    <p style="margin:20px 0 0;font-size:26px;font-weight:800;color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.5px;">Performance Report &mdash; ${d.dateLong}</p>
    <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.65);font-family:Arial,sans-serif;">Enabled campaigns only &nbsp;&bull;&nbsp; Account 7567846915</p>
  </td></tr>

  <!-- NCAC Overview (Primary) -->
  <tr><td style="background:#FAFAF8;padding:20px 26px 16px;border-left:1px solid #E5E5E0;border-right:1px solid #E5E5E0;">
    <p style="margin:0 0 14px;font-size:9px;font-weight:700;letter-spacing:2.5px;color:#2D6741;text-transform:uppercase;font-family:Arial,sans-serif;border-bottom:2px solid #2D6741;padding-bottom:8px;display:inline-block;">New Customer Acquisition Cost (NCAC)</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        ${ncacCard('Yesterday', p.yesterday, true)}
        <td width="25%" style="padding:0 5px;vertical-align:top;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td height="3" style="background:#2D6741;border-radius:3px 3px 0 0;font-size:0;line-height:3px;">&nbsp;</td></tr>
            <tr><td style="background:#FFFFFF;border:1px solid #E5E5E0;border-top:none;border-radius:0 0 8px 8px;padding:12px 12px 14px;">
              <p style="margin:0 0 8px;font-size:8px;font-weight:700;letter-spacing:2.5px;color:#9CA3AF;text-transform:uppercase;font-family:Arial,sans-serif;">7-Day</p>
              <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.5px;">${ncacStr(p.d7.ncac)}</p>
              <p style="margin:0 0 3px;font-size:10px;color:#6B7280;font-family:Arial,sans-serif;">Spend: <strong style="color:#374151;">${money(p.d7.spend)}</strong></p>
              <p style="margin:0;font-size:10px;color:#6B7280;font-family:Arial,sans-serif;">New Cust.: <strong style="color:#374151;">${p.d7.newCustomers != null ? Number(p.d7.newCustomers).toLocaleString('en-US') : 'N/A'}</strong></p>
            </td></tr>
          </table>
        </td>
        <td width="25%" style="padding:0 5px;vertical-align:top;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td height="3" style="background:#2D6741;border-radius:3px 3px 0 0;font-size:0;line-height:3px;">&nbsp;</td></tr>
            <tr><td style="background:#FFFFFF;border:1px solid #E5E5E0;border-top:none;border-radius:0 0 8px 8px;padding:12px 12px 14px;">
              <p style="margin:0 0 8px;font-size:8px;font-weight:700;letter-spacing:2.5px;color:#9CA3AF;text-transform:uppercase;font-family:Arial,sans-serif;">14-Day</p>
              <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.5px;">${ncacStr(p.d14.ncac)}</p>
              <p style="margin:0 0 3px;font-size:10px;color:#6B7280;font-family:Arial,sans-serif;">Spend: <strong style="color:#374151;">${money(p.d14.spend)}</strong></p>
              <p style="margin:0;font-size:10px;color:#6B7280;font-family:Arial,sans-serif;">New Cust.: <strong style="color:#374151;">${p.d14.newCustomers != null ? Number(p.d14.newCustomers).toLocaleString('en-US') : 'N/A'}</strong></p>
            </td></tr>
          </table>
        </td>
        ${ncacCard('30-Day', p.d30, false)}
      </tr>
    </table>
  </td></tr>

  <!-- ROAS Summary (Secondary) -->
  <tr><td style="background:#FAFAF8;padding:8px 26px 16px;border-left:1px solid #E5E5E0;border-right:1px solid #E5E5E0;">
    <p style="margin:0 0 14px;font-size:9px;font-weight:700;letter-spacing:2.5px;color:#6B7280;text-transform:uppercase;font-family:Arial,sans-serif;border-bottom:2px solid #D1D5DB;padding-bottom:8px;display:inline-block;">ROAS Summary</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:8px;overflow:hidden;border:1px solid #E5E5E0;">
      <tr style="background:#F9FAFB;">
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:left;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">Period</th>
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">Spend</th>
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">Revenue</th>
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">ROAS</th>
      </tr>
      ${roasRows}
    </table>
  </td></tr>

  <!-- Campaign Breakdown -->
  <tr><td style="background:#FAFAF8;padding:8px 26px 16px;border-left:1px solid #E5E5E0;border-right:1px solid #E5E5E0;">
    <p style="margin:0 0 14px;font-size:9px;font-weight:700;letter-spacing:2.5px;color:#2D6741;text-transform:uppercase;font-family:Arial,sans-serif;border-bottom:2px solid #2D6741;padding-bottom:8px;display:inline-block;">Campaign Breakdown &mdash; ${d.dateShort}</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:8px;overflow:hidden;border:1px solid #E5E5E0;">
      <tr style="background:#F9FAFB;">
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:left;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">Campaign</th>
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">Spend</th>
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">New Cust.</th>
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">NCAC</th>
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">Revenue</th>
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">ROAS</th>
      </tr>
      ${campaignRows}
    </table>
  </td></tr>

  <!-- Key Insights -->
  <tr><td style="background:#FAFAF8;padding:8px 26px 16px;border-left:1px solid #E5E5E0;border-right:1px solid #E5E5E0;">
    <p style="margin:0 0 14px;font-size:9px;font-weight:700;letter-spacing:2.5px;color:#2D6741;text-transform:uppercase;font-family:Arial,sans-serif;border-bottom:2px solid #2D6741;padding-bottom:8px;display:inline-block;">Key Insights &mdash; ${d.dateShort}</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${insightCards}
    </table>
  </td></tr>

  <!-- 5-Day Trend -->
  <tr><td style="background:#FAFAF8;padding:8px 26px 16px;border-left:1px solid #E5E5E0;border-right:1px solid #E5E5E0;">
    <p style="margin:0 0 14px;font-size:9px;font-weight:700;letter-spacing:2.5px;color:#6B7280;text-transform:uppercase;font-family:Arial,sans-serif;border-bottom:2px solid #D1D5DB;padding-bottom:8px;display:inline-block;">5-Day Trend</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:8px;overflow:hidden;border:1px solid #E5E5E0;">
      <tr style="background:#F9FAFB;">
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:left;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">Date</th>
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">Spend</th>
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">New Cust.</th>
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">NCAC</th>
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">ROAS</th>
      </tr>
      ${trendRows}
    </table>
  </td></tr>

  <!-- Attribution Note -->
  <tr><td style="background:#FAFAF8;padding:8px 26px 20px;border-left:1px solid #E5E5E0;border-right:1px solid #E5E5E0;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="3" style="background:#2563EB;border-radius:3px 0 0 3px;">&nbsp;</td>
            <td style="background:#FFFFFF;padding:14px 18px;border:1px solid #E5E5E0;border-left:none;border-radius:0 6px 6px 0;">
              <p style="margin:0 0 5px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;font-family:Arial,sans-serif;">Attribution Note</p>
              <p style="margin:0;font-size:12px;color:#4B5563;line-height:1.65;font-family:Arial,sans-serif;">${d.attributionNote || ''}</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#2D6741;padding:24px 32px;border-radius:0 0 8px 8px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td>
          <p style="margin:0 0 2px;font-size:13px;font-weight:700;color:#FFFFFF;font-family:Arial,sans-serif;">Melleka Marketing</p>
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.55);font-family:Arial,sans-serif;">Prepared for Vegamour &nbsp;&bull;&nbsp; <a href="https://melleka.com" style="color:rgba(255,255,255,0.55);text-decoration:none;">melleka.com</a></p>
        </td>
        <td align="right">
          <a href="${d.pdfUrl || '#'}" style="display:inline-block;background:#FFFFFF;color:#2D6741;font-size:12px;font-weight:700;padding:10px 24px;border-radius:6px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">Download PDF</a>
        </td>
      </tr>
    </table>
  </td></tr>

</table>
</td></tr>
</table>

</body>
</html>`;

process.stdout.write(html);
