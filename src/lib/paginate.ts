// A page of a list already in memory (?page=N). Out-of-range pages fall back to the nearest one.
// PaginationControls renders nothing while everything fits in one page.
export function paginate<T>(items: T[], pageParam: string | undefined, pageSize: number) {
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(Math.max(1, Number(pageParam) || 1), pages);
  return { items: items.slice((page - 1) * pageSize, page * pageSize), page, total: items.length, pageSize };
}
