'use client';

import { useRouter, usePathname } from 'next/navigation';
import { FiFileText, FiMap, FiActivity } from 'react-icons/fi';

export default function GameTabBar({ gameId, ptId }) {
  const router   = useRouter();
  const pathname = usePathname();

  const activeTab = pathname.endsWith('/playthrough') ? 'playthrough'
    : pathname.endsWith('/map')   ? 'map'
    : 'notes';

  const tabs = [
    { key: 'playthrough', label: 'Playthrough', icon: FiActivity, href: `/game/${gameId}/${ptId}/playthrough` },
    { key: 'notes',       label: 'Notes',       icon: FiFileText, href: `/game/${gameId}/${ptId}/notes`       },
    { key: 'map',         label: 'Maps',         icon: FiMap,      href: `/game/${gameId}/${ptId}/map`         },
  ];

  return (
    <div className="game-tab-bar">
      {tabs.map(tab => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            className={`game-tab-btn${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => router.push(tab.href)}
          >
            <Icon size={13} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
