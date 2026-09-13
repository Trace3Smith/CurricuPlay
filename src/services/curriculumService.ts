import data from '../data/curriculum.json';
import type { CurriculumEntry, ContentRange, Grade } from '../types';
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function recentStart(asOf: string) {
  const date = new Date(`${asOf}T12:00:00`);
  date.setDate(date.getDate() - (date.getDay() + 6) % 7 - 7);
  return localDate(date);
}
export function inRange(week: string, range: ContentRange, asOf: string): boolean {
  const cutoff = asOf < localDate() ? asOf : localDate();
  return validDate(week) && week <= cutoff && (range === 'all' || week >= recentStart(cutoff));
}
export function getCurriculum(grade: Grade, range: ContentRange, asOf: string) {
  return (data as CurriculumEntry[]).filter(row => row.grade === grade && row.weekOf !== null && inRange(row.weekOf, range, asOf));
}
