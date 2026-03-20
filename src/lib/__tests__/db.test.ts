import { describe, it, expect } from 'vitest';

describe('IndexedDB CRUD', () => {
  it.todo('dbPut stores a record and dbGet retrieves it');
  it.todo('dbPut overwrites existing record with same key');
  it.todo('dbDelete removes a record');
  it.todo('dbGetAll returns all records from a store');
});

describe('runs store (STOR-01, GPS-04)', () => {
  it.todo('stores a completed run with full GPS trace');
  it.todo('stores an active run snapshot (crash recovery)');
  it.todo('snapshot overwrites previous snapshot for same run ID');
  it.todo('findIncompleteRun returns ActiveRunSnapshot without endTime');
  it.todo('findIncompleteRun returns null when no incomplete runs exist');
  it.todo('clearIncompleteRun removes the incomplete run record');
});

describe('routes store (STOR-02)', () => {
  it.todo('stores and retrieves a saved route');
  it.todo('deletes a saved route by ID');
});

describe('settings store (STOR-04)', () => {
  it.todo('stores and retrieves app settings');
  it.todo('merges with default settings when fields are missing');
});

describe('migration (STOR-01..04)', () => {
  it.todo('migrates settings from localStorage to IndexedDB');
  it.todo('migrates saved routes from localStorage to IndexedDB');
  it.todo('skips migration if already migrated');
  it.todo('handles corrupt localStorage data gracefully');
});

describe('storage persistence (STOR-03)', () => {
  it.todo('requests persistent storage via navigator.storage.persist()');
  it.todo('returns false when API is not available');
  it.todo('returns true when already persisted');
});
