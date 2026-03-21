'use client';

import { useState, useEffect } from 'react';
import { GeneratedRoute } from '@/types';
import { getSavedRoutes, deleteRoute, type SavedRoute } from '@/lib/storage';
import { dbPut } from '@/lib/db';
import { RouteThumbnail } from './RouteThumbnail';
import DeleteRouteDialog from './DeleteRouteDialog';
import { Button } from '@/components/ui/Button';

interface SavedRoutesViewProps {
  onRunRoute: (route: GeneratedRoute) => void;
}

function displayName(route: SavedRoute): string {
  return (
    route.name ||
    `${(route.route.distance / 1000).toFixed(1)} km route - ${new Date(route.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}`
  );
}

export function SavedRoutesView({ onRunRoute }: SavedRoutesViewProps) {
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SavedRoute | null>(null);

  useEffect(() => {
    getSavedRoutes().then((saved) => {
      saved.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRoutes(saved);
      setLoading(false);
    });
  }, []);

  async function handleSaveRename(route: SavedRoute) {
    const finalName =
      editName.trim() ||
      `${(route.route.distance / 1000).toFixed(1)} km route - ${new Date(route.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}`;
    const updated = { ...route, name: finalName };
    await dbPut('routes', updated);
    setRoutes((prev) => prev.map((r) => (r.id === route.id ? updated : r)));
    setEditingId(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteRoute(deleteTarget.id);
    setRoutes((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-gray-400">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom) + 1rem)' }}>
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold text-white">Routes</h1>
      </div>

      {routes.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1">
          <svg
            className="text-gray-600"
            width={48}
            height={48}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 17l4-4 4 4 4-8 6 6" />
            <circle cx="3" cy="17" r="1" />
            <circle cx="21" cy="15" r="1" />
          </svg>
          <p className="text-lg font-semibold text-gray-400 mt-4">No saved routes</p>
          <p className="text-sm text-gray-500 mt-2 text-center max-w-xs">
            Generate a route and tap Save to add it here
          </p>
        </div>
      ) : (
        <div>
          {routes.map((route) => (
            <div
              key={route.id}
              className="mx-4 mb-3 bg-gray-800 rounded-2xl p-4 flex items-center gap-4"
            >
              <RouteThumbnail
                points={route.route.polyline.map(([lng, lat]) => ({ lat, lng }))}
                size={80}
              />
              <div className="flex-1 min-w-0">
                {editingId === route.id ? (
                  <input
                    className="bg-gray-700 text-white rounded-lg px-2 py-1 text-base w-full outline-none focus:ring-1 focus:ring-green-400"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                    onBlur={() => handleSaveRename(route)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRename(route);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                ) : (
                  <span
                    className="text-base font-semibold text-white cursor-pointer block truncate"
                    onClick={() => {
                      setEditingId(route.id);
                      setEditName(displayName(route));
                    }}
                  >
                    {displayName(route)}
                  </span>
                )}
                <span className="text-sm text-gray-400">
                  {(route.route.distance / 1000).toFixed(1)} km
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  className="mt-1 px-0 bg-transparent text-red-400 active:bg-transparent"
                  onClick={() => setDeleteTarget(route)}
                >
                  Delete
                </Button>
              </div>
              <Button
                variant="primary"
                size="sm"
                className="shrink-0"
                onClick={() => onRunRoute(route.route)}
              >
                Run
              </Button>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <DeleteRouteDialog
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
