import React, { useState, useCallback } from 'react';

export function useConfirm() {
  const [state, setState] = useState({ open: false, message: '', resolve: null });

  const confirm = useCallback((message) => {
    return new Promise((resolve) => {
      setState({ open: true, message, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state.resolve(true);
    setState({ open: false, message: '', resolve: null });
  }, [state]);

  const handleCancel = useCallback(() => {
    state.resolve(false);
    setState({ open: false, message: '', resolve: null });
  }, [state]);

  const ConfirmDialog = state.open ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Confirmation">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
        <p className="text-white font-bold text-lg mb-6">{state.message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={handleCancel} className="px-5 py-2.5 rounded-xl bg-gray-700 text-gray-300 font-bold hover:bg-gray-600 transition-colors">
            Cancel
          </button>
          <button onClick={handleConfirm} className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-500 transition-colors">
            Confirm
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, ConfirmDialog };
}
