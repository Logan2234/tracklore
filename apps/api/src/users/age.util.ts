const ADULT_AGE = 18;

/** True when birthDate implies the user has turned 18. Unknown (null) is never adult. */
export function isAdult(birthDate: Date | null, now = new Date()): boolean {
  if (!birthDate) return false;

  let age = now.getFullYear() - birthDate.getFullYear();
  const hadBirthdayThisYear =
    now.getMonth() > birthDate.getMonth() ||
    (now.getMonth() === birthDate.getMonth() &&
      now.getDate() >= birthDate.getDate());
  if (!hadBirthdayThisYear) age -= 1;

  return age >= ADULT_AGE;
}

/** Strips 18+ items from a list unless the caller is allowed to see them. */
export function filterAdultContent<T extends { isAdult: boolean }>(
  items: T[],
  allowed: boolean,
): T[] {
  return allowed ? items : items.filter((item) => !item.isAdult);
}
