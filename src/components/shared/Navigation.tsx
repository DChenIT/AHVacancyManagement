export type Tab = 'dashboard' | 'priority' | 'new-report' | 'preview' | 'admin';

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
  showAdmin: boolean;
}

export function Navigation({ active, onChange, showAdmin }: Props) {
  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'priority', label: 'Priority Queue', icon: '🎯' },
    { id: 'new-report', label: 'New Report', icon: '📝' },
    { id: 'preview', label: 'Report Preview', icon: '📋' },
    ...(showAdmin ? [{ id: 'admin' as Tab, label: 'Admin', icon: '⚙️' }] : []),
  ];

  return (
    <nav style={{
      display: 'flex',
      backgroundColor: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      width: '100%',
      overflowX: 'auto',
    }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            background: 'none', border: 'none',
            borderBottom: active === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
            color: active === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
            cursor: 'pointer', padding: '14px 16px', fontSize: 15,
            fontWeight: active === tab.id ? 600 : 400,
            display: 'flex', alignItems: 'center', gap: 6,
            transition: 'color 0.15s', whiteSpace: 'nowrap',
            flex: 1, justifyContent: 'center',
          }}
        >
          <span>{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
