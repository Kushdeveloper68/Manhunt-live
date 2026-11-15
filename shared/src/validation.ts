/**
 * Small validation helpers shared by the app and covered by server tests.
 */

/** Age in whole years for a YYYY-MM-DD date of birth, or null if the date is not real / not plausible. */
export function ageFromDob(dob: string, now: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  // reject 2002-02-31 style dates that JS silently rolls over
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  let age = now.getUTCFullYear() - y;
  const hadBirthday =
    now.getUTCMonth() > mo - 1 || (now.getUTCMonth() === mo - 1 && now.getUTCDate() >= d);
  if (!hadBirthday) age -= 1;
  return age >= 0 && age <= 110 ? age : null;
}

/** A phone number someone could actually dial: 7-15 digits, optional + and separators. */
export function isPlausiblePhone(phone: string): boolean {
  const trimmed = phone.trim();
  if (!/^\+?[0-9\s().-]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}
