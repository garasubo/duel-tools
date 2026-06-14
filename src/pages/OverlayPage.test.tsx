import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import OverlayPage from './OverlayPage';
import { BattlesStoreContext } from '../state/BattlesProvider';
import type { BattlesStore } from '../state/store';
import type { AppStorage, OverlayStatSetting } from '../types';
import { createDefaultStorage } from '../utils/storage';

function makeState(
  overrides: Partial<AppStorage> = {},
): AppStorage {
  return {
    ...createDefaultStorage(),
    records: [
      {
        id: 'record-1',
        createdAt: '2026-04-01T00:00:00.000Z',
        ownDeckId: 'own-1',
        opponentDeckId: 'opp-1',
        result: 'win',
        turnOrder: 'first',
        reasonTags: [],
        memo: '',
      },
      {
        id: 'record-2',
        createdAt: '2026-04-02T00:00:00.000Z',
        ownDeckId: 'own-1',
        opponentDeckId: 'opp-1',
        result: 'loss',
        turnOrder: 'second',
        reasonTags: [],
        memo: '',
      },
    ],
    ownDecks: [{ id: 'own-1', name: 'Blue Eyes' }],
    opponentDecks: [{ id: 'opp-1', name: 'DM' }],
    knownTags: [],
    ...overrides,
  };
}

function makeStore(state: AppStorage): BattlesStore {
  const noop = () => undefined;
  return {
    getState: () => state,
    subscribe: () => () => undefined,
    addRecord: noop,
    updateRecord: noop,
    deleteRecord: noop,
    deleteRecords: noop,
    importRecords: () => ({ importedCount: 0 }),
    addOwnDeck: (name: string) => ({ id: name, name }),
    updateOwnDeck: noop,
    deleteOwnDeck: noop,
    addOpponentDeck: (name: string) => ({ id: name, name }),
    updateOpponentDeck: noop,
    deleteOpponentDeck: noop,
    addTag: noop,
    renameTag: noop,
    deleteTag: noop,
    setOverlayStats: noop,
    setPanelDateFilter: noop,
    getDraftBattle: () => ({ turnOrder: null, result: null }),
    setDraftBattle: noop,
  };
}

function withStore(state: AppStorage, children: ReactNode): ReactNode {
  return (
    <BattlesStoreContext.Provider value={makeStore(state)}>
      {children}
    </BattlesStoreContext.Provider>
  );
}

describe('OverlayPage', () => {
  it('選択された統計のみを設定順で表示する', () => {
    const overlayStats: OverlayStatSetting[] = [
      { id: 'matchCount', visible: true },
      { id: 'coinToss', visible: true },
      { id: 'overall', visible: true },
      { id: 'asFirst', visible: false },
      { id: 'asSecond', visible: true },
    ];
    const html = renderToStaticMarkup(
      withStore(makeState({ overlayStats }), <OverlayPage />),
    );

    expect(html.indexOf('試合数')).toBeLessThan(html.indexOf('コイン'));
    expect(html.indexOf('コイン')).toBeLessThan(html.indexOf('全体'));
    expect(html.indexOf('全体')).toBeLessThan(html.indexOf('後攻'));
    expect(html).not.toContain('先攻');
    expect(html).toContain('2');
  });

  it('非表示の試合数は表示しない', () => {
    const overlayStats: OverlayStatSetting[] = [
      { id: 'overall', visible: true },
      { id: 'asFirst', visible: true },
      { id: 'asSecond', visible: true },
      { id: 'coinToss', visible: true },
      { id: 'matchCount', visible: false },
    ];
    const html = renderToStaticMarkup(
      withStore(makeState({ overlayStats }), <OverlayPage />),
    );

    expect(html).not.toContain('試合数');
  });
});
