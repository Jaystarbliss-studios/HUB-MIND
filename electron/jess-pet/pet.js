(() => {
  "use strict";
  const manifest = window.JessPetManifest;
  const canvas = document.getElementById("jess-canvas");
  const ctx = canvas.getContext("2d", { alpha: true });
  const expressionCanvas = document.getElementById("expression");
  const expressionCtx = expressionCanvas.getContext("2d", { alpha: true });
  const speech = document.getElementById("speech");
  const speechText = document.getElementById("speech-text");
  const status = document.getElementById("status");
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
  let ready = false;

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
    // Each strip can have its own source resolution. Never assume all strips use
    // the same frame size: the source frame is one equal-width cell in that row.
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

  function scheduleIdleFidget() {
    if (idleFidgetTimer !== null) window.clearTimeout(idleFidgetTimer);
    idleFidgetTimer = null;
    if (activeState !== "idle") return;
    idleFidgetTimer = window.setTimeout(() => {
      idleFidgetTimer = null;
      if (activeState === "idle") setState("walk", true);
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
    status.textContent = "Jess is " + animation.label.toLowerCase() + ".";
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
    status.textContent = "Jess art missing · install the local asset pack";
    say("My animation files are missing. Please install the bundled Jess assets.", "concerned");
  }

  async function initialize() {
    try {
      const images = await Promise.all(manifest.rowAssets.map(loadImage));
      images.forEach((image, index) => {
        const cellWidth = image.naturalWidth / manifest.columns;
        if (!Number.isInteger(cellWidth) || cellWidth !== image.naturalHeight) {
          throw new Error(`Invalid Jess sprite strip at row ${index}: expected equal square frames across ${manifest.columns} columns.`);
        }
        strips[index] = image;
      });
      ready = true;
      setState("idle");
      window.setTimeout(() => say("I'm here. Click me to start a voice conversation.", "happy"), 700);
    } catch (error) {
      fallback();
      console.error("[Jess pet] Offline asset loading failed:", error);
    }
  }

  let singleClickTimer = null;
  let suppressNextClick = false;
  const SINGLE_CLICK_DELAY_MS = 500;

  function requestVoiceActivation(gesture) {
    say("Starting voice chat…", "happy");
    Promise.resolve(window.jessPet?.activateVoice?.(gesture)).then(result => {
      if (!result || result.ok !== true) {
        say("I couldn't start voice chat. Please sign in to Hub-Mind and try again.", "concerned");
      }
    }).catch(error => {
      say("I couldn't start voice chat. Please sign in to Hub-Mind and try again.", "concerned");
      console.error("[Jess pet] Voice activation failed:", error);
    });
  }

  async function openHubMind() {
    try {
      const result = await window.jessPet?.openHubMind?.();
      if (!result || result.ok !== true) say("I couldn't open Hub-Mind just now.", "concerned");
    } catch (error) {
      say("I couldn't open Hub-Mind just now.", "concerned");
      console.error(error);
    }
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
    const dx = event.screenX - pointerStart.x;
    const dy = event.screenY - pointerStart.y;
    if (!isDragging && Math.hypot(dx, dy) > 5) isDragging = true;
    if (isDragging) {
      const stepX = event.screenX - lastPointer.x;
      const stepY = event.screenY - lastPointer.y;
      lastPointer = { x: event.screenX, y: event.screenY };
      window.jessPet?.moveBy?.(stepX, stepY).catch(error => console.debug(error));
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
    // The second click of a double-click cancels the deferred single-click action.
    if (event.detail > 1) {
      if (singleClickTimer !== null) window.clearTimeout(singleClickTimer);
      singleClickTimer = null;
      return;
    }
    if (singleClickTimer !== null) window.clearTimeout(singleClickTimer);
    singleClickTimer = window.setTimeout(() => {
      singleClickTimer = null;
      requestVoiceActivation("single");
    }, SINGLE_CLICK_DELAY_MS);
  });
  character.addEventListener("dblclick", event => {
    event.preventDefault();
    event.stopPropagation();
    if (singleClickTimer !== null) window.clearTimeout(singleClickTimer);
    singleClickTimer = null;
    requestVoiceActivation("double");
    // Keep the old double-click convenience: open the workspace as well as
    // sending the activation request to the authenticated Live voice controller.
    void openHubMind();
  });
  character.addEventListener("contextmenu", event => {
    event.preventDefault();
    // Keep the character unobtrusive without a permanent Hide button.
    // The Hub-Mind tray menu has a "Show Jess orb" action to restore her.
    Promise.resolve(window.jessPet?.hide?.()).catch(error => console.error(error));
  });

  window.jessPet?.onState?.(state => setState(state));
  window.jessPet?.onSpeech?.(payload => {
    if (!payload || typeof payload.text !== "string") return;
    const allowedFaces = new Set(["happy", "happyEyesClosed", "concerned", "surprised", "annoyed"]);
    say(payload.text, allowedFaces.has(payload.expression) ? payload.expression : "happy");
  });
  initialize();
})();
