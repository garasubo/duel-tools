import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BattlesProvider } from '../../state/BattlesProvider';
import type { BattleRecord } from '../../types';
import RecordDetail from './RecordDetail';
import RecordTable from './RecordTable';

const record: BattleRecord = {
  id: 'record-1',
  createdAt: '2026-08-16T12:00:00.000Z',
  ownDeckId: 'own-deck',
  opponentDeckId: 'opponent-deck',
  result: 'win',
  turnOrder: 'first',
  reasonTags: ['展開成功'],
  memo: 'テストメモ',
  battleMode: 'rated',
  score: 1500,
};

describe('履歴の編集導線', () => {
  it('編集ボタンを右端の固定列に表示する', () => {
    const html = renderToStaticMarkup(
      <BattlesProvider>
        <RecordTable records={[record]} onDetailClick={() => undefined} />
      </BattlesProvider>,
    );

    expect(html).toContain('aria-label="編集"');
    expect(html).toContain('aria-label="戦績を編集"');
    expect(html.match(/sticky right-0/g)).toHaveLength(2);
  });

  it('初期編集モードでは詳細表示を挟まず編集フォームを表示する', () => {
    const html = renderToStaticMarkup(
      <BattlesProvider>
        <RecordDetail
          record={record}
          isOpen
          onClose={() => undefined}
          initialEditing
        />
      </BattlesProvider>,
    );

    expect(html).toContain('戦績を編集');
    expect(html).toContain('>保存</button>');
    expect(html).not.toContain('戦績詳細');
  });

  it('読み取り専用テーブルには編集列を表示しない', () => {
    const html = renderToStaticMarkup(
      <BattlesProvider>
        <RecordTable
          records={[record]}
          onDetailClick={() => undefined}
          readOnly
        />
      </BattlesProvider>,
    );

    expect(html).not.toContain('aria-label="編集"');
    expect(html).not.toContain('aria-label="戦績を編集"');
  });
});
