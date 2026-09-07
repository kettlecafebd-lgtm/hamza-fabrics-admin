import React, { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import TabShell from '../components/ui/TabShell';

const ProfitSales = React.lazy(() => import('./ProfitAndSales'));
const Expenses = React.lazy(() => import('./ExpenseTracker'));
const Audit = React.lazy(() => import('./FinancialAudit'));

/**
 * FinancialDashboard — Consolidated Financial Pages
 * Tabs: P&L | Expenses | Audit
 */
export default function FinancialDashboard() {
  const { isAdminDark } = useContext(ThemeContext);

  const tabs = [
    { id: 'pl', label: 'P&L Analytics', icon: '💰', component: ProfitSales },
    { id: 'expenses', label: 'Expense Tracker', icon: '💸', component: Expenses },
    { id: 'audit', label: 'Financial Audit', icon: '📑', component: Audit },
  ];

  return <TabShell tabs={tabs} isDark={isAdminDark} title="Financial Dashboard" />;
}
