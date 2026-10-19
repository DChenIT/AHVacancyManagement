import type { IOperationResult } from '@microsoft/power-apps/data';
import type { IGetAllOptions } from '../generated/models/CommonModels';

// Dataverse returns one page (up to 5,000 rows) per request, and the generated services' getAll() hands back
// only that first page plus a skipToken for the next. The portfolio-wide views read every report and unit row,
// which passes 5,000 units within weeks once ~100 communities report weekly - after which the newest rows
// would silently be missing. This follows the skipToken until everything is loaded.
const MAX_PAGES = 200; // safety stop - 200 pages is a million rows, far past anything real

export async function getAllPages<T>(
  getPage: (options: IGetAllOptions) => Promise<IOperationResult<T[]>>,
  options: IGetAllOptions = {},
): Promise<IOperationResult<T[]>> {
  const rows: T[] = [];
  let skipToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await getPage(skipToken ? { ...options, skipToken } : options);
    if (result.error) return result;
    rows.push(...(result.data ?? []));
    skipToken = result.skipToken;
    if (!skipToken) return { ...result, data: rows };
  }
  throw new Error('Too many pages while loading - stopped to avoid a runaway query.');
}
