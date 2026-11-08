// Puzzle diario determinista: misma (idioma, día) => mismo puzzle en cualquier navegador. Spec §4.
export const LAUNCH_DATE = [2026, 10, 9]; // año, mes 0-11, día: fecha del primer deploy público
export const RING = 10;
export const COLS = 5;
export const ROWS = 3;

// Días desde el lanzamiento según la fecha local. Date.UTC evita los días de 23/25 h por cambio de horario.
export function dayNumber(date = new Date()) {
  const local = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.max(0, (local - Date.UTC(...LAUNCH_DATE)) / 86400000);
}
