import { useState } from 'react';
import type { CurrentUser } from '../../hooks/useCurrentUser';
import { MAX_COMMENT_LENGTH, type UnitComment } from '../../hooks/useUnitComments';
import { formatDateTime } from './AuditTrailModal';

/** The 💬 button at the right of a unit row: shows how many comments the unit has, and opens/closes its thread. */
export function CommentToggle({ count, open, onToggle }: { count: number; open: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-expanded={open}
      title={open ? 'Hide the discussion' : count ? 'Show the discussion' : 'Start a discussion on this unit'}
      style={{
        background: open ? 'var(--bg-subtle)' : 'none',
        border: `1px solid ${count > 0 ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 6, color: count > 0 ? 'var(--accent)' : 'var(--text-secondary)',
        padding: '4px 10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}
    >
      <span aria-hidden="true">💬</span>{count > 0 ? count : 'Add'}<span aria-hidden="true">{open ? '▴' : '▾'}</span>
    </button>
  );
}

interface ThreadProps {
  unitNumber: string;
  comments: UnitComment[];
  reportDate: string;
  currentUser: CurrentUser | null;
  isAdmin?: boolean;
  onPost: (text: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

// The discussion for one unit: everything said about it on any week's report, oldest first, with a box to add to it.
export function CommentThread({ unitNumber, comments, reportDate, currentUser, isAdmin, onPost, onDelete }: ThreadProps) {
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function describe(action: string, e: unknown): string {
    console.error(`${action} failed`, e);
    const raw = e instanceof Error ? e.message : String(e);
    return /privilege|prv[A-Z]|forbidden|403/i.test(raw)
      ? `Couldn't ${action}: you don't have permission. Ask an admin to check your security role includes Unit Comments.`
      : `Couldn't ${action}: ${raw.length > 200 ? `${raw.slice(0, 200)}…` : raw}`;
  }

  // The author (or an admin) can remove a comment. Matching on email where we have it, name otherwise - a UI
  // courtesy like the Fast-Track unmark; Dataverse itself only lets people delete their own rows.
  function canDelete(c: UnitComment): boolean {
    if (isAdmin) return true;
    if (!currentUser) return false;
    if (c.authorEmail && currentUser.email) return c.authorEmail.trim().toLowerCase() === currentUser.email.trim().toLowerCase();
    return c.author.trim().toLowerCase() === currentUser.displayName.trim().toLowerCase();
  }

  async function post() {
    if (!draft.trim() || posting) return;
    setPosting(true);
    setError(null);
    try {
      await onPost(draft);
      setDraft('');
    } catch (e) {
      setError(describe('post the comment', e));
    } finally {
      setPosting(false);
    }
  }

  async function remove(c: UnitComment) {
    if (!window.confirm('Delete this comment?')) return;
    setBusyId(c.id);
    setError(null);
    try {
      await onDelete(c.id);
    } catch (e) {
      setError(describe('delete the comment', e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ padding: '12px 16px 14px', backgroundColor: 'var(--bg-subtle)' }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
        Discussion — Unit {unitNumber}
      </div>

      {comments.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 10 }}>No comments yet. Start the discussion below.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
        {comments.map(c => (
          <div key={c.id} style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 }}>
              <strong style={{ color: 'var(--text-primary)', fontSize: 14 }}>{c.author}</strong>
              <span style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>{formatDateTime(c.when)}</span>
              {c.reportDate && c.reportDate !== reportDate && (
                <span style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>· on the {c.reportDate} report</span>
              )}
              {canDelete(c) && (
                <button
                  onClick={() => remove(c)}
                  disabled={busyId === c.id}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline', opacity: busyId === c.id ? 0.6 : 1 }}
                >{busyId === c.id ? 'Deleting…' : 'Delete'}</button>
              )}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.text}</div>
          </div>
        ))}
      </div>

      {error && <div role="alert" style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>⚠ {error}</div>}
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        maxLength={MAX_COMMENT_LENGTH}
        rows={2}
        placeholder="Add a comment…"
        style={{
          width: '100%', boxSizing: 'border-box', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)',
          border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', fontSize: 14, fontFamily: 'inherit', resize: 'vertical',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
        <button
          onClick={post}
          disabled={!draft.trim() || posting}
          style={{
            backgroundColor: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: 6, padding: '6px 16px',
            fontSize: 14, fontWeight: 600, cursor: !draft.trim() || posting ? 'default' : 'pointer', opacity: !draft.trim() || posting ? 0.6 : 1,
          }}
        >{posting ? 'Posting…' : 'Post comment'}</button>
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{draft.length}/{MAX_COMMENT_LENGTH}</span>
      </div>
    </div>
  );
}
