import { useEffect, useMemo, useState } from 'react';
import type { Community, TeamRole } from '../../hooks/useCommunities';
import { useAppSettings } from '../../hooks/useAppSettings';
import { useOrgUserSearch, type OrgUser } from '../../hooks/useOrgUserSearch';

interface Props {
  communities: Community[];
  communitiesLoading: boolean;
  updateCommunity: (id: string, changes: { hopperGoal?: number; active?: boolean; defaultReportRecipients?: string }) => Promise<void>;
  assignTeamMember: (communityIds: string[], role: TeamRole, person: { displayName: string; email: string }) => Promise<void>;
}

const ROLE_OPTIONS: { value: TeamRole; label: string }[] = [
  { value: 'regionalManager', label: 'Regional Property Supervisor (RPS)' },
  { value: 'regionalMaintenanceSupervisor', label: 'Regional Maintenance Supervisor (RMS)' },
  { value: 'director', label: 'Director' },
  { value: 'complianceSpecialist', label: 'Compliance Specialist' },
];

function currentAssignee(c: Community, role: TeamRole): string | undefined {
  switch (role) {
    case 'regionalManager': return c.regionalManager;
    case 'regionalMaintenanceSupervisor': return c.regionalMaintenanceSupervisor;
    case 'director': return c.director;
    case 'complianceSpecialist': return c.complianceSpecialist;
  }
}

