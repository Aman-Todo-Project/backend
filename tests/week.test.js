const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  getWeekStartKey,
  getWeekRange,
  toDateKey,
  addDays,
  isValidDateKey,
  isValidTimeZone,
  startOfDayInZone,
  groupTasksByWeek,
} = require('../src/utils/week');

describe('week utilities', () => {
  test('Monday is the first day of its own week', () => {
    assert.equal(getWeekStartKey('2026-11-09'), '2026-11-09'); // Monday
  });

  test('Sunday belongs to the week that started the previous Monday', () => {
    assert.equal(getWeekStartKey('2026-11-15'), '2026-11-09'); // Sunday
  });

  test('week range spans Monday to Sunday', () => {
    assert.deepEqual(getWeekRange('2026-11-12'), { weekStart: '2026-11-09', weekEnd: '2026-11-15' });
  });

  test('week crossing a year boundary', () => {
    assert.deepEqual(getWeekRange('2027-01-01'), { weekStart: '2026-12-28', weekEnd: '2027-01-03' });
  });

  test('addDays handles month boundaries', () => {
    assert.equal(addDays('2026-02-28', 1), '2026-03-01');
    assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  });

  test('date key validation', () => {
    assert.equal(isValidDateKey('2026-11-12'), true);
    assert.equal(isValidDateKey('2026-02-30'), false);
    assert.equal(isValidDateKey('12/11/2026'), false);
  });

  test('timezone validation', () => {
    assert.equal(isValidTimeZone('Asia/Kolkata'), true);
    assert.equal(isValidTimeZone('Not/AZone'), false);
  });

  test('toDateKey uses the requested timezone', () => {
    // Sunday 20:00 UTC is already Monday 01:30 in India.
    const instant = new Date('2026-11-15T20:00:00Z');
    assert.equal(toDateKey(instant, 'UTC'), '2026-11-15');
    assert.equal(toDateKey(instant, 'Asia/Kolkata'), '2026-11-16');
  });

  test('startOfDayInZone returns local midnight as UTC instant', () => {
    assert.equal(startOfDayInZone('2026-11-09', 'Asia/Kolkata').toISOString(), '2026-11-08T18:30:00.000Z');
    assert.equal(startOfDayInZone('2026-11-09', 'America/New_York').toISOString(), '2026-11-09T05:00:00.000Z');
    // DST start day in New York (clocks jump at 02:00, midnight still EST)
    assert.equal(startOfDayInZone('2026-03-08', 'America/New_York').toISOString(), '2026-03-08T05:00:00.000Z');
  });
});

describe('groupTasksByWeek', () => {
  const tasks = [
    { id: 'a', scheduledAt: '2026-11-09T00:00:00Z', status: 'In Progress' }, // Mon
    { id: 'b', scheduledAt: '2026-11-15T23:59:00Z', status: 'Completed' }, // Sun
    { id: 'c', scheduledAt: '2026-11-16T00:00:00Z', status: 'In Progress' }, // next Mon
    { id: 'd', scheduledAt: '2026-11-11T10:00:00Z', status: 'In Progress' },
  ];

  test('groups Monday-Sunday boundaries correctly and counts statuses', () => {
    const weeks = groupTasksByWeek(tasks, 'UTC');
    assert.equal(weeks.length, 2);
    assert.deepEqual(
      weeks.map((w) => [w.weekStart, w.weekEnd, w.openTasks, w.completedTasks, w.totalTasks]),
      [
        ['2026-11-09', '2026-11-15', 2, 1, 3],
        ['2026-11-16', '2026-11-22', 1, 0, 1],
      ]
    );
    assert.deepEqual(weeks[0].tasks.map((t) => t.id), ['a', 'd', 'b']);
  });

  test('the same instants group differently in another timezone', () => {
    const weeks = groupTasksByWeek(tasks, 'Asia/Kolkata');
    // "b" (Sun 23:59 UTC) is Monday 05:29 IST -> moves into the next week.
    assert.deepEqual(weeks[1].tasks.map((t) => t.id).sort(), ['b', 'c']);
  });

  test('returns an empty list for no tasks', () => {
    assert.deepEqual(groupTasksByWeek([], 'UTC'), []);
  });
});
