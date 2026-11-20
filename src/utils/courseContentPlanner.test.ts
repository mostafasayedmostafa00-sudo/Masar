import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../data/seed';
import {
  allocateCourseContentForDate,
  buildCourseFromParsedOutline,
  getCourseContentProgress,
  parseCourseOutlineContent,
} from './courseContentPlanner';
import { calculatePacing, generateDayTasks } from './planner';

const RHSA_OUTLINE = `
Section A.1: Red Hat System Administration I
Section A.2: Orientation to the Classroom Environment
Section A.3: Performing Lab Exercises

Chapter 1: Introduction to Red Hat Enterprise Linux
Section 1.1: Getting Started with Red Hat Enterprise Linux
Section 1.2: Quiz: Getting Started with Red Hat Enterprise Linux
Section 1.3: Summary

Chapter 2: Accessing the Command Line
Section 2.1: Accessing the Command Line in a Text Interface
Section 2.2: Quiz: Accessing the Command Line in a Text Interface
Section 2.3: Accessing the Command Line with the Desktop Environment
Section 2.4: Guided Exercise: Access the Command Line with the Desktop Environment
Section 2.5: Executing Commands with the Bash Shell
Section 2.6: Quiz: Executing Commands with the Bash Shell
Section 2.7: Lab: Access the Command Line
Section 2.8: Summary

Chapter 20: Comprehensive Review
Section 20.1: Summary of Learning Objectives
Section 20.2: Lab: Manage Files from the Command Line
Section 20.7: Summary
`;

test('parseCourseOutlineContent preserves hierarchy and classifies quizzes, guided exercises, labs, and summaries', () => {
  const parsed = parseCourseOutlineContent(RHSA_OUTLINE);

  assert.equal(parsed.courseTitle, 'Red Hat System Administration I');
  assert.equal(parsed.chapters.length, 4); // Section A, Chapter 1, Chapter 2, Chapter 20
  assert.equal(parsed.totalSections, 17);

  const ch2 = parsed.chapters[2];
  assert.equal(ch2.title, 'Chapter 2: Accessing the Command Line');
  assert.equal(ch2.items.length, 8);
  assert.equal(ch2.items[0].sectionType, 'section');
  assert.equal(ch2.items[1].sectionType, 'quiz');
  assert.equal(ch2.items[3].sectionType, 'guided_exercise');
  assert.equal(ch2.items[6].sectionType, 'lab');
  assert.equal(ch2.items[7].sectionType, 'summary');

  assert.ok(parsed.countsByType.quiz >= 3);
  assert.equal(parsed.countsByType.guided_exercise, 1);
  assert.equal(parsed.countsByType.lab, 3);
  assert.ok(parsed.countsByType.summary >= 3);
});

test('allocateCourseContentForDate distributes content across study days and integrates with generateDayTasks', () => {
  const state = createInitialState('2026-11-21'); // Saturday (study day)
  const parsed = parseCourseOutlineContent(RHSA_OUTLINE);
  const course = buildCourseFromParsedOutline({
    id: 'extra-rhsa',
    queue: 'extra',
    order: 1,
    parsed,
    startDate: '2026-11-21',
    deadline: '2026-12-10',
    dailyStudyHours: 1.5,
    makeCurrent: true,
  });

  state.courses = state.courses.map((c) => (c.queue === 'extra' ? { ...c, status: 'upcoming' } : c));
  state.courses.push(course);

  const todayAlloc = allocateCourseContentForDate(state, course, '2026-11-21');
  const tomorrowAlloc = allocateCourseContentForDate(state, course, '2026-11-22');
  const travelDayAlloc = allocateCourseContentForDate(state, course, '2026-11-25'); // Wednesday = travel_off

  assert.equal(todayAlloc.isStudyDay, true);
  assert.ok(todayAlloc.pendingItems.length >= 3, 'Should assign multiple sections for ~1.5h');
  assert.equal(todayAlloc.pendingItems[0].itemTitle, 'Section A.1: Red Hat System Administration I');

  assert.equal(tomorrowAlloc.isStudyDay, true);
  assert.ok(tomorrowAlloc.pendingItems.length >= 1, 'Tomorrow should schedule subsequent sections');
  assert.notEqual(
    tomorrowAlloc.pendingItems[0].itemId,
    todayAlloc.pendingItems[0].itemId,
    'Tomorrow must start after Today sections'
  );

  assert.equal(travelDayAlloc.isStudyDay, false);
  assert.equal(travelDayAlloc.pendingItems.length, 0, 'Travel/Off day must have no regular sections');

  const { tasks } = generateDayTasks(state, '2026-11-21');
  const extraTask = tasks.find((t) => t.courseId === 'extra-rhsa');
  assert.ok(extraTask, 'Existing generateDayTasks should emit a task for the content-planned course');
  assert.ok(extraTask.plannedItems && extraTask.plannedItems.length === todayAlloc.pendingItems.length);
});

