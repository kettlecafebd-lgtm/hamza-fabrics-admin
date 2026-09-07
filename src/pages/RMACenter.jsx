import React, { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import TabShell from '../components/ui/TabShell';

const Returns = React.lazy(() => import('./ReturnsManagement'));
const Resolutions = React.lazy(() => import('./ResolutionCenter'));

/**
 * RMACenter — Consolidated Returns & Resolutions
 * Tabs: Returns | Resolutions
 */
export default function RMACenter() {
  const { isAdminDark } = useContext(ThemeContext);

  const tabs = [
    { id: 'returns', label: 'Returns & Refunds', icon: '↩️', component: Returns },
    { id: 'resolutions', label: 'Resolution Center', icon: '🔧', component: Resolutions },
  ];

  return <TabShell tabs={tabs} isDark={isAdminDark} title="RMA Center" />;
}