function TeamAssignment({ communities, assignTeamMember }: { communities: Community[]; assignTeamMember: Props['assignTeamMember'] }) {
  const { search } = useOrgUserSearch();
  const [role, setRole] = useState<TeamRole>('regionalManager');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OrgUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<OrgUser | null>(null);
  const [communitySearch, setCommunitySearch] = useState('');
  const [selectedCommunityIds, setSelectedCommunityIds] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState(false);

  // Debounced live search as the admin types a name.
  useEffect(() => {
    if (!query.trim()) { setResults([]); setSearching(false); return; }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      const found = await search(query);
      if (!cancelled) { setResults(found); setSearching(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, search]);

  const filteredCommunities = useMemo(() => {
    const q = communitySearch.trim().toLowerCase();
    if (!q) return communities;
    return communities.filter(c => c.name.toLowerCase().includes(q) || c.code?.toLowerCase().includes(q));
  }, [communities, communitySearch]);

  function toggleCommunity(id: string) {
    setSelectedCommunityIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleAssign() {
    if (!selectedPerson || selectedCommunityIds.size === 0) return;
    setAssigning(true);
    setAssignError(null);
    setAssignSuccess(false);
    try {
      await assignTeamMember([...selectedCommunityIds], role, selectedPerson);
      setAssignSuccess(true);
      setSelectedPerson(null);
      setSelectedCommunityIds(new Set());
    } catch (e) {
      setAssignError(e instanceof Error ? e.message : String(e));
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div style={{
      backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10,
      padding: '16px 18px', marginBottom: 28, maxWidth: 640,
    }}>
      <div style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Team Member Assignments</div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 0, marginBottom: 14 }}>
        Look someone up in the company directory and assign them to a role across one or more communities at once.
      </p>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ minWidth: 220 }}>
          <label style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block' }}>Role</label>
          <select
            value={role}
            onChange={e => { setRole(e.target.value as TeamRole); setAssignSuccess(false); }}
            style={inputStyle}
          >
            {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div style={{ minWidth: 260, flex: 1, position: 'relative' }}>
          <label style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block' }}>Person</label>
          {selectedPerson ? (
            <div style={{
              ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              backgroundColor: 'var(--bg-subtle)',
            }}>
              <span>{selectedPerson.displayName} <span style={{ color: 'var(--text-muted)' }}>({selectedPerson.email})</span></span>
              <button onClick={() => setSelectedPerson(null)} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 14, cursor: 'pointer' }}>✕</button>
            </div>
          ) : (
            <>
              <input
                type="text"
                placeholder="Search the directory by name…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                style={inputStyle}
              />
              {query.trim() && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: 4,
                  backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8,
                  maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}>
                  {searching && <div style={{ padding: '8px 10px', color: 'var(--text-muted)', fontSize: 13 }}>Searching…</div>}
                  {!searching && results.length === 0 && (
                    <div style={{ padding: '8px 10px', color: 'var(--text-muted)', fontSize: 13 }}>No matches.</div>
                  )}
                  {!searching && results.map(u => (
                    <button
                      key={u.id}
                      onClick={() => { setSelectedPerson(u); setQuery(''); setResults([]); }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none',
                        padding: '8px 10px', fontSize: 14, color: 'var(--text-primary)', cursor: 'pointer',
                      }}
                    >
                      {u.displayName} <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{u.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <label style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block' }}>
        Apply to communities ({selectedCommunityIds.size} selected)
      </label>
      <input
        type="text"
        placeholder="Search properties…"
        value={communitySearch}
        onChange={e => setCommunitySearch(e.target.value)}
        style={{ ...inputStyle, marginBottom: 8 }}
      />
      <div style={{
        maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8,
        backgroundColor: 'var(--bg-base)', marginBottom: 14,
      }}>
        {filteredCommunities.map(c => {
          const current = currentAssignee(c, role);
          return (
            <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={selectedCommunityIds.has(c.id)} onChange={() => toggleCommunity(c.id)} />
              <span style={{ color: 'var(--text-primary)' }}>{c.name}</span>
              {current && <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>— currently {current}</span>}
            </label>
          );
        })}
        {filteredCommunities.length === 0 && (
          <div style={{ padding: '8px 10px', color: 'var(--text-muted)', fontSize: 14 }}>No properties match.</div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={handleAssign}
          disabled={!selectedPerson || selectedCommunityIds.size === 0 || assigning}
          style={{
            backgroundColor: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: 6,
            padding: '8px 16px', fontSize: 14, fontWeight: 600,
            opacity: (!selectedPerson || selectedCommunityIds.size === 0 || assigning) ? 0.6 : 1,
          }}
        >
          {assigning ? 'Assigning…' : `Assign to ${selectedCommunityIds.size || ''} ${selectedCommunityIds.size === 1 ? 'Community' : 'Communities'}`}
        </button>
        {assignSuccess && <span style={{ color: 'var(--success)', fontSize: 14 }}>✓ Assigned</span>}
        {assignError && <span style={{ color: 'var(--danger)', fontSize: 14 }}>⚠ {assignError}</span>}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)',
  borderRadius: 6, padding: '6px 8px', fontSize: 14, width: '100%', boxSizing: 'border-box',
};

interface CommunityDraft {
  hopperGoal: number;
  active: boolean;
  defaultReportRecipients: string;
}

function draftFrom(c: Community): CommunityDraft {
  return { hopperGoal: c.hopperGoal, active: c.active, defaultReportRecipients: c.defaultReportRecipients ?? '' };
}

function isDirty(c: Community, d: CommunityDraft): boolean {
  return c.hopperGoal !== d.hopperGoal || c.active !== d.active || (c.defaultReportRecipients ?? '') !== d.defaultReportRecipients;
}

export function AdminScreen({ communities, communitiesLoading, updateCommunity, assignTeamMember }: Props) {
  const { portfolioVacancyGoal, loading: settingsLoading, updatePortfolioVacancyGoal } = useAppSettings();
  const [goalInput, setGoalInput] = useState<number | null>(null);
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalSaved, setGoalSaved] = useState(false);
  const [goalError, setGoalError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState<Record<string, CommunityDraft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [communityErrors, setCommunityErrors] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return communities;
    return communities.filter(c => c.name.toLowerCase().includes(q) || c.code?.toLowerCase().includes(q));
  }, [communities, search]);

  function draftFor(c: Community): CommunityDraft {
    return drafts[c.id] ?? draftFrom(c);
  }

  function updateDraft(c: Community, patch: Partial<CommunityDraft>) {
    setDrafts(prev => ({ ...prev, [c.id]: { ...draftFor(c), ...patch } }));
  }

  async function saveGoal() {
    if (goalInput === null) return;
    setGoalSaving(true);
    setGoalSaved(false);
    setGoalError(null);
    try {
      await updatePortfolioVacancyGoal(goalInput);
      setGoalSaved(true);
    } catch (e) {
      setGoalError(e instanceof Error ? e.message : String(e));
    } finally {
      setGoalSaving(false);
    }
  }

  async function saveCommunity(c: Community) {
    const draft = draftFor(c);
    setSavingId(c.id);
    setSavedId(null);
    setCommunityErrors(prev => { const next = { ...prev }; delete next[c.id]; return next; });
    try {
      await updateCommunity(c.id, draft);
      setDrafts(prev => { const next = { ...prev }; delete next[c.id]; return next; });
      setSavedId(c.id);
    } catch (e) {
      setCommunityErrors(prev => ({ ...prev, [c.id]: e instanceof Error ? e.message : String(e) }));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div style={{ padding: 20, overflowY: 'auto', height: '100%' }}>
      <h2 style={{ color: 'var(--text-primary)', fontSize: 18, marginTop: 0, marginBottom: 16 }}>Administration</h2>

      <div style={{
        backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10,
        padding: '16px 18px', marginBottom: 28, maxWidth: 420,
      }}>
        <div style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Portfolio vacancy goal</div>
        {settingsLoading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading…</div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="number"
              style={{ ...inputStyle, width: 120 }}
              value={goalInput ?? portfolioVacancyGoal}
              onChange={e => { setGoalInput(Number(e.target.value)); setGoalSaved(false); }}
            />
            <button onClick={saveGoal} disabled={goalSaving} style={{
              backgroundColor: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: 6,
              padding: '7px 14px', fontSize: 14, fontWeight: 600, opacity: goalSaving ? 0.6 : 1,
            }}>{goalSaving ? 'Saving…' : 'Save'}</button>
            {goalSaved && <span style={{ color: 'var(--success)', fontSize: 14 }}>✓ Saved</span>}
            {goalError && <span style={{ color: 'var(--danger)', fontSize: 14 }}>⚠ {goalError}</span>}
          </div>
        )}
      </div>

      <TeamAssignment communities={communities} assignTeamMember={assignTeamMember} />

      <div style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Communities</div>
      <input
        type="text"
        placeholder="Search properties…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ ...inputStyle, maxWidth: 280, marginBottom: 12 }}
      />

      {communitiesLoading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>Loading…</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8, backgroundColor: 'var(--bg-surface)' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-subtle)' }}>
                {['Community', 'Hopper Goal', 'Active', 'Default Report Recipients', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const draft = draftFor(c);
                const dirty = isDirty(c, draft);
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px', fontSize: 14 }}>
                      <div style={{ color: 'var(--text-primary)' }}>{c.name}</div>
                      {c.code && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{c.code}</div>}
                    </td>
                    <td style={{ padding: 6, width: 110 }}>
                      <input
                        type="number"
                        style={inputStyle}
                        value={draft.hopperGoal}
                        onChange={e => updateDraft(c, { hopperGoal: Number(e.target.value) })}
                      />
                    </td>
                    <td style={{ padding: 6, width: 70, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={draft.active}
                        onChange={e => updateDraft(c, { active: e.target.checked })}
                      />
                    </td>
                    <td style={{ padding: 6, minWidth: 220 }}>
                      <input
                        type="text"
                        style={inputStyle}
                        placeholder="name@company.com; name2@company.com"
                        value={draft.defaultReportRecipients}
                        onChange={e => updateDraft(c, { defaultReportRecipients: e.target.value })}
                      />
                    </td>
                    <td style={{ padding: 6, width: 100 }}>
                      {dirty && (
                        <button
                          onClick={() => saveCommunity(c)}
                          disabled={savingId === c.id}
                          style={{
                            backgroundColor: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: 6,
                            padding: '6px 12px', fontSize: 13, fontWeight: 600, opacity: savingId === c.id ? 0.6 : 1,
                          }}
                        >{savingId === c.id ? 'Saving…' : 'Save'}</button>
                      )}
                      {!dirty && savedId === c.id && <span style={{ color: 'var(--success)', fontSize: 13 }}>✓ Saved</span>}
                      {communityErrors[c.id] && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>⚠ {communityErrors[c.id]}</div>}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 14, color: 'var(--text-muted)', fontSize: 14 }}>No properties match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
