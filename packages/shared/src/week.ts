// The envelope week: Monday 00:00 to Sunday 23:59, local time. Same rule as api/nessie/client.js weekStart().

/** "2026-09-28" for any moment in the week that began Monday Sept 28. Keys anything that resets with the envelope. */
export function weekKey(now: Date = new Date()): string {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
