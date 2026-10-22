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
    targetCtx.clearRect(0, 0, width, height);
    targetCtx.drawImage(image, frame.col * manifest.frameWidth, 0,
      manifest.frameWidth, manifest.frameHeight, 0, 0, width, height);
  }

  function drawExpression(name) {
    const frame = manifest.expressions[name] || manifest.expressions.happy;
    drawFrame(frame, expressionCtx, expressionCanvas.width, expressionCanvas.height);
  }

  function stopAnimation() {
    if (animationTimer !== null) window.clearInterval(animationTimer);
    animationTimer = null;
  }

  function setState(nextState) {
    if (!manifest.animations[nextState]) nextState = "idle";
    stopAnimation();
    activeState = nextState;
    frameIndex = 0;
    const animation = manifest.animations[nextState];
    drawFrame(animation.frames[0], ctx, canvas.width, canvas.height);
    status.textContent = "Jess is here · " + animation.label.toLowerCase() + " · offline-ready";
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
      images.forEach((image, index) => { strips[index] = image; });
      ready = true;
      setState("idle");
      window.setTimeout(() => say("I'm here. Double-click me or choose Open.", "happy"), 700);
    } catch (error) {
      fallback();
      console.error("[Jess pet] Offline asset loading failed:", error);
    }
  }

  document.querySelectorAll("[data-state]").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      const name = button.getAttribute("data-state");
      setState(name);
      if (name === "celebrate") say("Nice! Task complete.", "happyEyesClosed");
      if (name === "think") say("Let me think this through.", "concerned");
    });
  });

  document.querySelector('[data-action="open"]').addEventListener("click", async event => {
    event.stopPropagation();
    try {
      const result = await window.jessPet?.openHubMind?.();
      if (!result || result.ok !== true) say("I couldn't open Hub-Mind just now.", "concerned");
    } catch (error) {
      say("I couldn't open Hub-Mind just now.", "concerned");
      console.error(error);
    }
  });

  document.querySelector('[data-action="hide"]').addEventListener("click", async event => {
    event.stopPropagation();
    try { await window.jessPet?.hide?.(); } catch (error) { console.error(error); }
  });

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
    if (!moved && ready) {
      setState("jump");
      say("Hi! I'm Jess. I'm ready when you are.", "happy");
    }
    isDragging = false;
  }
  character.addEventListener("pointerup", finishPointer);
  character.addEventListener("pointercancel", finishPointer);
  character.addEventListener("dblclick", event => {
    event.preventDefault();
    event.stopPropagation();
    window.jessPet?.openHubMind?.().catch(error => console.error(error));
  });
  character.addEventListener("contextmenu", event => {
    event.preventDefault();
    say("Use the buttons to open Hub-Mind or try an animation.", "surprised");
  });

  window.jessPet?.onState?.(state => setState(state));
  initialize();
})();
