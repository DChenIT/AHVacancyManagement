import { useEffect, useState } from 'react';
import { useCommunities } from './hooks/useCommunities';
import { useCurrentUser } from './hooks/useCurrentUser';
import { useIsAdmin } from './hooks/useIsAdmin';
import { Navigation, type Tab } from './components/shared/Navigation';
import { HomeDashboard } from './components/HomeDashboard/HomeDashboard';
import { PriorityQueue } from './components/PriorityQueue/PriorityQueue';
import { VacancyReportEntry } from './components/VacancyReportEntry/VacancyReportEntry';
import { ReportPreview } from './components/ReportPreview/ReportPreview';
import { AdminScreen } from './components/AdminScreen/AdminScreen';
import hgInfinityLogo from './assets/hg-infinity.webp';
import './App.css';

function getInitialTheme(): 'dark' | 'light' {
  return (localStorage.getItem('theme') as 'dark' | 'light') ?? 'dark';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('new-report');
  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme);
  const [previewTarget, setPreviewTarget] = useState<{ communityId: string; reportId: string } | undefined>();
  const [editTarget, setEditTarget] = useState<{ communityId: string; reportId: string } | undefined>();

  const { communities, loading: communitiesLoading, updateCommunity } = useCommunities();
  const { currentUser } = useCurrentUser();
  const { isAdmin: userIsAdmin } = useIsAdmin(currentUser?.email);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // If a non-admin somehow lands on the admin tab (e.g. stale state), bounce them off it.
  useEffect(() => {
    if (activeTab === 'admin' && !userIsAdmin) setActiveTab('dashboard');
  }, [activeTab, userIsAdmin]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  function goToPreview(communityId: string, reportId: string) {
    setPreviewTarget({ communityId, reportId });
    setEditTarget(undefined);
    setActiveTab('preview');
  }

  function goToEdit(communityId: string, reportId: string) {
    setEditTarget({ communityId, reportId });
    setActiveTab('new-report');
  }

  // Clicking the New Report nav tab directly (not via "Edit This Report") always starts blank.
  function handleTabChange(tab: Tab) {
    if (tab === 'new-report') setEditTarget(undefined);
    setActiveTab(tab);
  }

  return (
    <div style={{
      position: 'relative', zIndex: 0, overflow: 'hidden',
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: 'var(--hg-gradient-page), var(--bg-base)', fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <img
        src={hgInfinityLogo}
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute', zIndex: -1, pointerEvents: 'none', userSelect: 'none',
          width: '100%', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
          opacity: 0.10,
          filter: 'drop-shadow(0 12px 28px rgba(0,0,0,0.45))',
        }}
      />
      <header style={{ backgroundColor: 'var(--accent)', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>🏘️</span>
          <span style={{ color: 'var(--accent-fg)', fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap' }}>Community Pulse</span>
        </div>
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          style={{
            background: 'none', border: '1px solid var(--accent-fg)', borderRadius: 20,
            padding: '4px 10px', cursor: 'pointer', fontSize: 16, lineHeight: 1,
            color: 'var(--accent-fg)', display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </header>

      <Navigation active={activeTab} onChange={handleTabChange} showAdmin={userIsAdmin} />

      <main style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {activeTab === 'dashboard' && (
          <HomeDashboard communities={communities} communitiesLoading={communitiesLoading} onViewReport={goToPreview} currentUser={currentUser} />
        )}
        {activeTab === 'priority' && (
          <PriorityQueue communities={communities} communitiesLoading={communitiesLoading} onViewReport={goToPreview} />
        )}
        {activeTab === 'new-report' && (
          <VacancyReportEntry
            communities={communities}
            communitiesLoading={communitiesLoading}
            onSaved={goToPreview}
            editReportId={editTarget?.reportId}
            editCommunityId={editTarget?.communityId}
          />
        )}
        {activeTab === 'preview' && (
          <ReportPreview
            communities={communities}
            communitiesLoading={communitiesLoading}
            initialCommunityId={previewTarget?.communityId}
            initialReportId={previewTarget?.reportId}
            isAdmin={userIsAdmin}
            onEditReport={goToEdit}
          />
        )}
        {activeTab === 'admin' && userIsAdmin && (
          <AdminScreen communities={communities} communitiesLoading={communitiesLoading} updateCommunity={updateCommunity} />
        )}
      </main>
    </div>
  );
}
