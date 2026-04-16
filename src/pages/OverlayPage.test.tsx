import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import OverlayPage from './OverlayPage';
import { BattlesContext, type BattlesContextValue } from '../context/BattlesContext';

function createContextValue(
  overrides: Partial<BattlesContextValue> = {},
): BattlesContextValue {
  return {
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
    overlayStatSettings: [
      { id: 'overall', visible: true },
      { id: 'asFirst', visible: true },
      { id: 'asSecond', visible: true },
      { id: 'coinToss', visible: true },
      { id: 'matchCount', visible: true },
    ],
    addRecord: () => undefined,
    importRecords: () => ({ importedCount: 0 }),
    updateRecord: () => undefined,
    deleteRecord: () => undefined,
    deleteRecords: () => undefined,
    addOwnDeck: (name: string) => ({ id: name, name }),
    updateOwnDeck: () => undefined,
    deleteOwnDeck: () => undefined,
    addOpponentDeck: (name: string) => ({ id: name, name }),
    updateOpponentDeck: () => undefined,
    deleteOpponentDeck: () => undefined,
    addKnownTag: () => undefined,
    updateKnownTag: () => undefined,
    deleteKnownTag: () => undefined,
    isOwnDeckUsed: () => false,
    isOpponentDeckUsed: () => false,
    isTagUsed: () => false,
    setOverlayStatSettings: () => undefined,
    ...overrides,
  };
}

describe('OverlayPage', () => {
  it('選択された統計のみを設定順で表示する', () => {
    const html = renderToStaticMarkup(
      <BattlesContext.Provider
        value={createContextValue({
          overlayStatSettings: [
            { id: 'matchCount', visible: true },
            { id: 'coinToss', visible: true },
            { id: 'overall', visible: true },
            { id: 'asFirst', visible: false },
            { id: 'asSecond', visible: true },
          ],
        })}
      >
        <OverlayPage />
      </BattlesContext.Provider>,
    );

    expect(html.indexOf('試合数')).toBeLessThan(html.indexOf('コイン'));
    expect(html.indexOf('コイン')).toBeLessThan(html.indexOf('全体'));
    expect(html.indexOf('全体')).toBeLessThan(html.indexOf('後攻'));
    expect(html).not.toContain('先攻');
    expect(html).toContain('2');
  });

  it('非表示の試合数は表示しない', () => {
    const html = renderToStaticMarkup(
      <BattlesContext.Provider
        value={createContextValue({
          overlayStatSettings: [
            { id: 'overall', visible: true },
            { id: 'asFirst', visible: true },
            { id: 'asSecond', visible: true },
            { id: 'coinToss', visible: true },
            { id: 'matchCount', visible: false },
          ],
        })}
      >
        <OverlayPage />
      </BattlesContext.Provider>,
    );

    expect(html).not.toContain('試合数');
  });
});
