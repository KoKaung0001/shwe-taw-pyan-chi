import {
  LayoutDashboard,
  ArrowLeftRight,
  ScanLine,
  Users,
  CalendarDays,
  ChartNoAxesCombined,
  MessageCircle,
  ClipboardCheck,
  Settings,
} from 'lucide-react';
export const screens = [
  { id: 'dashboard', path: '/dashboard', icon: LayoutDashboard },
  { id: 'transactions', path: '/transactions', icon: ArrowLeftRight },
  { id: 'capture', path: '/capture', icon: ScanLine },
  { id: 'owed', path: '/owed', icon: Users },
  { id: 'schedules', path: '/schedules', icon: CalendarDays },
  { id: 'insights', path: '/insights', icon: ChartNoAxesCombined },
  { id: 'chat', path: '/chat', icon: MessageCircle },
  { id: 'readiness', path: '/readiness', icon: ClipboardCheck },
  { id: 'settings', path: '/settings', icon: Settings },
] as const;
export type ScreenId = (typeof screens)[number]['id'];

export const primaryNavigation = [
  { id: 'dashboard', path: '/dashboard', icon: LayoutDashboard, label: 'dashboard' },
  {
    id: 'transactions',
    path: '/transactions',
    icon: ArrowLeftRight,
    label: 'transactions',
  },
  { id: 'readiness', path: '/readiness', icon: ClipboardCheck, label: 'readiness' },
  { id: 'chat', path: '/chat', icon: MessageCircle, label: 'chat' },
  { id: 'settings', path: '/settings', icon: Settings, label: 'settings' },
] as const;
