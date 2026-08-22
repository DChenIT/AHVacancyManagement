import { useCallback, useEffect, useState } from 'react';
import { Cr1e9_appsettingsesService } from '../generated/services/Cr1e9_appsettingsesService';
import { PORTFOLIO_VACANCY_GOAL_DEFAULT } from '../types';

export function useAppSettings() {
  const [id, setId] = useState<string | null>(null);
  const [portfolioVacancyGoal, setPortfolioVacancyGoal] = useState(PORTFOLIO_VACANCY_GOAL_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await Cr1e9_appsettingsesService.getAll({
        select: ['cr1e9_appsettingsid', 'cr1e9_name', 'cr1e9_portfoliovacancygoal'],
        filter: "cr1e9_name eq 'Global'",
      });
      if (result.error) {
        setError(result.error.message ?? 'Failed to load app settings');
      } else {
        const row = (result.data ?? [])[0];
        if (row) {
          setId(row.cr1e9_appsettingsid);
          setPortfolioVacancyGoal(row.cr1e9_portfoliovacancygoal ?? PORTFOLIO_VACANCY_GOAL_DEFAULT);
        }
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const updatePortfolioVacancyGoal = useCallback(async (value: number) => {
    // Self-healing: if the "Global" row doesn't exist yet in this environment (e.g. a
    // solution import brought the table schema over but not its seeded data), create it
    // instead of failing - otherwise every fresh environment needs manual row seeding
    // before this screen works at all.
    if (id) {
      const result = await Cr1e9_appsettingsesService.update(id, { cr1e9_portfoliovacancygoal: value } as any);
      if (result.error) throw new Error(result.error.message ?? 'Failed to update portfolio vacancy goal');
    } else {
      const result = await Cr1e9_appsettingsesService.create({ cr1e9_name: 'Global', cr1e9_portfoliovacancygoal: value } as any);
      if (result.error || !result.data) throw new Error(result.error?.message ?? 'Failed to create app settings row');
      setId(result.data.cr1e9_appsettingsid);
    }
    setPortfolioVacancyGoal(value);
  }, [id]);

  return { portfolioVacancyGoal, loading, error, updatePortfolioVacancyGoal };
}
