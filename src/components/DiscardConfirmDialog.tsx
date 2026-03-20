'use client';

interface DiscardConfirmDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DiscardConfirmDialog({ onConfirm, onCancel }: DiscardConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 rounded-2xl p-6 mx-4 max-w-sm w-full">
        <h2 className="text-white text-xl font-bold">Discard Run?</h2>
        <p className="text-gray-400 mt-2">This run will be permanently deleted.</p>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl font-semibold bg-gray-800 text-white active:bg-gray-700"
          >
            Keep It
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-xl font-semibold bg-red-500 text-white active:bg-red-600"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}
