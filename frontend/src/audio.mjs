const moodKey = (value) => String(value ?? '').trim().toLocaleLowerCase();

export function sameMood(left, right) {
  return Boolean(moodKey(left)) && moodKey(left) === moodKey(right);
}

// Track data is persisted and scoped by workspace by the API. Also guard
// against stale rows while the user is switching workspaces.
export function workspaceMoods(tracks, workspaceId) {
  const names = new Map();
  for (const track of tracks) {
    if (track.workspace_id !== workspaceId) continue;
    const name = String(track.mood_genre ?? '').trim();
    if (name && !names.has(moodKey(name))) names.set(moodKey(name), name);
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b, 'vi'));
}
