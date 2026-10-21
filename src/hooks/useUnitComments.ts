import { useCallback, useEffect, useMemo, useState } from 'react';
import { Cr1e9_unitcommentsService } from '../generated/services/Cr1e9_unitcommentsService';
import { getAllPages } from './getAllPages';

export interface UnitComment {
  id: string;
  text: string;
  author: string;
  authorEmail: string;
  /** ISO timestamp (the row's own Created On). */
  when: string;
  /** The weekly report the comment was written on, so a thread that spans weeks shows which week each one came from. */
  reportDate?: string;
}

export const MAX_COMMENT_LENGTH = 2000;

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

// Comments belong to a unit, not to one week's row for it (each weekly report has its own row), so they're tied
// to community + unit number and the same thread shows on every week's report.
export const unitCommentKey = (communityId: string, unitNumber: string) => `${communityId}|${norm(unitNumber)}`;

/** Every comment for one community's units, grouped by unit. Loaded once per community and kept in sync as people post or delete. */
export function useUnitComments(communityId: string | undefined) {
  const [comments, setComments] = useState<Map<string, UnitComment[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!communityId) { setComments(new Map()); return; }
    setLoading(true);
    setError(null);
    try {
      const result = await getAllPages(opts => Cr1e9_unitcommentsService.getAll(opts), {
        select: ['cr1e9_unitcommentid', 'cr1e9_comment', 'cr1e9_author', 'cr1e9_authoremail', 'cr1e9_unitkey', 'cr1e9_reportdate', 'createdon'],
        filter: `startswith(cr1e9_unitkey,'${communityId}|')`,
        orderBy: ['createdon asc'],
      });
      if (result.error) throw new Error(result.error.message ?? 'Failed to load comments');
      const map = new Map<string, UnitComment[]>();
      for (const r of result.data ?? []) {
        const key = r.cr1e9_unitkey;
        if (!key) continue;
        const list = map.get(key) ?? [];
        list.push({
          id: r.cr1e9_unitcommentid,
          text: r.cr1e9_comment ?? '',
          author: r.cr1e9_author || 'Unknown',
          authorEmail: r.cr1e9_authoremail ?? '',
          when: r.createdon ?? '',
          reportDate: r.cr1e9_reportdate ? r.cr1e9_reportdate.split('T')[0] : undefined,
        });
        map.set(key, list);
      }
      setComments(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => { refresh(); }, [refresh]);

  const commentsFor = useCallback(
    (unitNumber: string): UnitComment[] => (communityId ? comments.get(unitCommentKey(communityId, unitNumber)) ?? [] : []),
    [comments, communityId],
  );

  const addComment = useCallback(async (input: { unitNumber: string; text: string; author: string; authorEmail: string; reportDate: string }) => {
    if (!communityId) return;
    const text = input.text.trim();
    const result = await Cr1e9_unitcommentsService.create({
      cr1e9_name: text.length > 100 ? `${text.slice(0, 100)}…` : text,
      cr1e9_comment: text,
      cr1e9_author: input.author,
      cr1e9_authoremail: input.authorEmail || undefined,
      cr1e9_unitkey: unitCommentKey(communityId, input.unitNumber),
      cr1e9_unitnumber: input.unitNumber.trim(),
      cr1e9_reportdate: input.reportDate || undefined,
    } as any);
    if (result.error) throw new Error(result.error.message ?? 'Failed to post the comment');
    await refresh();
  }, [communityId, refresh]);

  const deleteComment = useCallback(async (id: string) => {
    await Cr1e9_unitcommentsService.delete(id);
    await refresh();
  }, [refresh]);

  return useMemo(() => ({ commentsFor, addComment, deleteComment, loading, error }), [commentsFor, addComment, deleteComment, loading, error]);
}
