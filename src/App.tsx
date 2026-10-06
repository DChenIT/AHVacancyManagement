import { useEffect, useMemo, useState } from 'react';
import { useCommunities } from './hooks/useCommunities';
import { useCurrentUser } from './hooks/useCurrentUser';
import { useIsAdmin } from './hooks/useIsAdmin';
import { useReportCompleteness, localTodayIso } from './hooks/useReportCompleteness';
import { Navigation, type Tab } from './components/shared/Navigation';
import { GlobalFilterBar, EMPTY_FILTERS, applyRoleFilters, type GlobalFilters } from './components/shared/GlobalFilterBar';
import { SurveyPrompt } from './components/shared/SurveyPrompt';
import { HomeDashboard } from './components/HomeDashboard/HomeDashboard';
import { PriorityQueue } from './components/PriorityQueue/PriorityQueue';
import { VacancyReportEntry } from './components/VacancyReportEntry/VacancyReportEntry';
import { ReportPreview } from './components/ReportPreview/ReportPreview';
import { AdminScreen } from './components/AdminScreen/AdminScreen';
import { TrainingScreen } from './components/TrainingScreen/TrainingScreen';
import hgInfinityLogo from './assets/hg-infinity.webp';
import './App.css';

function getInitialTheme(): 'dark' | 'light' {
  return (localStorage.getItem('theme') as 'dark' | 'light') ?? 'light';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('new-report');
  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme);
  const [previewTarget, setPreviewTarget] = useState<{ communityId: string; reportId: string } | undefined>();
  const [editTarget, setEditTarget] = useState<{ communityId: string; reportId: string } | undefined>();
  const [newReportDirty, setNewReportDirty] = useState(false);
  const [showSurveyPrompt, setShowSurveyPrompt] = useState(false);

  const { communities, loading: communitiesLoading, updateCommunity, assignTeamMember } = useCommunities();
  const { currentUser } = useCurrentUser();
  const { isAdmin: userIsAdmin } = useIsAdmin(currentUser?.email);

  // Slicers shared by the Dashboard and Priority Queue (RPS/RMS/Director/Compliance/Asset Manager, plus
  // Submitted/Not submitted on the Dashboard only). The other tabs aren't filtered, so a slicer can't silently trim them.
  const [filters, setFilters] = useState<GlobalFilters>(EMPTY_FILTERS);
  // The Dashboard can be viewed "as of" an earlier date to see a past week's reports and who had submitted.
  const today = localTodayIso();
  const [asOfDate, setAsOfDate] = useState(today);
  const { isUpToDate, loading: completenessLoading, refresh: refreshCompleteness } = useReportCompleteness(asOfDate);

  // The hook loads once on its own; re-check each time the Dashboard is opened so a report saved
  // or deleted elsewhere is reflected in the Submitted/Not submitted slicer.
  useEffect(() => {
    if (activeTab === 'dashboard') refreshCompleteness();
  }, [activeTab, refreshCompleteness]);

  const roleScoped = useMemo(() => applyRoleFilters(communities, filters), [communities, filters]);
  const filteredCommunities = useMemo(() => {
    if (filters.submission === 'all' || completenessLoading) return roleScoped;
    return roleScoped.filter(c => (filters.submission === 'submitted') === isUpToDate(c.id));
  }, [roleScoped, filters.submission, completenessLoading, isUpToDate]);
  // The Priority Queue gets the same people slicers (RPS/RMS/Director/Compliance/Asset Manager) but not the
  // submission slicer or As of date - it has its own As of and ranks communities that have reports.
  const showFilterBar = activeTab === 'dashboard' || activeTab === 'priority';

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

  // Only a brand-new report counts as a submission worth a survey prompt, not an edit to an existing one.
  function handleSaved(communityId: string, reportId: string, isNewReport?: boolean) {
    setShowSurveyPrompt(!!isNewReport);
    goToPreview(communityId, reportId);
  }

  function goToEdit(communityId: string, reportId: string) {
    setEditTarget({ communityId, reportId });
    setActiveTab('new-report');
  }

  // Clicking the New Report nav tab directly (not via "Edit This Report") always starts blank.
  function handleTabChange(tab: Tab) {
    if (activeTab === 'new-report' && newReportDirty) {
      const confirmed = window.confirm('You have unsaved changes on this report. Leave without saving?');
      if (!confirmed) return;
    }
    if (tab === 'new-report') setEditTarget(undefined);
    setShowSurveyPrompt(false);
    setActiveTab(tab);
  }

  return (
    <div style={{
      position: 'relative', zIndex: 0, overflowX: 'hidden',
      display: 'flex', flexDirection: 'column', minHeight: '100vh',
      background: 'var(--hg-gradient-page), var(--bg-base)', fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <img
        src={hgInfinityLogo}
        alt=""
        aria-hidden="true"
        style={{
          position: 'fixed', zIndex: -1, pointerEvents: 'none', userSelect: 'none',
          width: '100%', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
          opacity: 0.10,
          filter: 'drop-shadow(0 12px 28px rgba(0,0,0,0.45))',
        }}
      />
      <header style={{ backgroundColor: 'var(--accent)', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>🏘️</span>
          <span style={{ color: 'var(--accent-fg)', fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap' }}>AH Community Pulse</span>
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

      <div style={{
        backgroundColor: 'var(--info-bg)', color: 'var(--info)', borderBottom: '1px solid var(--border)',
        padding: '14px 16px', fontSize: 22, fontWeight: 800, textAlign: 'center', flexShrink: 0,
      }}>
        📅 Reminder: Weekly vacancy reports are due every Wednesday.
      </div>

      <Navigation active={activeTab} onChange={handleTabChange} showAdmin={userIsAdmin} />

      {showFilterBar && (
        <GlobalFilterBar
          allCommunities={communities}
          roleScoped={roleScoped}
          shownCount={activeTab === 'priority' ? roleScoped.length : filteredCommunities.length}
          variant={activeTab === 'priority' ? 'priority' : 'dashboard'}
          isUpToDate={isUpToDate}
          completenessLoading={completenessLoading}
          filters={filters}
          onChange={setFilters}
          asOfDate={asOfDate}
          today={today}
          onAsOfChange={setAsOfDate}
        />
      )}

      {activeTab === 'preview' && showSurveyPrompt && <SurveyPrompt onDismiss={() => setShowSurveyPrompt(false)} />}

      <main style={{ flex: 1, minHeight: 0 }}>
        {/* The Dashboard keeps the full list for lookups (so a selected community never disappears
            when a slicer changes) and uses the filtered list only for what it offers to pick from. */}
        {activeTab === 'dashboard' && (
          <HomeDashboard
            communities={communities}
            communityOptions={filteredCommunities}
            isUpToDate={isUpToDate}
            communitiesLoading={communitiesLoading}
            onViewReport={goToPreview}
            currentUser={currentUser}
            asOfDate={asOfDate}
            today={today}
          />
        )}
        {activeTab === 'priority' && (
          <PriorityQueue communities={roleScoped} communitiesLoading={communitiesLoading} onViewReport={goToPreview} currentUser={currentUser} />
        )}
        {activeTab === 'new-report' && (
          <VacancyReportEntry
            communities={communities}
            communitiesLoading={communitiesLoading}
            onSaved={handleSaved}
            editReportId={editTarget?.reportId}
            editCommunityId={editTarget?.communityId}
            onDirtyChange={setNewReportDirty}
            currentUser={currentUser}
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
        {activeTab === 'training' && <TrainingScreen />}
        {activeTab === 'admin' && userIsAdmin && (
          <AdminScreen communities={communities} communitiesLoading={communitiesLoading} updateCommunity={updateCommunity} assignTeamMember={assignTeamMember} />
        )}
      </main>
    </div>
  );
}
