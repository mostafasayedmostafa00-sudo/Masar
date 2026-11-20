import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../data/seed';
import {
  calculatePacing,
  computeSleepSchedule,
  generateDayTasks,
  getDayMode,
  getWeekDates,
  replanAfterSkip,
} from './planner';

test('Sleep Guard computes bedtime, screens-off, meal, coffee, and sunlight accurately', () => {
  const sleep = computeSleepSchedule({
    wakeTime: '06:30',
    targetSleepHours: 7,
    eveningStartTime: '17:30',
    ntiDaytimeStart: '09:00',
    ntiDaytimeEnd: '16:30',
  });

  assert.equal(sleep.bedtime, '23:30');
  assert.equal(sleep.screensOff, '22:30');
  assert.equal(sleep.lastMeal, '20:30');
  assert.equal(sleep.lastCoffee, '13:30');
  assert.equal(sleep.morningSunlight, '06:45');
});

test('Weekly routine follows Sat-Fri and respects Friday 2026-11-20 Study-Light override', () => {
  const state = createInitialState('2026-11-20');
  assert.equal(getDayMode(state, '2026-11-20'), 'study_light');
  assert.equal(getDayMode(state, '2026-11-21'), 'study'); // Saturday
  assert.equal(getDayMode(state, '2026-11-25'), 'travel_off'); // Wednesday
  assert.equal(getDayMode(state, '2026-11-26'), 'catch_up'); // Thursday
  assert.equal(getDayMode(state, '2026-11-27'), 'travel_off'); // Regular Friday

  const week = getWeekDates('2026-11-20');
  assert.equal(week.length, 7);
  assert.equal(week[0], '2026-11-14'); // Saturday
  assert.equal(week[6], '2026-11-20'); // Friday
});

test('Hard Planner Rule trims lower-priority queues instead of breaching screens-off', () => {
  const state = createInitialState('2026-11-21'); // Saturday study day
  // Narrow window: evening starts 20:30, screens-off 22:30 (only 120m available)
  state.sleepSettings.eveningStartTime = '20:30';
  const { tasks, overflowQueues } = generateDayTasks(state, '2026-11-21');
  const screenTasks = tasks.filter((t) => t.isScreenBased);
  const totalScreenMins = screenTasks.reduce((acc, t) => acc + t.estimatedMinutes, 0);

  assert.ok(totalScreenMins <= 120, `Expected <= 120m screen study, got ${totalScreenMins}`);
  assert.ok(overflowQueues.length >= 1, 'Lower-priority queues should overflow rather than sacrifice sleep');
  assert.equal(screenTasks[0].category, 'nti', 'Highest priority queue (NTI) must be kept first');
});

test('Skipping a study task triggers automatic replanning into next study/catch-up slot', () => {
  const state = createInitialState('2026-11-21');
  const generated = generateDayTasks(state, '2026-11-21');
  state.tasksByDate['2026-11-21'] = generated.tasks;

  const ntiTask = generated.tasks.find((t) => t.category === 'nti');
  assert.ok(ntiTask, 'NTI task should exist on Saturday');

  const updated = replanAfterSkip(state, '2026-11-21', ntiTask.id);
  const satTask = updated.tasksByDate['2026-11-21'].find((t) => t.id === ntiTask.id);
  assert.equal(satTask?.status, 'skipped');

  const thuTasks = updated.tasksByDate['2026-11-26'] || [];
  const recovered = thuTasks.some((t) => t.topicId === ntiTask.topicId && t.isCatchUp);
  assert.equal(recovered, true, 'Skipped task should appear as recovered on Thursday catch-up day');
});

test('Pacing excludes travel_off days and computes remaining topics accurately', () => {
  const state = createInitialState('2026-11-21');
  const pacing = calculatePacing(state, 'nti', '2026-11-21');
  assert.equal(pacing.topicsRemaining, 4);
  assert.ok(pacing.availableStudyDays > 0);
  assert.ok(pacing.estimatedCompletionDate !== null);
});
