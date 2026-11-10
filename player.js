const YOUTUBE_API_URL = 'https://www.youtube.com/iframe_api';
let youtubeApiPromise;

function youtubeId(input) {
  try {
    const url = new URL(input);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || '';
    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      if (url.pathname === '/watch') return url.searchParams.get('v') || '';
      const match = url.pathname.match(/^\/(?:live|embed|shorts)\/([^/?]+)/);
      return match ? match[1] : '';
    }
  } catch (_) { return ''; }
  return '';
}

function normalizeHex(value) {
  return String(value || '').replace(/^0x/i, '').replace(/[^a-f0-9]/gi, '').toLowerCase();
}

function loadYouTubeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const timeout = setTimeout(() => reject(new Error('The YouTube player API did not respond.')), 15000);
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout);
      if (typeof previous === 'function') previous();
      resolve(window.YT);
    };
    let script = document.querySelector('script[data-youtube-api]');
    if (!script) {
      script = document.createElement('script');
      script.src = YOUTUBE_API_URL;
      script.async = true;
      script.dataset.youtubeApi = 'true';
      script.onerror = () => { clearTimeout(timeout); reject(new Error('Could not load the YouTube player API.')); };
      document.head.append(script);
    }
  }).catch(error => { youtubeApiPromise = null; throw error; });
  return youtubeApiPromise;
}

export class StreamPlayer {
  constructor(elements, options = {}, callbacks = {}) {
    this.el = elements;
    this.options = options;
    this.callbacks = callbacks;
    this.channel = null;
    this.servers = [];
    this.failed = new Set();
    this.currentIndex = -1;
    this.engine = null;
    this.youtube = null;
    this.watchdog = 0;
    this.hideTimer = 0;
    this.listeners = [];
    this.streamListeners = [];
    this.destroyed = false;
    this.installControls();
  }

  listen(target, event, handler, opts) {
    target.addEventListener(event, handler, opts);
    this.listeners.push(() => target.removeEventListener(event, handler, opts));
  }

  listenStream(target, event, handler, opts) {
    target.addEventListener(event, handler, opts);
    this.streamListeners.push(() => target.removeEventListener(event, handler, opts));
  }

  installControls() {
    const { video, dialog, controls, play, mute, volume, fullscreen, pip, previous, next, close, retry, serverSelect } = this.el;
    this.listen(play, 'click', () => this.togglePlay());
    this.listen(mute, 'click', () => this.toggleMute());
    this.listen(volume, 'input', () => { video.volume = Number(volume.value); video.muted = false; this.syncControls(); });
    this.listen(fullscreen, 'click', () => this.toggleFullscreen());
    this.listen(pip, 'click', () => this.togglePiP());
    this.listen(previous, 'click', () => this.callbacks.onPrevious?.());
    this.listen(next, 'click', () => this.callbacks.onNext?.());
    this.listen(close, 'click', () => this.close());
    this.listen(retry, 'click', () => this.retry());
    this.listen(serverSelect, 'change', () => {
      const index = Number(serverSelect.value);
      if (Number.isInteger(index) && index >= 0) this.selectServer(index);
    });
    this.listen(dialog, 'click', event => { if (event.target === dialog) this.close(); });
    this.listen(dialog, 'pointermove', () => this.revealControls());
    this.listen(dialog, 'touchstart', () => this.revealControls(), { passive: true });
    this.listen(dialog, 'keydown', () => this.revealControls());
    if (!('pictureInPictureEnabled' in document)) pip.disabled = true;
    volume.value = String(this.options.defaultVolume ?? 0.8);
    video.volume = Number(volume.value);
    controls?.classList.remove('is-hidden');
  }

