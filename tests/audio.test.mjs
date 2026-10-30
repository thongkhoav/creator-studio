import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceMoods, sameMood } from '../frontend/src/audio.mjs';

test('mood options belong to the selected workspace and include saved custom moods', () => {
  const tracks = [
    { workspace_id: 'a', mood_genre: ' Hài hước ' },
    { workspace_id: 'a', mood_genre: 'hài HƯỚC' },
    { workspace_id: 'a', mood_genre: 'Chill' },
    { workspace_id: 'b', mood_genre: 'Epic' },
    { workspace_id: 'a', mood_genre: '  ' },
    { workspace_id: 'a', mood_genre: null },
  ];
  assert.deepEqual(workspaceMoods(tracks, 'a'), ['Chill', 'Hài hước']);
  assert.deepEqual(workspaceMoods(tracks, 'b'), ['Epic']);
  assert.deepEqual(workspaceMoods(tracks, 'c'), []);
  assert.deepEqual(workspaceMoods([], 'a'), []);
});

test('mood filtering matches legacy spacing and capitalization', () => {
  assert.equal(sameMood(' Hài hước ', 'hài HƯỚC'), true);
  assert.equal(sameMood('Chill', 'Epic'), false);
  assert.equal(sameMood(null, 'Chill'), false);
});
