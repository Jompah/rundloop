import type { SavedRoute } from './storage';

const DB_NAME = 'drift';
const DB_VERSION = 3;

let dbInstance: IDBDatabase | null = null;

/**
 * Singleton IndexedDB connection. Opens the database and creates
 * object stores on first call; returns cached connection thereafter.
 */
export function getDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available on the server'));
  }

  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('runs')) {
        const runStore = db.createObjectStore('runs', { keyPath: 'id' });
        runStore.createIndex('startTime', 'startTime', { unique: false });
      }

      if (!db.objectStoreNames.contains('routes')) {
        db.createObjectStore('routes', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains('generation_logs')) {
        const logStore = db.createObjectStore('generation_logs', { keyPath: 'id' });
        logStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (oldVersion < 3) {
        const analysisStore = db.createObjectStore('run_analysis', { keyPath: 'id' });
        analysisStore.createIndex('by_routeId', 'routeId', { unique: false });
        analysisStore.createIndex('by_runId', 'runId', { unique: false });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
      };
      resolve(dbInstance);
    };

    request.onerror = () => reject(request.error);

    request.onblocked = () => {
      console.warn('IndexedDB upgrade blocked by another tab');
    };
  });
}

/**
 * Retrieve a single record by key.
 */
export async function dbGet<T>(storeName: string, key: string | number): Promise<T | undefined> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Upsert a record into the given object store.
 */
export async function dbPut<T>(storeName: string, value: T): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(value);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Delete a record by key.
 */
export async function dbDelete(storeName: string, key: string | number): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieve all records from an object store.
 */
export async function dbGetAll<T>(storeName: string): Promise<T[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieve all records from an object store via an index cursor.
 * Default direction is 'prev' (newest first).
 */
export async function dbGetAllByIndex<T>(
  storeName: string,
  indexName: string,
  direction: IDBCursorDirection = 'prev'
): Promise<T[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const results: T[] = [];
    const cursor = index.openCursor(null, direction);

    cursor.onsuccess = () => {
      const result = cursor.result;
      if (!result) {
        resolve(results);
        return;
      }
      results.push(result.value as T);
      result.continue();
    };

    cursor.onerror = () => reject(cursor.error);
  });
}

/**
 * One-time migration from localStorage to IndexedDB.
 * Reads existing settings and routes, writes them to IndexedDB,
 * then marks migration complete and removes old localStorage keys.
 */
export async function migrateFromLocalStorage(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem('rundloop_migrated_to_idb')) return;

  // Migrate settings
  const settingsRaw = localStorage.getItem('rundloop_settings');
  if (settingsRaw) {
    try {
      const settings = JSON.parse(settingsRaw);
      await dbPut('settings', { key: 'app', ...settings });
    } catch {
      /* ignore corrupt data */
    }
  }

  // Migrate saved routes
  const routesRaw = localStorage.getItem('rundloop_history');
  if (routesRaw) {
    try {
      const routes: SavedRoute[] = JSON.parse(routesRaw);
      for (const route of routes) {
        await dbPut('routes', route);
      }
    } catch {
      /* ignore corrupt data */
    }
  }

  // Mark migration complete and clean up
  localStorage.setItem('rundloop_migrated_to_idb', 'true');
  localStorage.removeItem('rundloop_settings');
  localStorage.removeItem('rundloop_history');
}

/**
 * Request persistent storage to prevent iOS eviction.
 * Returns true if storage is or was made persistent, false otherwise.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!navigator.storage?.persist) return false;

  try {
    const persisted = await navigator.storage.persisted();
    if (persisted) return true;

    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/**
 * Single entry point to initialize the database layer.
 * Opens the connection, runs migration, and requests persistence.
 */
export async function initDB(): Promise<void> {
  await getDB();
  await migrateFromLocalStorage();
  await requestPersistentStorage();
}
