'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Tooltip } from '@chakra-ui/react';
import { FiFileText, FiMap, FiActivity, FiSettings } from 'react-icons/fi';

// hasPlaythroughs: true = enabled, false = Notes/Maps grayed out, undefined/null = still loading (show enabled)
export default function GameTabBar({ gameId, ptId, hasPlaythroughs = true }) {
  const router   = useRouter();
  const pathname = usePathname();

  const activeTab = pathname.endsWith('/playthrough') ? 'playthrough'
    : pathname.endsWith('/map')      ? 'map'
    : pathname.endsWith('/settings') ? 'settings'
    : 'notes';

  const tabs = [
    { key: 'playthrough', label: 'Playthrough', icon: FiActivity, href: `/game/${gameId}/${ptId}/playthrough`, disabled: false },
    { key: 'notes',       label: 'Notes',       icon: FiFileText, href: `/game/${gameId}/${ptId}/notes`,       disabled: !hasPlaythroughs },
    { key: 'map',         label: 'Maps',         icon: FiMap,      href: `/game/${gameId}/${ptId}/map`,         disabled: !hasPlaythroughs },
    { key: 'settings',    label: 'Settings',    icon: FiSettings, href: `/game/${gameId}/${ptId}/settings`,    disabled: !hasPlaythroughs },
  ];

  return (
    <div className="game-tab-bar">
      {tabs.map(tab => {
        const Icon = tab.icon;
        const btn = (
          <button
            key={tab.key}
            className={`game-tab-btn${activeTab === tab.key ? ' active' : ''}${tab.disabled ? ' disabled' : ''}`}
            onClick={() => !tab.disabled && router.push(tab.href)}
            disabled={tab.disabled}
          >
            <Icon size={13} />
            {tab.label}
          </button>
        );
        return tab.disabled ? (
          <Tooltip key={tab.key} label="Add a playthrough first" hasArrow placement="bottom" openDelay={200}>
            <span>{btn}</span>
          </Tooltip>
        ) : (
          <span key={tab.key}>{btn}</span>
        );
      })}
    </div>
  );
}