test('Dynamic replanning shifts tomorrow forward when ahead and redistributes when behind or travel_off', () => {
  const state = createInitialState('2026-11-21');
  const parsed = parseCourseOutlineContent(RHSA_OUTLINE);
  const course = buildCourseFromParsedOutline({
    id: 'extra-rhsa',
    queue: 'extra',
    order: 1,
    parsed,
    startDate: '2026-11-21',
    deadline: '2026-12-10',
    dailyStudyHours: 1.5,
    makeCurrent: true,
  });
  state.courses = state.courses.map((c) => (c.queue === 'extra' ? { ...c, status: 'upcoming' } : c));
  state.courses.push(course);

  const baselineTomorrow = allocateCourseContentForDate(state, course, '2026-11-22');
  const baselineTomorrowFirstId = baselineTomorrow.pendingItems[0].itemId;

  // 1. User completes MORE than today's planned slice (completes first 7 items today)
  let marked = 0;
  for (const tp of course.topics) {
    for (const it of tp.items) {
      if (marked < 7) {
        it.completed = true;
        it.completedAt = '2026-11-21';
        marked++;
      }
    }
  }
  const aheadTomorrow = allocateCourseContentForDate(state, course, '2026-11-22');
  assert.notEqual(
    aheadTomorrow.pendingItems[0].itemId,
    baselineTomorrowFirstId,
    'Tomorrow must shift forward after completing ahead'
  );
  assert.equal(aheadTomorrow.pendingItems[0].itemTitle, 'Section 2.2: Quiz: Accessing the Command Line in a Text Interface');

  // 2. Switching Sunday 2026-11-22 to travel_off shifts Sunday content to Monday 2026-11-23
  state.dateOverrides['2026-11-22'] = 'travel_off';
  const overriddenSun = allocateCourseContentForDate(state, course, '2026-11-22');
  const shiftedMon = allocateCourseContentForDate(state, course, '2026-11-23');
  assert.equal(overriddenSun.pendingItems.length, 0);
  assert.equal(
    shiftedMon.pendingItems[0].itemTitle,
    'Section 2.2: Quiz: Accessing the Command Line in a Text Interface',
    'Skipped travel_off day should push next section into Monday study day'
  );

  // 3. Tight deadline marks behind when remaining effort exceeds available study-day budget
  course.deadline = '2026-11-21';
  const tightProg = getCourseContentProgress(course, state, '2026-11-21');
  const pacing = calculatePacing(state, 'extra', '2026-11-21');
  assert.equal(tightProg.remainingSections, 10);
  assert.equal(tightProg.status, 'behind');
  assert.equal(pacing.status, 'behind');
  assert.equal(pacing.topicsRemaining, 10);
});

test('100% completion state sets isCompleted without auto-selecting next course', () => {
  const state = createInitialState('2026-11-21');
  const parsed = parseCourseOutlineContent(`
Course: Cisco CyberOps Associate
Chapter 1: Security Concepts
Section 1.1: CIA Triad
Section 1.2: Quiz: CIA Triad
`);
  const course = buildCourseFromParsedOutline({
    id: 'extra-cyberops',
    queue: 'extra',
    order: 1,
    parsed,
    startDate: '2026-11-21',
    deadline: '2026-11-25',
    dailyStudyHours: 1,
    makeCurrent: true,
  });

  for (const tp of course.topics) {
    for (const it of tp.items) {
      it.completed = true;
      it.completedAt = '2026-11-21';
    }
    tp.studied = true;
  }

  const prog = getCourseContentProgress(course, state, '2026-11-21');
  assert.equal(prog.isCompleted, true);
  assert.equal(prog.percent, 100);
  assert.equal(prog.remainingSections, 0);
});

test('parseCourseOutlineContent handles Markdown headings, checkbox bullets, and Week headers', () => {
  const mdOutline = `
# Course: Distributed Systems Fundamentals
## Week 1: Consensus & Replication
- [ ] Section 1.1: Raft Basics
- [ ] Quiz: Raft Leader Election
## Chapter II: Fault Tolerance
* Exercise: Simulate Node Failure
* Lab: Partition Simulation
* Review: Key Takeaways
`;
  const parsed = parseCourseOutlineContent(mdOutline);
  assert.equal(parsed.courseTitle, 'Distributed Systems Fundamentals');
  assert.equal(parsed.chapters.length, 2);
  assert.equal(parsed.chapters[0].title, 'Week 1: Consensus & Replication');
  assert.equal(parsed.chapters[0].items[0].title, 'Section 1.1: Raft Basics');
  assert.equal(parsed.chapters[0].items[1].sectionType, 'quiz');
  assert.equal(parsed.chapters[1].title, 'Chapter II: Fault Tolerance');
  assert.equal(parsed.chapters[1].items[0].sectionType, 'guided_exercise');
  assert.equal(parsed.chapters[1].items[1].sectionType, 'lab');
  assert.equal(parsed.chapters[1].items[2].sectionType, 'review');
});
