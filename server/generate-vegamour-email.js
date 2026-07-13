#!/usr/bin/env node
// Vegamour ROAS Brief — Premium light-theme HTML generator (email-safe, mobile-responsive)
// Co-branded: Vegamour + Melleka Marketing
// Usage: node generate-vegamour-email.js data.json

const fs = require('fs');
const raw = fs.readFileSync(process.argv[2] || '/dev/stdin', 'utf8');
const d = JSON.parse(raw);

function getGrade(roas) {
  if (roas >= 350) return { label: 'A+', text: '#15803D', bg: '#DCFCE7', border: '#16A34A' };
  if (roas >= 300) return { label: 'A',  text: '#166534', bg: '#DCFCE7', border: '#15803D' };
  if (roas >= 250) return { label: 'B+', text: '#1D4ED8', bg: '#DBEAFE', border: '#2563EB' };
  if (roas >= 200) return { label: 'B',  text: '#1E40AF', bg: '#DBEAFE', border: '#3B82F6' };
  if (roas >= 150) return { label: 'C',  text: '#92400E', bg: '#FEF3C7', border: '#D97706' };
  if (roas >= 100) return { label: 'D',  text: '#9A3412', bg: '#FFEDD5', border: '#EA580C' };
  return                 { label: 'F',  text: '#991B1B', bg: '#FEE2E2', border: '#DC2626' };
}

function campaignColor(roas) {
  if (roas >= 300) return '#15803D';
  if (roas >= 200) return '#1D4ED8';
  if (roas >= 100) return '#C2410C';
  return '#DC2626';
}

function money(n) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function moneyK(n) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const TARGET = 300;
const p = d.periods;
const yG  = getGrade(p.yesterday.roas);
const d7G = getGrade(p.d7.roas);
const d14G= getGrade(p.d14.roas);
const d30G= getGrade(p.d30.roas);

const gap = Math.abs(TARGET - p.d7.roas).toFixed(0);
const dir = p.d7.roas >= TARGET ? 'above' : 'below';
const dirColor = p.d7.roas >= TARGET ? '#15803D' : '#991B1B';
const barPct = Math.min(100, (p.d7.roas / TARGET) * 100).toFixed(1);
const barColor = p.d7.roas >= TARGET ? '#16A34A' : '#2563EB';

function card(label, roas, grade, spend, rev) {
  return `<td class="card-cell" width="25%" style="padding:0 6px;vertical-align:top;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td height="3" style="background:${grade.border};border-radius:3px 3px 0 0;font-size:0;line-height:3px;">&nbsp;</td></tr>
      <tr><td style="background:#FFFFFF;border:1px solid #E5E5E0;border-top:none;border-radius:0 0 8px 8px;padding:14px 14px 16px;">
        <p style="margin:0 0 10px;font-size:8px;font-weight:700;letter-spacing:2.5px;color:#9CA3AF;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">${label}</p>
        <p style="margin:0 0 6px;font-size:24px;font-weight:800;color:${grade.text};font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.5px;">${roas.toFixed(2)}%</p>
        <p style="margin:0 0 10px;"><span style="display:inline-block;background:${grade.bg};color:${grade.text};font-size:10px;font-weight:700;padding:2px 9px;border-radius:10px;font-family:Arial,Helvetica,sans-serif;border:1px solid ${grade.border}44;">${grade.label}</span></p>
        <p style="margin:0 0 2px;font-size:11px;color:#6B7280;font-family:Arial,Helvetica,sans-serif;">Spend: <strong style="color:#374151;">${money(spend)}</strong></p>
        ${rev !== undefined ? `<p style="margin:0;font-size:11px;color:#6B7280;font-family:Arial,Helvetica,sans-serif;">Rev: <strong style="color:#374151;">${money(rev)}</strong></p>` : ''}
      </td></tr>
    </table>
  </td>`;
}

const sortedCampaigns = [...(d.campaigns || [])].sort((a, b) => b.revenue - a.revenue);

