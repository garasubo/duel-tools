import BattleForm from '../components/battle-form/BattleForm';

function openOverlay() {
  const url = `${window.location.origin}${window.location.pathname}?overlay`;
  window.open(url, 'overlay', 'width=520,height=130,resizable=yes');
}

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