  bindStreamListeners() {
    const { video } = this.el;
    this.listenStream(video, 'play', () => this.syncControls());
    this.listenStream(video, 'pause', () => this.syncControls());
    this.listenStream(video, 'volumechange', () => this.syncControls());
    this.listenStream(video, 'playing', () => this.markSuccess());
    this.listenStream(video, 'canplay', () => this.markSuccess());
    this.listenStream(video, 'error', () => {
      if (!this.youtube && !this.engine?.__shaka && this.currentIndex >= 0) this.failCurrent('media', 'The media could not be decoded or played.');
    });
    this.listenStream(video, 'timeupdate', () => this.callbacks.onPosition?.(video.currentTime));
    this.listenStream(video, 'ended', () => this.callbacks.onEnded?.());
  }

  async play(channel, servers, preferredName = '') {
    clearTimeout(this.hideTimer);
    this.cleanupEngine();
    this.channel = channel;
    this.servers = [...servers].filter(server => server.status === 'active' && server.url)
      .sort((a, b) => Number(a.priority || 999) - Number(b.priority || 999));
    this.failed.clear();
    if (preferredName) {
      const preferred = this.servers.findIndex(server => server.name === preferredName);
      if (preferred > 0) this.servers.unshift(this.servers.splice(preferred, 1)[0]);
    }
    this.open();
    this.renderServerOptions();
    if (!this.servers.length) { this.showError('No active stream server is configured for this channel.'); return; }
    await this.startServer(0);
  }

  open() {
    this.el.title.textContent = this.channel?.name || 'Live TV';
    this.el.dialog.showModal?.();
    if (!this.el.dialog.open) this.el.dialog.setAttribute('open', '');
    this.el.dialog.setAttribute('aria-label', `Player: ${this.channel?.name || 'Live TV'}`);
    this.el.error.hidden = true;
    this.el.stage.classList.remove('is-loading');
    this.revealControls();
  }

  async selectServer(index) {
    if (!this.servers[index]) return;
    this.failed.delete(index);
    await this.startServer(index, true);
  }

  async retry() {
    this.failed.clear();
    const target = this.currentIndex >= 0 ? this.currentIndex : 0;
    await this.startServer(target, true);
  }

  async startServer(index, manual = false) {
    if (index < 0 || index >= this.servers.length) return this.allFailed();
    if (this.failed.has(index) && !manual) return this.tryNext(index + 1);
    this.currentIndex = index;
    const server = this.servers[index];
    this.cleanupEngine();
    this.bindStreamListeners();
    this.renderServerOptions();
    this.el.error.hidden = true;
    this.setStatus(`Connecting to ${server.name || `Server ${index + 1}`}…`);
    this.el.stage.classList.add('is-loading');
    this.el.video.hidden = false;
    this.el.youtube.hidden = true;
    const type = String(server.type || '').toLowerCase();
    try {
      if (type === 'youtube') await this.startYouTube(server);
      else if (['dash', 'mpd'].includes(type)) await this.startDash(server);
      else if (type === 'm3u8') await this.startHls(server);
      else throw Object.assign(new Error(`Unsupported stream type: ${type || 'missing'}`), { kind: 'configuration' });
      this.startWatchdog();
    } catch (error) {
      this.failCurrent(error.kind || 'configuration', error.message || 'Could not start this stream.');
    }
  }