const campaignRows = sortedCampaigns.map((c, i) => {
  const roasPct = c.spend > 0 && c.revenue > 0 ? (c.revenue / c.spend) * 100 : 0;
  const roasStr = roasPct > 0 ? roasPct.toFixed(0) + '%' : '0%';
  const color = campaignColor(roasPct);
  const fBadge = c.revenue === 0
    ? ' <span style="display:inline-block;background:#FEE2E2;color:#991B1B;font-size:8px;font-weight:700;padding:1px 5px;border-radius:4px;border:1px solid #FECACA;font-family:Arial,sans-serif;">F</span>'
    : '';
  const rowBg = i % 2 === 0 ? '#FFFFFF' : '#F9FAFB';
  return `<tr>
    <td style="padding:11px 14px;font-size:12px;color:#374151;background:${rowBg};border-bottom:1px solid #F3F4F6;font-family:Arial,sans-serif;">${c.name}${fBadge}</td>
    <td style="padding:11px 14px;font-size:12px;color:#6B7280;background:${rowBg};border-bottom:1px solid #F3F4F6;text-align:right;font-family:Arial,sans-serif;">${money(c.spend)}</td>
    <td style="padding:11px 14px;font-size:12px;background:${rowBg};border-bottom:1px solid #F3F4F6;text-align:right;font-family:Arial,sans-serif;"><strong style="color:#111827;">${money(c.revenue)}</strong></td>
    <td style="padding:11px 14px;font-size:13px;font-weight:700;color:${color};background:${rowBg};border-bottom:1px solid #F3F4F6;text-align:right;font-family:Arial,sans-serif;">${roasStr}</td>
    <td style="padding:11px 14px;font-size:12px;color:#6B7280;background:${rowBg};border-bottom:1px solid #F3F4F6;text-align:right;font-family:Arial,sans-serif;">${Number(c.conv || 0).toFixed(1)}</td>
  </tr>`;
}).join('\n');

const totalSpend = sortedCampaigns.reduce((s, c) => s + c.spend, 0);
const totalRev   = sortedCampaigns.reduce((s, c) => s + c.revenue, 0);
const totalRoas  = totalSpend > 0 ? ((totalRev / totalSpend) * 100).toFixed(0) : '0';
const totalConv  = sortedCampaigns.reduce((s, c) => s + (c.conv || 0), 0);
const totalGrade = getGrade(Number(totalRoas));

