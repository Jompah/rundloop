import { describe, it, expect } from 'vitest';

describe('saveRoute (ROUT-01)', () => {
  it.todo('saves a route with auto-generated name when no name provided');
  it.todo('saves a route with user-provided custom name');
  it.todo('returns SavedRoute with id, name, route, city, createdAt');
  it.todo('auto-generated name contains distance and date');
});

describe('getSavedRoutes (ROUT-02)', () => {
  it.todo('returns empty array when no routes saved');
  it.todo('returns all saved routes');
});

describe('deleteRoute (ROUT-04)', () => {
  it.todo('removes route from storage');
  it.todo('does not throw when deleting non-existent route');
});
