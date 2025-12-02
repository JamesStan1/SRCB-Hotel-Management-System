// Lightweight date validators used across API routes
export function isValidDateString(dateString) {
  const d = new Date(dateString);
  return !isNaN(d.getTime());
}

// Returns true if the given date string represents a calendar day strictly before today
export function isPastDate(dateString) {
  if (!isValidDateString(dateString)) return false;
  const d = new Date(dateString);
  // Normalize to local calendar day (zero time)
  const eventDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return eventDay < today;
}

// Throws an Error if the dateString is a past date (useful for asserting)
export function assertNotPastDate(dateString) {
  if (isPastDate(dateString)) throw new Error('date cannot be in the past');
}

export default {
  isValidDateString,
  isPastDate,
  assertNotPastDate,
};