const insightBorders = ['#D97706', '#15803D', '#DC2626', '#7C3AED', '#0284C7', '#DB2777'];
const insightCards = (d.insights || []).map((ins, i) => {
  const color = insightBorders[i % 6];
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

const trendRows = (d.trend || []).map((t, i) => {
  const rowBg = i % 2 === 0 ? '#FFFFFF' : '#F9FAFB';
  return `<tr>
    <td style="padding:10px 14px;font-size:12px;color:#374151;background:${rowBg};border-bottom:1px solid #F3F4F6;font-family:Arial,sans-serif;">${t.date}</td>
    <td style="padding:10px 14px;font-size:12px;color:#6B7280;background:${rowBg};border-bottom:1px solid #F3F4F6;text-align:right;font-family:Arial,sans-serif;">${t.spend ? moneyK(t.spend) : '&mdash;'}</td>
    <td style="padding:10px 14px;font-size:12px;color:#6B7280;background:${rowBg};border-bottom:1px solid #F3F4F6;text-align:right;font-family:Arial,sans-serif;">${t.revenue ? moneyK(t.revenue) : '&mdash;'}</td>
    <td style="padding:10px 14px;font-size:12px;font-weight:600;color:#374151;background:${rowBg};border-bottom:1px solid #F3F4F6;text-align:right;font-family:Arial,sans-serif;">${t.roas ? t.roas + '%' : '&mdash;'}</td>
    <td style="padding:10px 14px;font-size:12px;color:#6B7280;background:${rowBg};border-bottom:1px solid #F3F4F6;text-align:right;font-family:Arial,sans-serif;">${t.grade || '&mdash;'}</td>
    <td style="padding:10px 14px;font-size:12px;color:#6B7280;background:${rowBg};border-bottom:1px solid #F3F4F6;text-align:right;font-family:Arial,sans-serif;">${t.d7roas || '&mdash;'}</td>
  </tr>`;
}).join('\n');

function sectionHead(title) {
  return `<tr><td style="padding:26px 32px 12px;background:#FAFAF8;">
    <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:2.5px;color:#2D6741;text-transform:uppercase;font-family:Arial,sans-serif;border-bottom:2px solid #2D6741;padding-bottom:8px;display:inline-block;">${title}</p>
  </td></tr>`;
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Vegamour ROAS Brief &mdash; ${d.dateShort}</title>
<style>
body,table,td,p,a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
table,td { mso-table-lspace:0; mso-table-rspace:0; }
@media only screen and (max-width:500px) {
  .card-cell { display:inline-block !important; width:47% !important; padding:0 1.5% 10px 0 !important; vertical-align:top !important; }
  .cards-row td { font-size:0 !important; }
  .desktop-only { display:none !important; }
  .wrap-table { width:100% !important; }
  h1 { font-size:22px !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background:#EEEEE8;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#EEEEE8">
<tr><td align="center" style="padding:24px 10px 40px;">

<table class="wrap-table" width="680" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;">

  <!-- Header -->
  <tr><td style="background:#2D6741;border-radius:8px 8px 0 0;padding:28px 32px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td>
          <p style="margin:0 0 4px;font-size:20px;font-weight:800;color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.3px;">VEGAMOUR</p>
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.65);font-family:Arial,Helvetica,sans-serif;letter-spacing:0.5px;">Google Ads Performance Brief</p>
        </td>
        <td align="right" class="desktop-only">
          <p style="margin:0 0 2px;font-size:10px;color:rgba(255,255,255,0.5);font-family:Arial,sans-serif;text-align:right;">Prepared by</p>
          <p style="margin:0;font-size:13px;font-weight:700;color:rgba(255,255,255,0.9);font-family:Arial,sans-serif;text-align:right;">Melleka Marketing</p>
        </td>
      </tr>
    </table>
    <p style="margin:20px 0 0;font-size:26px;font-weight:800;color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.5px;">ROAS Report &mdash; ${d.dateLong}</p>
    <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.65);font-family:Arial,sans-serif;">Enabled campaigns only &nbsp;&bull;&nbsp; Account 7567846915</p>
  </td></tr>

  <!-- Cards row -->
  <tr><td style="background:#FAFAF8;padding:20px 26px 0;border-left:1px solid #E5E5E0;border-right:1px solid #E5E5E0;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" class="cards-row">
      <tr>
        ${card('YESTERDAY', p.yesterday.roas, yG, p.yesterday.spend, p.yesterday.rev)}
        ${card('7-DAY', p.d7.roas, d7G, p.d7.spend, p.d7.rev)}
        ${card('14-DAY', p.d14.roas, d14G, p.d14.spend, p.d14.rev)}
        ${card('30-DAY', p.d30.roas, d30G, p.d30.spend, p.d30.rev)}
      </tr>
    </table>
  </td></tr>

  <!-- Progress bar -->
  <tr><td style="background:#FAFAF8;padding:16px 32px 20px;border-left:1px solid #E5E5E0;border-right:1px solid #E5E5E0;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;border:1px solid #E5E5E0;border-radius:8px;">
      <tr><td style="padding:16px 20px 8px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td><span style="font-size:12px;color:#6B7280;font-family:Arial,sans-serif;">7-Day ROAS vs 3.0x (300%) Target</span></td>
            <td align="right"><span style="font-size:12px;font-weight:700;color:${dirColor};font-family:Arial,sans-serif;">${gap} pts ${dir} target</span></td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:6px 20px 8px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F3F4F6;border-radius:4px;height:8px;">
          <tr>
            <td width="${barPct}%" style="background:${barColor};border-radius:4px;height:8px;font-size:0;line-height:8px;">&nbsp;</td>
            <td></td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:4px 20px 16px;"><span style="font-size:10px;color:#9CA3AF;font-family:Arial,sans-serif;">${p.d7.roas.toFixed(0)}% achieved &nbsp;&bull;&nbsp; 300% target &nbsp;&bull;&nbsp; ${d.attributionNote || ''}</span></td></tr>
    </table>
  </td></tr>

  <!-- Campaign Breakdown -->
  ${sectionHead(`Campaign Breakdown &mdash; ${d.dateShort}`)}
  <tr><td style="background:#FAFAF8;padding:0 32px 16px;border-left:1px solid #E5E5E0;border-right:1px solid #E5E5E0;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:8px;overflow:hidden;border:1px solid #E5E5E0;">
      <tr style="background:#F9FAFB;">
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:left;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">Campaign</th>
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;" class="desktop-only">Spend</th>
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">Revenue</th>
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">ROAS</th>
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;" class="desktop-only">Conv</th>
      </tr>
      ${campaignRows}
      <tr>
        <td style="padding:13px 14px;font-size:12px;font-weight:700;color:#111827;background:#F9FAFB;border-top:2px solid #E5E5E0;font-family:Arial,sans-serif;">TOTAL</td>
        <td style="padding:13px 14px;font-size:12px;font-weight:700;color:#111827;background:#F9FAFB;border-top:2px solid #E5E5E0;text-align:right;font-family:Arial,sans-serif;" class="desktop-only">${money(totalSpend)}</td>
        <td style="padding:13px 14px;font-size:12px;font-weight:700;color:#111827;background:#F9FAFB;border-top:2px solid #E5E5E0;text-align:right;font-family:Arial,sans-serif;">${money(totalRev)}</td>
        <td style="padding:13px 14px;font-size:13px;font-weight:700;color:${totalGrade.text};background:#F9FAFB;border-top:2px solid #E5E5E0;text-align:right;font-family:Arial,sans-serif;">${totalRoas}%</td>
        <td style="padding:13px 14px;font-size:12px;font-weight:700;color:#111827;background:#F9FAFB;border-top:2px solid #E5E5E0;text-align:right;font-family:Arial,sans-serif;" class="desktop-only">${totalConv.toFixed(1)}</td>
      </tr>
    </table>
  </td></tr>

  <!-- Key Insights -->
  ${sectionHead(`Key Insights &mdash; ${d.dateShort}`)}
  <tr><td style="background:#FAFAF8;padding:0 32px 16px;border-left:1px solid #E5E5E0;border-right:1px solid #E5E5E0;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${insightCards}
    </table>
  </td></tr>

  <!-- 5-Day Trend -->
  ${sectionHead('5-Day ROAS Trend')}
  <tr><td style="background:#FAFAF8;padding:0 32px 16px;border-left:1px solid #E5E5E0;border-right:1px solid #E5E5E0;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:8px;overflow:hidden;border:1px solid #E5E5E0;">
      <tr style="background:#F9FAFB;">
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:left;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">Date</th>
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;" class="desktop-only">Spend</th>
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;" class="desktop-only">Revenue</th>
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">ROAS</th>
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;">Grade</th>
        <th style="padding:10px 14px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;text-align:right;font-family:Arial,sans-serif;border-bottom:1px solid #E5E5E0;" class="desktop-only">7-Day</th>
      </tr>
      ${trendRows}
    </table>
  </td></tr>

  <!-- Attribution Forecast -->
  ${sectionHead('Overnight Attribution Forecast')}
  <tr><td style="background:#FAFAF8;padding:0 32px 24px;border-left:1px solid #E5E5E0;border-right:1px solid #E5E5E0;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding:0 0 10px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="3" style="background:#2563EB;border-radius:3px 0 0 3px;">&nbsp;</td>
            <td style="background:#FFFFFF;padding:14px 18px;border:1px solid #E5E5E0;border-left:none;border-radius:0 6px 6px 0;">
              <p style="margin:0 0 5px;font-size:9px;font-weight:700;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;font-family:Arial,sans-serif;">Expected Sealed Number &mdash; ${d.dateShort}</p>
              <p style="margin:0;font-size:12px;color:#4B5563;line-height:1.65;font-family:Arial,sans-serif;">${d.attributionForecast || ''}</p>
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

  <!-- Bottom spacer -->
  <tr><td height="1" style="background:#2D6741;font-size:0;">&nbsp;</td></tr>

</table>
</td></tr>
</table>

</body>
</html>`;

process.stdout.write(html);
