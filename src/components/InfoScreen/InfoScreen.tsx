import { AGING_DAYS_THRESHOLD, AGING_STREAK_THRESHOLD, RISK_DAYS_MEDIUM, RISK_DAYS_HIGH, RISK_DAYS_CRITICAL } from '../../types';

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{
      backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10,
      padding: '16px 18px', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span aria-hidden="true">{icon}</span>
        <span style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700 }}>{title}</span>
      </div>
      <div style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', backgroundColor: color, color: 'var(--accent-fg)',
      borderRadius: 12, padding: '2px 10px', fontSize: 13, fontWeight: 600, margin: '2px 4px 2px 0',
    }}>{children}</span>
  );
}

export function InfoScreen() {
  return (
    <div style={{ padding: 20, overflowY: 'auto', height: '100%', maxWidth: 780 }}>
      <h2 style={{ color: 'var(--text-primary)', fontSize: 18, marginTop: 0, marginBottom: 6 }}>How Priority Is Calculated</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 0, marginBottom: 20 }}>
        Reference for how the Dashboard, Priority Queue, and New Report screens rank and flag communities and units — nothing here is manually set by a person.
      </p>

      <Section title="Priority Queue ranking" icon="🎯">
        <p style={{ marginTop: 0 }}>Every community is ranked using its most recent vacancy report as of the date you're viewing. Three sort modes are available at the top of the table:</p>
        <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
          <li><strong>Vacancy rate</strong> (default) — open units ÷ total units for that community, highest first.</li>
          <li><strong>Longest vacant</strong> — the single longest-open unit in that report, using its Vacant Since date.</li>
          <li><strong>Aging risk</strong> — how many units in that report are flagged aging (see below), highest first.</li>
        </ul>
      </Section>

      <Section title="What counts as an open vacancy" icon="🏠">
        <p style={{ margin: 0 }}>
          Any unit whose Status Category is anything <em>other than</em> "Approved" counts as open. Once a unit's status reaches Approved, it drops out of the open-vacancy count and the vacancy rate.
        </p>
      </Section>

      <Section title="Aging risk flag" icon="🚩">
        <p style={{ marginTop: 0 }}>A unit gets flagged aging if either of these is true:</p>
        <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
          <li>It has a Vacant Since date, and it's been open <strong>{AGING_DAYS_THRESHOLD}+ days</strong> as of the report date.</li>
          <li>It has <em>no</em> Vacant Since date on file, but it's shown up as open in <strong>{AGING_STREAK_THRESHOLD}+ consecutive weekly reports</strong> in a row for that community — a fallback so a unit doesn't slip through just because that date was never entered.</li>
        </ul>
      </Section>

      <Section title="Risk (auto) — New Report screen" icon="⚠️">
        <p style={{ marginTop: 0 }}>
          Each unit row's Risk level is calculated automatically from its Vacant Since date to the report date — it isn't something staff pick. It's recalculated every time the report is saved, so it never drifts out of date:
        </p>
        <div style={{ marginBottom: 0 }}>
          <Pill color="var(--success)">Low: 0–{RISK_DAYS_MEDIUM - 1} days</Pill>
          <Pill color="var(--warning)">Medium: {RISK_DAYS_MEDIUM}–{RISK_DAYS_HIGH - 1} days</Pill>
          <Pill color="var(--danger)">High: {RISK_DAYS_HIGH}–{RISK_DAYS_CRITICAL - 1} days</Pill>
          <Pill color="var(--purple)">Critical: {RISK_DAYS_CRITICAL}+ days</Pill>
        </div>
      </Section>

      <Section title="Fast-Track Approvals" icon="⚡">
        <p style={{ margin: 0 }}>
          Units already in motion toward approval — Status Detail of <strong>Submitted to Compliance</strong> or <strong>Corrections Requested</strong> — are called out separately on the Priority Queue since they're expected to fill fastest and just need a quick follow-up. Corrections Requested sorts first since it's blocking on the applicant or staff; Submitted to Compliance is just waiting on the reviewer.
        </p>
      </Section>
    </div>
  );
}
