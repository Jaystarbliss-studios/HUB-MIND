(() => {
  "use strict";
  const manifest = window.JessPetManifest;
  const canvas = document.getElementById("jess-canvas");
  const ctx = canvas.getContext("2d", { alpha: true });
  const visualCanvas = document.getElementById("jess-visualizer");
  const visualCtx = visualCanvas.getContext("2d", { alpha: true });
  const expressionCanvas = document.getElementById("expression");
  const expressionCtx = expressionCanvas.getContext("2d", { alpha: true });
  const speech = document.getElementById("speech");
  const speechText = document.getElementById("speech-text");
  const status = document.getElementById("status");
  const statusLabel = document.getElementById("status-label");
  const character = document.getElementById("character");
  const strips = [];
  let activeState = "idle";
  let animationTimer = null;
  let frameIndex = 0;
  let pointerStart = null;
  let isDragging = false;
  let lastPointer = null;
  let speechTimer = null;
  let idleFidgetTimer = null;
  let visualFrame = null;
  let visualPhase = 0;
  let singleClickTimer = null;
  let suppressNextClick = false;
  let ready = false;
  let visualState = {
    connection: "disconnected",
    state: "idle",
    inputLevel: 0,
    outputLevel: 0
  };

  const allowedStates = new Set(["idle", "listening", "thinking", "speaking", "interrupted", "muted", "error"]);
  const allowedConnections = new Set(["disconnected", "connecting", "connected", "error"]);

  function clampLevel(value) {
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not load local Jess art: " + src));
      image.src = src;
    });
  }

  function drawFrame(frame, targetCtx, width, height) {
    if (!ready || !frame || !strips[frame.row]) return;
    const image = strips[frame.row];
    const sourceFrameWidth = image.naturalWidth / manifest.columns;
    const sourceFrameHeight = image.naturalHeight;
    if (!Number.isInteger(sourceFrameWidth) || sourceFrameWidth <= 0 || sourceFrameHeight <= 0) return;
    targetCtx.clearRect(0, 0, width, height);
    targetCtx.drawImage(image, frame.col * sourceFrameWidth, 0,
      sourceFrameWidth, sourceFrameHeight, 0, 0, width, height);
  }

  function drawExpression(name) {
    const frame = manifest.expressions[name] || manifest.expressions.happy;
    drawFrame(frame, expressionCtx, expressionCanvas.width, expressionCanvas.height);
  }

  function stopAnimation() {
    if (animationTimer !== null) window.clearInterval(animationTimer);
    animationTimer = null;
  }

  function statusMode() {
    if (visualState.connection === "error" || visualState.state === "error") return "error";
    if (visualState.connection === "connecting") return "connecting";
    if (visualState.connection === "connected" && visualState.state === "muted") return "muted";
    if (visualState.connection === "connected") return "connected";
    return "disconnected";
  }

  function updateStatus() {
    const mode = statusMode();
    status.dataset.status = mode;
    if (mode === "connecting") statusLabel.textContent = "Connecting to Jess…";
    else if (mode === "error") statusLabel.textContent = "Connection error · click to retry";
    else if (mode === "muted") statusLabel.textContent = "Microphone muted";
    else if (mode === "connected" && visualState.state === "speaking") statusLabel.textContent = "Jess is speaking";
    else if (mode === "connected" && visualState.state === "thinking") statusLabel.textContent = "Jess is thinking";
    else if (mode === "connected") statusLabel.textContent = "Connected · listening";
    else statusLabel.textContent = "Double-click Jess to talk";
  }

  function colorForMode(mode) {
    if (mode === "connecting") return { line: "192,132,252", solid: "#c084fc" };
    if (mode === "connected") return { line: "74,222,128", solid: "#4ade80" };
    if (mode === "muted") return { line: "251,191,36", solid: "#fbbf24" };
    if (mode === "error") return { line: "248,113,113", solid: "#f87171" };
    return { line: "148,163,184", solid: "#94a3b8" };
  }

  function renderVisualizer() {
    visualFrame = null;
    visualPhase += 0.055;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const logicalSize = 236;
    const pixelSize = Math.round(logicalSize * dpr);
    if (visualCanvas.width !== pixelSize || visualCanvas.height !== pixelSize) {
      visualCanvas.width = pixelSize;
      visualCanvas.height = pixelSize;
    }
    visualCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    visualCtx.clearRect(0, 0, logicalSize, logicalSize);
    const mode = statusMode();
    const palette = colorForMode(mode);
    const state = visualState.state;
    const level = state === "speaking" ? visualState.outputLevel : visualState.inputLevel;
    const idlePulse = 0.08 + (Math.sin(visualPhase) + 1) * 0.035;
    const busyPulse = mode === "connecting" ? 0.2 + (Math.sin(visualPhase * 2.2) + 1) * 0.09 : 0;
    const thinkingPulse = state === "thinking" ? 0.2 + (Math.sin(visualPhase * 1.8) + 1) * 0.11 : 0;
    const intensity = Math.max(0.08, Math.min(1, state === "speaking" || state === "listening" ? level * 2.5 + 0.08 : busyPulse || thinkingPulse || idlePulse));
    const cx = logicalSize / 2;
    const cy = logicalSize / 2;
    const baseRadius = 74 + intensity * 7;
    const ambient = visualCtx.createRadialGradient(cx, cy, 22, cx, cy, 112);
    ambient.addColorStop(0, "rgba(" + palette.line + "," + (0.12 + intensity * 0.12) + ")");
    ambient.addColorStop(0.66, "rgba(" + palette.line + ",0.06)");
    ambient.addColorStop(1, "rgba(" + palette.line + ",0)");
    visualCtx.fillStyle = ambient;
    visualCtx.beginPath();
    visualCtx.arc(cx, cy, 112, 0, Math.PI * 2);
    visualCtx.fill();

    const ringCount = mode === "connected" ? 3 : mode === "connecting" || mode === "error" ? 2 : 1;
    for (let ring = 0; ring < ringCount; ring += 1) {
      visualCtx.beginPath();
      const radius = baseRadius + ring * 9;
      for (let point = 0; point <= 96; point += 1) {
        const angle = point / 96 * Math.PI * 2;
        const waveA = Math.sin(angle * (4 + ring) + visualPhase * (ring % 2 ? -1.3 : 1.5));
        const waveB = Math.cos(angle * (7 + ring) - visualPhase * 1.8);
        const wave = (waveA * 0.65 + waveB * 0.35) * intensity * (3 + ring * 3);
        const radiusAtPoint = radius + wave;
        const x = cx + radiusAtPoint * Math.cos(angle);
        const y = cy + radiusAtPoint * Math.sin(angle);
        if (point === 0) visualCtx.moveTo(x, y);
        else visualCtx.lineTo(x, y);
      }
      visualCtx.closePath();
      visualCtx.strokeStyle = "rgba(" + palette.line + "," + (mode === "disconnected" ? 0.28 : 0.62 - ring * 0.12) + ")";
      visualCtx.lineWidth = mode === "connected" && state === "speaking" ? 2.6 : 1.8;
      visualCtx.shadowColor = palette.solid;
      visualCtx.shadowBlur = mode === "disconnected" ? 2 : 8 + intensity * 9;
      visualCtx.stroke();
      visualCtx.shadowBlur = 0;
    }
    visualFrame = window.requestAnimationFrame(renderVisualizer);
  }

  function scheduleIdleFidget() {
    if (idleFidgetTimer !== null) window.clearTimeout(idleFidgetTimer);
    idleFidgetTimer = null;
    if (activeState !== "idle" || visualState.connection !== "disconnected") return;
    idleFidgetTimer = window.setTimeout(() => {
      idleFidgetTimer = null;
      if (activeState === "idle" && visualState.connection === "disconnected") setState("walk", true);
    }, 10000 + Math.random() * 8000);
  }

  function setState(nextState, autonomousWalk = false) {
    if (idleFidgetTimer !== null) window.clearTimeout(idleFidgetTimer);
    idleFidgetTimer = null;
    if (!manifest.animations[nextState]) nextState = "idle";
    stopAnimation();
    activeState = nextState;
    frameIndex = 0;
    const animation = manifest.animations[nextState];
    drawFrame(animation.frames[0], ctx, canvas.width, canvas.height);
    updateStatus();
    if (animation.frames.length > 1) {
      animationTimer = window.setInterval(() => {
        frameIndex += 1;
        if (frameIndex >= animation.frames.length) {
          if (animation.loop) frameIndex = 0;
          else {
            stopAnimation();
            if (activeState === nextState) setState("idle");
            return;
          }
        }
        drawFrame(animation.frames[frameIndex], ctx, canvas.width, canvas.height);
      }, Math.max(65, 1000 / Math.max(1, animation.fps)));
    }
    if (nextState === "idle") {
      scheduleIdleFidget();
    } else if (nextState === "walk" && autonomousWalk) {
      idleFidgetTimer = window.setTimeout(() => {
        idleFidgetTimer = null;
        if (activeState === "walk") setState("idle");
      }, 1900);
    }
  }

  function applyVisualState(payload) {
    if (!payload || typeof payload !== "object") return;
    if (!allowedConnections.has(payload.connection) || !allowedStates.has(payload.state)) return;
    visualState = {
      connection: payload.connection,
      state: payload.state,
      inputLevel: clampLevel(payload.inputLevel),
      outputLevel: clampLevel(payload.outputLevel)
    };
    updateStatus();
    const animationForState = {
      idle: "idle",
      listening: "idle",
      thinking: "think",
      speaking: "happy",
      interrupted: "think",
      muted: "idle",
      error: "think"
    };
    setState(animationForState[visualState.state] || "idle");
  }

  function say(message, expression) {
    window.clearTimeout(speechTimer);
    drawExpression(expression || "happy");
    speechText.textContent = String(message || "").slice(0, 180);
    speech.hidden = false;
    speechTimer = window.setTimeout(() => { speech.hidden = true; }, 3200);
  }

  function fallback() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.arc(128, 95, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f8fafc";
    ctx.font = "700 64px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("J", 128, 118);
    statusLabel.textContent = "Jess art missing · install the local asset pack";
    status.dataset.status = "error";
    say("My animation files are missing. Please install the bundled Jess assets.", "concerned");
  }

  async function initialize() {
    try {
      const images = await Promise.all(manifest.rowAssets.map(loadImage));
      images.forEach((image, index) => {
        const cellWidth = image.naturalWidth / manifest.columns;
        if (!Number.isInteger(cellWidth) || cellWidth !== image.naturalHeight) {
          throw new Error("Invalid Jess sprite strip at row " + index + ": expected equal square frames across " + manifest.columns + " columns.");
        }
        strips[index] = image;
      });
      ready = true;
      setState("idle");
      window.setTimeout(() => say("I'm here. Double-click me to talk; click while connected to mute or unmute.", "happy"), 700);
    } catch (error) {
      fallback();
      console.error("[Jess pet] Offline asset loading failed:", error);
    }
  }

  function requestVoiceActivation(gesture) {
    const active = visualState.connection === "connected" || visualState.connection === "connecting";
    if (gesture === "mute") {
      say(visualState.state === "muted" ? "Turning the microphone back on…" : "Muting the microphone…", "happy");
    } else {
      say(active ? "Ending voice chat…" : "Connecting to Jess…", active ? "concerned" : "happy");
    }
    Promise.resolve(window.jessPet?.activateVoice?.(gesture)).then(result => {
      if (!result || result.ok !== true) {
        say("I couldn't activate voice chat. Check that Hub-Mind is open and you're signed in.", "concerned");
      }
    }).catch(error => {
      say("I couldn't activate voice chat. Check that Hub-Mind is open and you're signed in.", "concerned");
      console.error("[Jess pet] Voice activation failed:", error);
    });
  }

  character.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    pointerStart = { x: event.screenX, y: event.screenY };
    lastPointer = pointerStart;
    isDragging = false;
    try { character.setPointerCapture(event.pointerId); } catch {}
  });
  character.addEventListener("pointermove", event => {
    if (!pointerStart || !lastPointer) return;
    const dx = event.screenX - lastPointer.x;
    const dy = event.screenY - lastPointer.y;
    if (!isDragging && Math.hypot(dx, dy) > 5) isDragging = true;
    if (isDragging) {
      const stepX = event.screenX - lastPointer.x;
      const stepY = event.screenY - lastPointer.y;
      lastPointer = { x: event.screenX, y: event.screenY };
      Promise.resolve(window.jessPet?.moveBy?.(stepX, stepY)).catch(error => console.debug(error));
    }
  });

  function finishPointer() {
    const moved = isDragging;
    pointerStart = null;
    lastPointer = null;
    isDragging = false;
    if (moved) {
      suppressNextClick = true;
      window.setTimeout(() => { suppressNextClick = false; }, 0);
    }
  }
  character.addEventListener("pointerup", finishPointer);
  character.addEventListener("pointercancel", () => {
    pointerStart = null;
    lastPointer = null;
    isDragging = false;
    suppressNextClick = true;
    window.setTimeout(() => { suppressNextClick = false; }, 0);
  });

  character.addEventListener("click", event => {
    if (suppressNextClick) {
      event.preventDefault();
      return;
    }
    if (event.detail > 1) {
      if (singleClickTimer !== null) window.clearTimeout(singleClickTimer);
      singleClickTimer = null;
      return;
    }
    if (singleClickTimer !== null) window.clearTimeout(singleClickTimer);
    singleClickTimer = window.setTimeout(() => {
      singleClickTimer = null;
      if (visualState.connection === "connected") requestVoiceActivation("mute");
      else if (visualState.connection === "connecting") say("Jess is still connecting. Please wait a moment.", "concerned");
      else requestVoiceActivation("toggle");
    }, 420);
  });

  character.addEventListener("dblclick", event => {
    event.preventDefault();
    event.stopPropagation();
    if (singleClickTimer !== null) window.clearTimeout(singleClickTimer);
    singleClickTimer = null;
    requestVoiceActivation("toggle");
  });

  character.addEventListener("contextmenu", event => {
    event.preventDefault();
    Promise.resolve(window.jessPet?.hide?.()).catch(error => console.error(error));
  });

  window.jessPet?.onState?.(state => {
    if (typeof state === "string" && manifest.animations[state]) setState(state);
  });
  window.jessPet?.onVisualState?.(applyVisualState);
  window.jessPet?.onSpeech?.(payload => {
    if (!payload || typeof payload.text !== "string") return;
    const allowedFaces = new Set(["happy", "happyEyesClosed", "concerned", "surprised", "annoyed"]);
    say(payload.text, allowedFaces.has(payload.expression) ? payload.expression : "happy");
  });
  updateStatus();
  visualFrame = window.requestAnimationFrame(renderVisualizer);
  initialize();
})();