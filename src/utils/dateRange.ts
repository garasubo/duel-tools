export function isWithinDateRange(
  createdAt: string,
  dateFrom: string,
  dateTo: string,
): boolean {
  if (!dateFrom && !dateTo) return true;

  const createdMs = new Date(createdAt).getTime();
  if (isNaN(createdMs)) return false;

  if (dateFrom) {
    const fromMs = new Date(`${dateFrom}T00:00:00`).getTime();
    if (createdMs < fromMs) return false;
  }

  if (dateTo) {
    const toMs = new Date(`${dateTo}T23:59:59.999`).getTime();
    if (createdMs > toMs) return false;
  }

  return true;
}
