import React, { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import TabShell from '../components/ui/TabShell';

const AIAds = React.lazy(() => import('./AIMarketing'));
const CartRecovery = React.lazy(() => import('./CartRecoveryDashboard'));
const AutoCall = React.lazy(() => import('./AutoCallCenterReport'));

/**
 * MarketingAutomation — Consolidated Marketing Pages
 * Tabs: AI Ads | Cart Recovery | Auto-Call
 */
export default function MarketingAutomation() {
  const { isAdminDark } = useContext(ThemeContext);

  const tabs = [
    { id: 'ai-ads', label: 'AI Ads', icon: '📣', component: AIAds },
    { id: 'cart', label: 'Cart Recovery', icon: '🛒', component: CartRecovery },
    { id: 'autocall', label: 'Auto-Call', icon: '📞', component: AutoCall },
  ];

  return <TabShell tabs={tabs} isDark={isAdminDark} title="Marketing Automation" />;
}
