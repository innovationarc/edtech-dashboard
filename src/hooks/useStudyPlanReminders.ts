// src/hooks/useStudyPlanReminders.ts
// Polls study plan events and fires Dynamic Island reminders

import { useEffect, useRef } from 'react';
import { showDynamicIsland } from '../components/ui/DynamicIsland';

interface StudyEvent {
  id: string;
  title: string;
  subject?: string;
  time: Date; // when to remind
  reminderMinsBefore?: number; // default 5
}

// Demo events — replace with real Firestore fetch in production
const getDemoEvents = (): StudyEvent[] => {
  const now = new Date();
  return [
    {
      id: 'ev1',
      title: 'Physics: Quantum Mechanics',
      subject: 'Chapter 4 revision',
      time: new Date(now.getTime() + 1 * 60 * 1000),  // 1 min from now
      reminderMinsBefore: 0,
    },
    {
      id: 'ev2',
      title: 'Math: Calculus Practice',
      subject: '20 problems due',
      time: new Date(now.getTime() + 3 * 60 * 1000),
      reminderMinsBefore: 0,
    },
    {
      id: 'ev3',
      title: 'English Essay Deadline',
      subject: 'Submit by end of day',
      time: new Date(now.getTime() + 6 * 60 * 1000),
      reminderMinsBefore: 0,
    },
  ];
};

export const useStudyPlanReminders = (enabled = true) => {
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;

    const events = getDemoEvents();

    const check = () => {
      const now = Date.now();
      events.forEach(ev => {
        if (firedRef.current.has(ev.id)) return;
        const reminderAt = ev.time.getTime() - (ev.reminderMinsBefore ?? 5) * 60 * 1000;
        if (now >= reminderAt) {
          firedRef.current.add(ev.id);
          showDynamicIsland({
            type: 'study',
            title: ev.title,
            message: ev.subject,
            duration: 6000,
          });
        }
      });
    };

    const interval = setInterval(check, 15000); // check every 15s
    check(); // immediate first check

    return () => clearInterval(interval);
  }, [enabled]);
};
