import BattleForm from '../components/battle-form/BattleForm';
import { openOverlay } from '../utils/openOverlay';

export default function RecordPage() {
  return (
    <div>
      <div className="flex justify-end px-4 pt-4">
        <button
          onClick={openOverlay}
          className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          オーバーレイを開く
        </button>
      </div>
      <BattleForm />
    </div>
  );
}
