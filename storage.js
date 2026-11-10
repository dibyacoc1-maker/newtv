const STORAGE_KEY = 'configurable-web-tv.v1';
const CHANNEL_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

function freshState() {
  return {
    favorites: [], history: [], lastChannel: '', servers: {},
    searches: [], theme: '', volume: null
  };
}

function validChannelId(value) {
  return typeof value === 'string' && CHANNEL_ID.test(value);
}

function normalize(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return freshState();
  const safeStrings = (list, limit) => Array.isArray(list)
    ? [...new Set(list.filter(validChannelId))].slice(0, limit) : [];
  const history = Array.isArray(raw.history) ? raw.history
    .filter(item => item && validChannelId(item.channelId))
    .slice(0, 100)
    .map(item => ({
      channelId: item.channelId,
      watchedAt: Number.isFinite(item.watchedAt) ? item.watchedAt : Date.now(),
      position: clamp(item.position, 0, 86400)
    })) : [];
  const servers = {};
  if (raw.servers && typeof raw.servers === 'object' && !Array.isArray(raw.servers)) {
    for (const [channelId, serverName] of Object.entries(raw.servers)) {
      if (validChannelId(channelId) && typeof serverName === 'string' && serverName.length <= 120) {
        servers[channelId] = serverName;
      }
    }
  }
  const searches = Array.isArray(raw.searches)
    ? raw.searches.filter(value => typeof value === 'string').map(value => value.slice(0, 80)).slice(0, 12)
    : [];
  return {
    favorites: safeStrings(raw.favorites, 250), history,
    lastChannel: validChannelId(raw.lastChannel) ? raw.lastChannel : '',
    servers, searches,
    theme: ['dark', 'light', 'system'].includes(raw.theme) ? raw.theme : '',
    volume: Number.isFinite(raw.volume) ? clamp(raw.volume, 0, 1) : null
  };
}

function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalize(JSON.parse(raw)) : freshState();
  } catch (error) {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* storage may be disabled */ }
    console.warn('Saved preferences were reset because they could not be read.', error);
    return freshState();
  }
}

let state = readState();
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; }
  catch (error) { console.warn('Preferences could not be saved.', error); return false; }
}

export const storage = {
  get favorites() { return [...state.favorites]; },
  get history() { return state.history.map(item => ({ ...item })); },
  get lastChannel() { return state.lastChannel; },
  get theme() { return state.theme; },
  get volume() { return state.volume ?? 0.8; },
  get hasVolumePreference() { return Number.isFinite(state.volume); },
  isFavorite(id) { return state.favorites.includes(id); },
  toggleFavorite(id) {
    if (!validChannelId(id)) return false;
    state.favorites = state.favorites.includes(id)
      ? state.favorites.filter(item => item !== id) : [id, ...state.favorites];
    save(); return state.favorites.includes(id);
  },
  rememberChannel(id, position = 0) {
    if (!validChannelId(id)) return;
    state.lastChannel = id;
    state.history = [{ channelId: id, watchedAt: Date.now(), position: clamp(position, 0, 86400) },
      ...state.history.filter(item => item.channelId !== id)].slice(0, 100);
    save();
  },
  rememberPosition(id, position) {
    if (!validChannelId(id) || !Number.isFinite(position)) return;
    const existing = state.history.find(item => item.channelId === id);
    if (existing) existing.position = clamp(position, 0, 86400);
    save();
  },
  getServer(id) { return state.servers[id] || ''; },
  setServer(id, name) {
    if (!validChannelId(id) || typeof name !== 'string' || name.length > 120) return;
    state.servers[id] = name; save();
  },
  rememberSearch(query) {
    const value = String(query || '').trim().slice(0, 80);
    if (!value) return;
    state.searches = [value, ...state.searches.filter(item => item !== value)].slice(0, 12); save();
  },
  setTheme(theme) { if (['dark', 'light', 'system'].includes(theme)) { state.theme = theme; save(); } },
  setVolume(value) { state.volume = clamp(value, 0, 1); save(); },
  clearHistory() { state.history = []; save(); },
  exportSafeData() { return JSON.stringify({ ...state, servers: { ...state.servers } }, null, 2); }
};
