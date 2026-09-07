import React, { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import TabShell from '../components/ui/TabShell';

const Overview = React.lazy(() => import('./Dashboard'));
const LiveTraffic = React.lazy(() => import('./admin/LiveDashboard'));
const AIBrain = React.lazy(() => import('./BrainDashboard'));
const Districts = React.lazy(() => import('../components/command-center/DistrictsTab'));

/**
 * DashboardHub — Consolidated Command Center
 * Tabs: Overview | Live Traffic | AI Brain | Districts
 */
export default function DashboardHub() {
  const { isAdminDark } = useContext(ThemeContext);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊', component: Overview },
    { id: 'live', label: 'Live Traffic', icon: '⚡', component: LiveTraffic },
    { id: 'ai', label: 'AI Brain', icon: '🧠', component: AIBrain },
    { id: 'districts', label: 'Districts', icon: '🗺️', component: Districts },
  ];

  return <TabShell tabs={tabs} isDark={isAdminDark} title="Command Center" />;
}
