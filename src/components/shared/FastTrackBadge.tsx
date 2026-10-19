export function FastTrackBadge({ detail, referralPartner }: { detail: string; referralPartner?: string }) {
  const tone = detail === 'Denied'
    ? { bg: 'var(--danger-bg)', fg: 'var(--danger)', icon: '⛔' }
    : detail === 'Corrections Requested'
      ? { bg: 'var(--warning-bg)', fg: 'var(--warning)', icon: '⚠' }
      : detail === 'Referral Pending'
        ? { bg: 'var(--purple-bg)', fg: 'var(--purple)', icon: '🤝' }
        : { bg: 'var(--info-bg)', fg: 'var(--info)', icon: '📄' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      backgroundColor: tone.bg, color: tone.fg,
      borderRadius: 12, padding: '3px 10px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      <span aria-hidden="true">{tone.icon}</span>{detail}{referralPartner ? ` — ${referralPartner}` : ''}
    </span>
  );
}
