export const IMPORT_SCOPES = {
  pipeline: {
    table: 'ideas',
    fileBase: 'pipeline-ideas-import-example',
  },
  audio: {
    table: 'tracks',
    fileBase: 'audio-tracks-import-example',
  },
  presets: {
    table: 'config_presets',
    fileBase: 'config-presets-import-example',
  },
};

const JSON_ROWS = {
  ideas: [
    {
      title: 'Một ý tưởng mới',
      concept: 'IT meme',
      priority: 2,
      status: 'Lên ý tưởng',
      publish_date: null,
      platforms: ['TikTok', 'Instagram Reels'],
      hook: '',
      main_content: '',
      hashtag: [],
    },
  ],
  tracks: [
    {
      title: 'Tên bài nhạc',
      artist_source: 'Instagram',
      mood_genre: 'Chill',
      status: 'Chưa dùng',
      audio_url: '',
      notes: '',
    },
  ],
  config_presets: [
    {
      group_name: 'Instagram Reels · Kích thước',
      attribute: 'Canvas',
      value: '1080 x 1920 px',
      notes: '',
      link_example: '',
    },
  ],
};

const CSV_SAMPLES = {
  ideas: 'title,status,concept,priority,publish_date,hook,main_content,platforms\nÝ tưởng mẫu,Lên ý tưởng,Vlog,2,2026-09-20,Hook mẫu,Nội dung mẫu,TikTok|Instagram Reels\n',
  tracks: 'title,artist_source,mood_genre,status,audio_url,notes\nTên bài nhạc,Instagram,Chill,Chưa dùng,https://example.com/audio,Ghi chú mẫu\n',
  config_presets: 'group_name,attribute,value,notes,link_example\nInstagram Reels · Kích thước,Canvas,1080 x 1920 px,Ghi chú mẫu,https://example.com/preset\n',
};

export function importScopeConfig(scope) {
  return IMPORT_SCOPES[scope] || IMPORT_SCOPES.pipeline;
}

export function importSample(scope, type = 'json') {
  const config = importScopeConfig(scope);
  return type === 'csv'
    ? CSV_SAMPLES[config.table]
    : JSON.stringify({ [config.table]: JSON_ROWS[config.table] }, null, 2);
}

export function importSampleFilename(scope, type = 'json') {
  return `${importScopeConfig(scope).fileBase}.${type === 'csv' ? 'csv' : 'json'}`;
}
