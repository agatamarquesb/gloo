/**
 * The projects a task can be filed under.
 *
 * Written down here rather than fetched, because there is nothing to fetch yet:
 * projects have no table, no endpoint, and no column on a task. Two places show
 * them — the task modal's "Projeto" row and the Tasks page's filter panel — and
 * they have to agree, which is the whole reason this is a module and not two
 * arrays.
 *
 * The moment a projects endpoint exists this file is what goes, and both callers
 * become queries.
 */
export const SAMPLE_PROJECTS = ['Lançamento', 'ID Juliana', 'Ferramenta ABC'] as const;
