// Age verification for R rated films. Stored only in the visitor's
// browser (localStorage), matching the live site. No account, no server.
const KEY = "tohu-age-verified-v1";

export function isAgeVerified(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setAgeVerified(): void {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    // storage unavailable; the gate will show again next visit
  }
}

/** Age in years from an ISO birthdate string (yyyy-mm-dd). */
export function ageFromBirthdate(birthdate: string): number | null {
  const d = new Date(birthdate + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}
