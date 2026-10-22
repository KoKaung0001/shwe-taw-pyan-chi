import {
  LayoutDashboard,
  ArrowLeftRight,
  ScanLine,
  Users,
  CalendarDays,
  MessageCircle,
  ClipboardCheck,
  Settings,
} from 'lucide-react';
export const screens = [
  { id: 'dashboard', path: '/dashboard', icon: LayoutDashboard },
  { id: 'transactions', path: '/transactions', icon: ArrowLeftRight },
  { id: 'add', path: '/add', icon: ScanLine },
  { id: 'chat', path: '/chat', icon: MessageCircle },
  { id: 'readiness', path: '/readiness', icon: ClipboardCheck },
  { id: 'capture', path: '/capture', icon: ScanLine },
  { id: 'owed', path: '/owed', icon: Users },
  { id: 'schedules', path: '/schedules', icon: CalendarDays },
  { id: 'settings', path: '/settings', icon: Settings },
] as const;
export type ScreenId = (typeof screens)[number]['id'];

export const primaryDestinations = [
  { id: 'dashboard', path: '/dashboard', icon: LayoutDashboard },
  { id: 'transactions', path: '/transactions', icon: ArrowLeftRight },
  { id: 'add', path: '/add', icon: ScanLine },
  { id: 'chat', path: '/chat', icon: MessageCircle },
  { id: 'readiness', path: '/readiness', icon: ClipboardCheck },
] as const;

export const utilityDestinations = [
  { id: 'settings', path: '/settings', icon: Settings },
] as const;
