import test from 'node:test';
import assert from 'node:assert/strict';
import { importSample, importSampleFilename } from '../frontend/src/importSamples.mjs';

test('pipeline import samples only include ideas', () => {
  const parsed = JSON.parse(importSample('pipeline'));
  assert.deepEqual(Object.keys(parsed), ['ideas']);
  assert.match(importSample('pipeline', 'csv').split('\n')[0], /^title,status,concept,priority,publish_date,hook,main_content,platforms$/);
  assert.equal(importSampleFilename('pipeline'), 'pipeline-ideas-import-example.json');
});

test('audio import samples only include tracks', () => {
  const parsed = JSON.parse(importSample('audio'));
  assert.deepEqual(Object.keys(parsed), ['tracks']);
  assert.match(importSample('audio', 'csv').split('\n')[0], /^title,artist_source,mood_genre,status,audio_url,notes$/);
  assert.equal(importSampleFilename('audio', 'csv'), 'audio-tracks-import-example.csv');
});

test('preset import samples only include config presets', () => {
  const parsed = JSON.parse(importSample('presets'));
  assert.deepEqual(Object.keys(parsed), ['config_presets']);
  assert.match(importSample('presets', 'csv').split('\n')[0], /^group_name,attribute,value,notes,link_example$/);
  assert.equal(importSampleFilename('presets', 'csv'), 'config-presets-import-example.csv');
});
