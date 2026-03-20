import { describe, it, expect } from 'vitest';

describe('run history filtering (HIST-01)', () => {
  it.todo('filters out crash recovery snapshots (records without endTime)');
  it.todo('returns only CompletedRun records with endTime');
  it.todo('sorts runs by startTime descending (newest first)');
});

describe('run history stats (HIST-02)', () => {
  it.todo('computes average pace from distance and elapsed time');
  it.todo('formats elapsed time correctly');
  it.todo('formats distance in km');
});

describe('run deletion (HIST-04)', () => {
  it.todo('deletes a run by ID from IndexedDB');
});
