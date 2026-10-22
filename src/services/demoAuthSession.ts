import { useSyncExternalStore } from 'react';
import type { DemoUser } from './demoAuth';

let currentUser: DemoUser | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach((listener) => listener());
}

export function setDemoSession(user: DemoUser | null) {
  currentUser = user;
  notify();
}

export function getDemoSession() {
  return currentUser;
}

export function useDemoSession() {
  return useSyncExternalStore(subscribe, getDemoSession, () => null);
}
