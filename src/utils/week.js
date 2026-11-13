// Weeks run Monday to Sunday in the user's timezone.
// Dates are passed around as 'YYYY-MM-DD' strings so the server's own timezone never matters.

const DATE_KEY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const formatters = new Map();

function getFormatter(timeZone) {
  if (!formatters.has(timeZone)) {
    formatters.set(
      timeZone,
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );
  }
  return formatters.get(timeZone);
}

function isValidTimeZone(timeZone) {
  if (!timeZone || typeof timeZone !== 'string') return false;
  try {
    getFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

function getZonedParts(date, timeZone) {
  const parts = {};
  for (const { type, value } of getFormatter(timeZone).formatToParts(date)) {
    if (type !== 'literal') parts[type] = Number(value);
  }
  return parts;
}

const pad = (n) => String(n).padStart(2, '0');

function toDateKey(date, timeZone) {
  const { year, month, day } = getZonedParts(date, timeZone);
  return `${year}-${pad(month)}-${pad(day)}`;
}

function parseDateKey(key) {
  const match = DATE_KEY_REGEX.exec(key || '');
  if (!match) return null;

  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  // rejects dates like 2026-02-30 that JS would silently roll over
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

function isValidDateKey(key) {
  return parseDateKey(key) !== null;
}

function addDays(key, days) {
  const { year, month, day } = parseDateKey(key);
  const date = new Date(Date.UTC(year, month - 1, day) + days * ONE_DAY_MS);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function getWeekStartKey(key) {
  const { year, month, day } = parseDateKey(key);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 = Sunday
  return addDays(key, -((dayOfWeek + 6) % 7));
}

function getWeekRange(key) {
  const weekStart = getWeekStartKey(key);
  return { weekStart, weekEnd: addDays(weekStart, 6) };
}

function getOffsetMs(date, timeZone) {
  const p = getZonedParts(date, timeZone);
  const localAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return localAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

// UTC time at which the given local day starts in timeZone
function startOfDayInZone(key, timeZone) {
  const { year, month, day } = parseDateKey(key);
  const utcMidnight = Date.UTC(year, month - 1, day);
  const firstGuess = utcMidnight - getOffsetMs(new Date(utcMidnight), timeZone);
  // check the offset again at the guessed time in case of a DST change
  return new Date(utcMidnight - getOffsetMs(new Date(firstGuess), timeZone));
}

function groupTasksByWeek(tasks, timeZone) {
  const weeks = new Map();

  for (const task of tasks) {
    const { weekStart, weekEnd } = getWeekRange(toDateKey(new Date(task.scheduledAt), timeZone));
    if (!weeks.has(weekStart)) {
      weeks.set(weekStart, { weekStart, weekEnd, openTasks: 0, completedTasks: 0, totalTasks: 0, tasks: [] });
    }

    const week = weeks.get(weekStart);
    week.tasks.push(task);
    week.totalTasks++;
    if (task.status === 'Completed') week.completedTasks++;
    else week.openTasks++;
  }

  const result = [...weeks.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  for (const week of result) {
    week.tasks.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  }
  return result;
}

module.exports = {
  isValidTimeZone,
  isValidDateKey,
  toDateKey,
  addDays,
  getWeekStartKey,
  getWeekRange,
  startOfDayInZone,
  groupTasksByWeek,
};
