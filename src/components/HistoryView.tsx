'use client';

import { useState, useEffect } from 'react';
import { SavedRoute, getSavedRoutes, deleteRoute } from '@/lib/storage';
import { GeneratedRoute } from '@/types';

interface HistoryViewProps {
  onClose: () => void;
  onLoadRoute: (route: GeneratedRoute) => void;
}

export default function HistoryView({ onClose, onLoadRoute }: HistoryViewProps) {
  const [routes, setRoutes] = useState<SavedRoute[]>([]);

  useEffect(() => {
    setRoutes(getSavedRoutes());
  }, []);

  const handleDelete = (id: string) => {
    deleteRoute(id);
    setRoutes(routes.filter(r => r.id !== id));
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="absolute inset-0 bg-gray-950 z-30 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <h1 className="text-xl font-bold text-white">Route History</h1>
        <button
          onClick={onClose}
          className="text-gray-400 p-2 active:text-white"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4">
        {routes.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <svg className="mx-auto mb-4" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <p>No routes yet</p>
            <p className="text-sm mt-1">Generated routes will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {routes.map((saved) => (
              <div
                key={saved.id}
                className="bg-gray-900 rounded-xl p-4 border border-gray-800"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-white">
                        {(saved.route.distance / 1000).toFixed(1)} km
                      </span>
                      <span className="text-gray-500">-</span>
                      <span className="text-gray-400">{saved.city}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatDate(saved.createdAt)} - ~{Math.round(saved.route.duration / 60)} min
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(saved.id)}
                    className="text-gray-600 p-1 active:text-red-400"
                    aria-label="Delete route"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    </svg>
                  </button>
                </div>
                <button
                  onClick={() => {
                    onLoadRoute(saved.route);
                    onClose();
                  }}
                  className="mt-3 w-full py-2 bg-gray-800 text-green-400 rounded-lg text-sm font-medium active:bg-gray-700"
                >
                  Load Route
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