  async startHls(server) {
    const video = this.el.video;
    if (window.Hls?.isSupported()) {
      const hls = new window.Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 30 });
      this.engine = hls;
      hls.on(window.Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        const kind = data.type === window.Hls.ErrorTypes.NETWORK_ERROR ? 'network'
          : data.type === window.Hls.ErrorTypes.MEDIA_ERROR ? 'media' : 'manifest';
        if (kind === 'media' && !this.mediaRecovered) {
          this.mediaRecovered = true;
          try { hls.recoverMediaError(); return; } catch (_) { /* use next eligible server */ }
        }
        this.failCurrent(kind, data.details || `Fatal HLS ${kind} error.`);
      });
      hls.on(window.Hls.Events.MANIFEST_PARSED, () => { this.setStatus('Stream ready'); if (this.options.autoPlay !== false) video.play().catch(() => this.setStatus('Press Play to start the stream')); else this.setStatus('Press Play to start the stream'); });
      hls.loadSource(server.url);
      hls.attachMedia(video);
      return;
    }
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = server.url;
      if (this.options.autoPlay !== false) { try { await video.play(); } catch (_) { this.setStatus('Press Play to start the stream'); } } else this.setStatus('Press Play to start the stream');
      return;
    }
    throw Object.assign(new Error('This browser does not support HLS playback.'), { kind: 'unsupported' });
  }

  async startDash(server) {
    if (!window.shaka?.Player) throw Object.assign(new Error('The local Shaka Player library did not load.'), { kind: 'unsupported' });
    window.shaka.polyfill.installAll();
    if (!window.shaka.Player.isBrowserSupported()) throw Object.assign(new Error('This browser does not support MPEG-DASH playback.'), { kind: 'unsupported' });
    const player = new window.shaka.Player();
    player.__shaka = true;
    this.engine = player;
    await player.attach(this.el.video);
    player.configure({ streaming: { bufferingGoal: 20, rebufferingGoal: 2, bufferBehind: 30 } });
    const drm = server.drm;
    if (drm && drm.type === 'clearkey') {
      const kid = normalizeHex(drm.kid);
      const key = normalizeHex(drm.key);
      if (!/^[a-f0-9]{32}$/.test(kid) || !/^[a-f0-9]{32}$/.test(key)) {
        throw Object.assign(new Error('ClearKey needs a valid 32-character hexadecimal KID and key.'), { kind: 'drm' });
      }
      player.configure({ drm: { clearKeys: { [kid]: key } } });
    } else if (drm && drm.type === 'widevine') {
      if (drm.authorized !== true || !/^https:\/\//i.test(drm.licenseUrl || '')) {
        throw Object.assign(new Error('Widevine requires an authorized HTTPS license URL in this server configuration.'), { kind: 'authorization' });
      }
      player.configure({ drm: { servers: { 'com.widevine.alpha': drm.licenseUrl } } });
      if (drm.headers && typeof drm.headers === 'object') {
        player.configure({ drm: { advanced: { 'com.widevine.alpha': { headers: drm.headers } } } });
      }
    }
    player.addEventListener('error', event => {
      const error = event.detail || {};
      const category = error.category;
      const networkCategory = window.shaka.util.Error.Category.NETWORK;
      const kind = category === networkCategory ? 'network'
        : (String(error.message || '').toLowerCase().includes('manifest') ? 'manifest' : 'drm');
      this.failCurrent(kind, error.message || `Shaka playback error${error.code ? ` (${error.code})` : ''}.`);
    });
    try {
      await player.load(server.url);
      this.setStatus('Stream ready');
      if (this.options.autoPlay !== false) this.el.video.play().catch(() => this.setStatus('Press Play to start the stream')); else this.setStatus('Press Play to start the stream');
    } catch (error) {
      const kind = error?.category === window.shaka.util.Error.Category.NETWORK ? 'network'
        : (String(error?.message || '').toLowerCase().includes('manifest') ? 'manifest' : 'drm');
      throw Object.assign(new Error(error?.message || 'DASH manifest could not be loaded.'), { kind });
    }
  }

  async startYouTube(server) {
    const id = youtubeId(server.url);
    if (!id || !/^[\w-]{11}$/.test(id)) throw Object.assign(new Error('This is not a recognized YouTube video or live URL.'), { kind: 'configuration' });
    const YT = await loadYouTubeApi();
    this.el.video.hidden = true;
    this.el.youtube.hidden = false;
    this.el.youtube.replaceChildren();
    const mount = document.createElement('div');
    mount.id = `youtube-player-${Date.now()}`;
    this.el.youtube.append(mount);
    this.youtube = new YT.Player(mount.id, {
      videoId: id,
      playerVars: { autoplay: this.options.autoPlay === false ? 0 : 1, playsinline: 1, rel: 0, origin: location.origin },
      events: {
        onReady: event => { this.youtube = event.target; this.setStatus('YouTube ready'); this.syncYouTubeControls(); },
        onStateChange: event => {
          if (event.data === YT.PlayerState.PLAYING) { this.markSuccess(); this.setStatus('Live'); }
          if (event.data === YT.PlayerState.PAUSED) this.setStatus('Paused');
          this.syncYouTubeControls();
        },
        onError: event => {
          const message = ({ 2: 'Invalid YouTube request.', 5: 'The YouTube player could not play this video.', 100: 'YouTube video not found or unavailable.', 101: 'The video owner does not allow embedded playback.', 150: 'The video owner does not allow embedded playback.' })[event.data] || `YouTube playback error (${event.data}).`;
          this.failCurrent('media', message);
        }
      }
    });
  }

  startWatchdog() {
    clearTimeout(this.watchdog);
    this.watchdog = setTimeout(() => {
      if (this.el.stage.classList.contains('is-loading')) this.failCurrent('network', 'The stream did not start in time.');
    }, 25000);
  }

  markSuccess() {
    clearTimeout(this.watchdog);
    this.el.stage.classList.remove('is-loading');
    this.el.error.hidden = true;
    const server = this.servers[this.currentIndex];
    this.setStatus(server ? `Playing · ${server.name || `Server ${this.currentIndex + 1}`}` : 'Playing');
    this.callbacks.onServerSuccess?.(this.channel, server);
    this.syncControls();
  }

  failCurrent(kind, message) {
    if (this.currentIndex < 0 || this.failed.has(this.currentIndex)) return;
    const failedIndex = this.currentIndex;
    this.failed.add(failedIndex);
    clearTimeout(this.watchdog);
    this.callbacks.onServerFailure?.(this.channel, this.servers[failedIndex], kind, message);
    const canFallback = ['network', 'manifest', 'media', 'timeout'].includes(kind);
    if (canFallback) {
      const next = this.nextEligibleIndex(failedIndex + 1) >= 0 ? this.nextEligibleIndex(failedIndex + 1) : this.nextEligibleIndex(0);
      if (next >= 0) {
        this.setStatus(`${kindLabel(kind)} issue — trying ${this.servers[next].name || `Server ${next + 1}`}…`);
        this.startServer(next);
        return;
      }
    }
    this.showError(`${kindLabel(kind)}: ${message}`);
  }

  nextEligibleIndex(start) {
    for (let offset = 0; offset < this.servers.length; offset += 1) {
      const index = (start + offset) % this.servers.length;
      if (!this.failed.has(index)) return index;
    }
    return -1;
  }

  tryNext(index) {
    const next = this.nextEligibleIndex(index);
    return next >= 0 ? this.startServer(next) : this.allFailed();
  }

  allFailed() {
    this.cleanupEngine();
    this.showError('All eligible servers failed. Check the stream URL, CORS settings, authorization and network, then retry or choose another server.');
  }

  showError(message) {
    this.el.stage.classList.remove('is-loading');
    this.el.errorMessage.textContent = message;
    this.el.error.hidden = false;
    this.setStatus('Playback needs attention');
  }

  setStatus(text) { this.el.status.textContent = text; }

  renderServerOptions() {
    const select = this.el.serverSelect;
    const current = String(this.currentIndex);
    select.replaceChildren();
    this.servers.forEach((server, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = `${server.name || `Server ${index + 1}`}${this.failed.has(index) ? ' · failed' : ''}`;
      select.append(option);
    });
    select.disabled = this.servers.length < 2;
    if (this.currentIndex >= 0) select.value = current;
  }

  togglePlay() {
    if (this.youtube) {
      const state = this.youtube.getPlayerState?.();
      if (state === window.YT?.PlayerState?.PLAYING) this.youtube.pauseVideo(); else this.youtube.playVideo();
    } else if (this.el.video.paused) this.el.video.play().catch(() => this.setStatus('Playback could not start.')); else this.el.video.pause();
  }
  toggleMute() {
    if (this.youtube) {
      if (this.youtube.isMuted()) this.youtube.unMute(); else this.youtube.mute();
      this.syncYouTubeControls();
    } else { this.el.video.muted = !this.el.video.muted; this.syncControls(); }
  }
  async toggleFullscreen() {
    const target = this.el.stage;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (target.requestFullscreen) await target.requestFullscreen();
      else this.el.dialog.requestFullscreen?.();
    } catch (_) { this.setStatus('Fullscreen is not available in this browser.'); }
  }
  async togglePiP() {
    try {
      if (this.youtube || !document.pictureInPictureEnabled) throw new Error('Picture-in-Picture is not available for this stream.');
      if (document.pictureInPictureElement) await document.exitPictureInPicture(); else await this.el.video.requestPictureInPicture();
    } catch (error) { this.setStatus(error.message || 'Picture-in-Picture is not available.'); }
  }
  syncYouTubeControls() {
    const playing = this.youtube?.getPlayerState?.() === window.YT?.PlayerState?.PLAYING;
    this.el.play.textContent = playing ? 'Pause' : 'Play';
    this.el.mute.textContent = this.youtube?.isMuted?.() ? 'Unmute' : 'Mute';
    this.el.volume.disabled = true;
    this.el.pip.disabled = true;
  }
  syncControls() {
    if (this.youtube) return this.syncYouTubeControls();
    const video = this.el.video;
    this.el.play.textContent = video.paused ? 'Play' : 'Pause';
    this.el.mute.textContent = video.muted || video.volume === 0 ? 'Unmute' : 'Mute';
    this.el.volume.disabled = false;
    this.el.pip.disabled = !document.pictureInPictureEnabled;
    this.el.volume.value = String(video.volume);
  }
  revealControls() {
    this.el.controls?.classList.remove('is-hidden');
    clearTimeout(this.hideTimer);
    const delay = Number(this.options.autoHideControlsMs ?? 4000);
    if (delay > 0 && this.el.dialog.open) this.hideTimer = setTimeout(() => {
      if (!this.el.dialog.matches(':focus-within') && !this.el.controls.matches(':hover')) this.el.controls.classList.add('is-hidden');
    }, delay);
  }

  cleanupEngine() {
    clearTimeout(this.watchdog);
    this.streamListeners.splice(0).forEach(remove => remove());
    this.mediaRecovered = false;
    try { if (this.youtube?.destroy) this.youtube.destroy(); } catch (_) { /* already destroyed */ }
    this.youtube = null;
    if (this.engine) {
      try {
        if (typeof this.engine.destroy === 'function') Promise.resolve(this.engine.destroy()).catch(() => {});
      } catch (_) { /* vendor cleanup should not prevent stream change */ }
    }
    this.engine = null;
    const video = this.el.video;
    try { video.pause(); video.removeAttribute('src'); video.load(); } catch (_) { /* ignored */ }
    this.el.youtube.replaceChildren();
  }

  close() {
    clearTimeout(this.hideTimer);
    this.cleanupEngine();
    this.currentIndex = -1;
    this.el.error.hidden = true;
    if (this.el.dialog.open) this.el.dialog.close(); else this.el.dialog.removeAttribute('open');
    this.callbacks.onClose?.();
  }
}

function kindLabel(kind) {
  return ({ network: 'Network error', manifest: 'Manifest error', drm: 'DRM error', authorization: 'Authorization error', media: 'Playback error', timeout: 'Timeout', unsupported: 'Unsupported stream', configuration: 'Configuration error' })[kind] || 'Playback error';
}

export { youtubeId };
