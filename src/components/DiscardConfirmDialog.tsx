'use client';

import { motion } from 'motion/react';
import { Button } from '@/components/ui/Button';

interface DiscardConfirmDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DiscardConfirmDialog({ onConfirm, onCancel }: DiscardConfirmDialogProps) {
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
        <h2 className="text-white text-xl font-bold">Discard Run?</h2>
        <p className="text-gray-400 mt-2">This run will be permanently deleted.</p>
        <div className="flex gap-3 mt-6">
          <Button variant="secondary" fullWidth onClick={onCancel}>Keep It</Button>
          <Button variant="destructive" fullWidth onClick={onConfirm}>Discard</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
