'use client';

import { motion } from 'motion/react';

interface EndRunDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export default function EndRunDialog({ onConfirm, onCancel }: EndRunDialogProps) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        className="bg-gray-900 rounded-2xl p-6 mx-4 max-w-sm w-full"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        <h2 className="text-white text-xl font-bold">End Run?</h2>
        <p className="text-gray-400 mt-2">Your run will be saved to history.</p>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl font-semibold bg-gray-800 text-white active:bg-gray-700"
          >
            Keep Going
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-xl font-semibold bg-red-500 text-white active:bg-red-600"
          >
            End Run
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
