import React, { Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * TabShell — Reusable lazy-loaded tab container
 *
 * The open tab lives in the address (?tab=ai), so a link, a reload and the
 * command menu can open a page on the right tab. An unknown or missing ?tab
 * opens the first tab.
 *
 * Props:
 *   tabs       — [{ id, label, icon?, component: React.lazy(() => import(...)) }]
 *   isDark     — boolean for dark mode
 *   title      — page title
 */
export default function TabShell({ tabs = [], isDark = false, title = '' }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const wanted = searchParams.get('tab');
  const activeTab = tabs.some((t) => t.id === wanted) ? wanted : tabs[0]?.id || '';
  // `replace` keeps the Back button as it was: it leaves the page, it does not walk back through tabs.
  const setActiveTab = (id) => setSearchParams((params) => { params.set('tab', id); return params; }, { replace: true });

  const bgBase = isDark ? 'bg-gray-950' : 'bg-gray-50';
  const bgSurface = isDark ? 'bg-gray-900/60' : 'bg-white/70';
  const bgCard = isDark ? 'bg-gray-800/60' : 'bg-white/80';
  const textMain = isDark ? 'text-white' : 'text-gray-900';
  const textMuted = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderMain = isDark ? 'border-white/10' : 'border-gray-200/60';

  const activeTabData = tabs.find((t) => t.id === activeTab);

  return (
    <div className={`min-h-screen ${bgBase}`}>
      {/* Header */}
      {title && (
        <div className={`px-6 py-4 border-b ${borderMain} ${bgSurface} backdrop-blur-xl`}>
          <h1 className={`text-xl font-extrabold tracking-tight ${textMain}`}>{title}</h1>
        </div>
      )}

      {/* Tab Bar */}
      <div className={`sticky top-0 z-20 px-6 border-b ${borderMain} ${bgSurface} backdrop-blur-xl`}>
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all duration-200 whitespace-nowrap
                ${activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : `border-transparent ${textMuted} hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300`
                }
              `}
            >
              {tab.icon && <span className="text-base">{tab.icon}</span>}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTabData && (
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-20">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            }
          >
            <activeTabData.component />
          </Suspense>
        )}
      </div>
    </div>
  );
}
