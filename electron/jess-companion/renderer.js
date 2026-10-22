'use strict';

(() => {
  const api = window.jessCompanion;
  const manifest = window.JESS_ANIMATION_MANIFEST || {};
  const stage = document.getElementById('jess-stage');
  const sprite = document.getElementById('jess-sprite');
  const statusDot = document.getElementById('jess-status-dot');
  const hideButton = document.getElementById('jess-hide');
  const message = document.getElementById('jess-message');
  if (!api || !stage || !sprite) return;

  const fallbackUrl = new URL(manifest.fallback || '../../dist/icon.svg', window.location.href).href;
  const animations = manifest.animations || {};
  let currentAnimation = '';
  let frameTimer = null;
  let messageTimer = null;
  let animationToken = 0;
  let dragging = false;
  let didMove = false;
  let lastX = 0;
  let lastY = 0;
  let downX = 0;
  let downY = 0;
  let lastTapAt = 0;
  let singleTapTimer = null;
  let interactive = false;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function showMessage(text, duration = 2600) {
    if (!message) return;
    message.textContent = String(text || '').slice(0, 220);
    message.classList.add('is-visible');
    if (messageTimer !== null) window.clearTimeout(messageTimer);
    messageTimer = window.setTimeout(() => {
      message.classList.remove('is-visible');
      messageTimer = null;
    }, duration);
  }

  function setInteractive(next) {
    next = next === true;
    if (interactive === next) return;
    interactive = next;
    Promise.resolve(api.setInteractive(next)).catch(() => undefined);
  }

  function isInsideHitArea(event) {
    if (!stage || dragging) return true;
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const area = manifest.hitArea || { x: 0.08, y: 0.08, width: 0.84, height: 0.84 };
    const inArt = x >= area.x && x <= area.x + area.width && y >= area.y && y <= area.y + area.height;
    if (hideButton) {
      const close = hideButton.getBoundingClientRect();
      const inClose = event.clientX >= close.left - 3 && event.clientX <= close.right + 3
        && event.clientY >= close.top - 3 && event.clientY <= close.bottom + 3;
      if (inClose) return true;
    }
    return inArt;
  }

  function useFallback() {
    stage.classList.add('is-fallback');
    if (sprite.getAttribute('src') !== fallbackUrl) sprite.src = fallbackUrl;
  }

  function frameUrl(path) {
    return new URL(String(path), window.location.href).href;
  }

  function playAnimation(name) {
    const animation = animations[name] || animations.idle || {};
    const frames = Array.isArray(animation.frames) ? animation.frames.filter(frame => typeof frame === 'string' && frame.length > 0) : [];
    const token = ++animationToken;
    currentAnimation = name;
    if (frameTimer !== null) {
      window.clearInterval(frameTimer);
      frameTimer = null;
    }

    Array.from(stage.classList)
      .filter(className => /^is-(idle|listening|thinking|speaking|working|waiting_approval|success|error|muted|interrupted)$/.test(className))
      .forEach(className => stage.classList.remove(className));
    stage.classList.add('is-' + name.replace(/[^a-z0-9_-]/gi, '-'));

    if (!frames.length) {
      useFallback();
      return;
    }

    const urls = frames.map(frameUrl);
    let index = 0;
    stage.classList.remove('is-fallback');
    sprite.onerror = () => {
      if (token !== animationToken) return;
      if (frameTimer !== null) window.clearInterval(frameTimer);
      frameTimer = null;
      useFallback();
    };
    sprite.src = urls[0];
    const fps = clamp(Number(animation.fps || manifest.fps || 8), 1, 24);
    if (urls.length > 1) {
      frameTimer = window.setInterval(() => {
        if (token !== animationToken || document.hidden) return;
        index += 1;
        if (index >= urls.length) {
          if (animation.loop === false) {
            window.clearInterval(frameTimer);
            frameTimer = null;
            const idleName = animations.idle ? 'idle' : name;
            if (name !== idleName) playAnimation(idleName);
            return;
          }
          index = 0;
        }
        sprite.src = urls[index];
      }, Math.round(1000 / fps));
    } else if (animation.loop === false) {
      frameTimer = window.setTimeout(() => {
        frameTimer = null;
        if (token === animationToken && name !== 'idle') playAnimation('idle');
      }, 900);
    }
  }

  function animationForState(state, activeTaskCount) {
    if (activeTaskCount > 0 && (!state || state === 'idle' || state === 'thinking')) return 'working';
    if (state === 'listening') return 'listening';
    if (state === 'thinking') return 'thinking';
    if (state === 'speaking') return 'speaking';
    if (state === 'success') return 'success';
    if (state === 'muted') return 'muted';
    if (state === 'error') return 'error';
    if (state === 'waiting_approval') return 'waiting_approval';
    return 'idle';
  }

  function applyState(payload) {
    if (!payload || typeof payload !== 'object') return;
    const state = typeof payload.state === 'string' ? payload.state : 'idle';
    const connection = typeof payload.connection === 'string' ? payload.connection : 'disconnected';
    const activeTaskCount = Number.isFinite(payload.activeTaskCount) ? payload.activeTaskCount : 0;
    statusDot.className = 'jess-status-dot';
    if (connection === 'connected') statusDot.classList.add('is-connected');
    else if (connection === 'connecting') statusDot.classList.add('is-connecting');
    else if (connection === 'error' || state === 'error') statusDot.classList.add('is-error');
    else statusDot.classList.add('is-offline');
    if (activeTaskCount > 0) statusDot.classList.add('is-working');
    stage.setAttribute('aria-label', 'Jess desktop companion: ' + state);
    document.title = 'Jess · ' + state;
    const next = animationForState(state, activeTaskCount);
    if (next !== currentAnimation) playAnimation(next);
  }

  async function performAction(action) {
    try {
      const result = await api.action(action);
      if (result && result.ok === false && result.error) showMessage(result.error);
      else if (result && result.reason === 'workspace-not-ready') showMessage('Hub-Mind is still starting. Jess can remain on the desktop while it loads.');
      return result;
    } catch (error) {
      showMessage(error && error.message ? error.message : 'That Jess action is unavailable right now.');
      return { ok: false };
    }
  }

  function onPointerMove(event) {
    if (!dragging) {
      setInteractive(isInsideHitArea(event));
      return;
    }
    const dx = event.screenX - lastX;
    const dy = event.screenY - lastY;
    if (Math.hypot(event.screenX - downX, event.screenY - downY) > 5) didMove = true;
    lastX = event.screenX;
    lastY = event.screenY;
    if (dx || dy) Promise.resolve(api.moveBy(dx, dy)).catch(() => undefined);
  }

  function onPointerDown(event) {
    if (event.button !== 0 || event.target === hideButton) return;
    setInteractive(true);
    dragging = true;
    didMove = false;
    downX = lastX = event.screenX;
    downY = lastY = event.screenY;
    try { stage.setPointerCapture(event.pointerId); } catch {}
    event.preventDefault();
  }

  function onPointerUp(event) {
    if (!dragging) return;
    dragging = false;
    try { stage.releasePointerCapture(event.pointerId); } catch {}
    setInteractive(isInsideHitArea(event));
    if (didMove) return;

    const now = Date.now();
    if (now - lastTapAt <= 360) {
      lastTapAt = 0;
      if (singleTapTimer !== null) window.clearTimeout(singleTapTimer);
      singleTapTimer = null;
      void performAction('open-workspace');
    } else {
      lastTapAt = now;
      singleTapTimer = window.setTimeout(() => {
        singleTapTimer = null;
        void performAction('toggle-listening');
      }, 370);
    }
  }

  stage.addEventListener('pointerdown', onPointerDown);
  stage.addEventListener('pointermove', onPointerMove);
  stage.addEventListener('pointerup', onPointerUp);
  stage.addEventListener('pointercancel', onPointerUp);
  // Electron forwards mousemove events while the transparent window is in
  // click-through mode. Keep this hover-only; pointermove handles actual dragging.
  window.addEventListener('mousemove', event => {
    if (!dragging) setInteractive(isInsideHitArea(event));
  });
  window.addEventListener('blur', () => {
    if (dragging) {
      dragging = false;
      setInteractive(false);
    }
  });

  hideButton.addEventListener('pointerenter', () => setInteractive(true));
  hideButton.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    void performAction('hide');
  });

  if (typeof api.onState === 'function') api.onState(applyState);
  const width = clamp(Number(manifest.width || 96), 96, 420);
  const height = clamp(Number(manifest.height || 96), 96, 520);
  if (width !== window.innerWidth || height !== window.innerHeight) {
    void api.resize(width, height).catch(() => undefined);
  }
  useFallback();
  playAnimation('idle');
  setInteractive(false);

  window.addEventListener('beforeunload', () => {
    if (frameTimer !== null) window.clearInterval(frameTimer);
    if (messageTimer !== null) window.clearTimeout(messageTimer);
    if (singleTapTimer !== null) window.clearTimeout(singleTapTimer);
  });
})();
