import site from '../../content/site.json';
export { site };

/** Чи заповнене значення (не порожнє і без позначки ЗАПОВНИТИ). */
export function isFilled(value: string | undefined | null): value is string {
  return !!value && !value.includes('ЗАПОВНИТИ');
}
