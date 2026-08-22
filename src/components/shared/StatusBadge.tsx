import { STATUS_CATEGORY_COLOR, type StatusColor } from '../../types';

const COLOR_VARS: Record<StatusColor, { fg: string; bg: string }> = {
  success: { fg: 'var(--success)', bg: 'var(--success-bg)' },
  warning: { fg: 'var(--warning)', bg: 'var(--warning-bg)' },
  info: { fg: 'var(--info)', bg: 'var(--info-bg)' },
  danger: { fg: 'var(--danger)', bg: 'var(--danger-bg)' },
  purple: { fg: 'var(--purple)', bg: 'var(--purple-bg)' },
  muted: { fg: 'var(--text-muted)', bg: 'var(--bg-subtle)' },
};

const STATUS_ICON: Record<StatusColor, string> = {
  success: '✓',
  warning: '●',
  info: '📄',
  danger: '✕',
  purple: '●',
  muted: '○',
};

interface Props {
  categoryLabel: string;
}

export function StatusBadge({ categoryLabel }: Props) {
  const color = STATUS_CATEGORY_COLOR[categoryLabel] ?? 'muted';
  const { fg, bg } = COLOR_VARS[color];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      backgroundColor: bg, color: fg,
      borderRadius: 12, padding: '3px 10px',
      fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      <span aria-hidden="true">{STATUS_ICON[color]}</span>
      {categoryLabel}
    </span>
  );
}
