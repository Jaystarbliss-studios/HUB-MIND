import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('desktop transcript is a separate fixed and click-through window', async () => {
  const [main, preload, page, css] = await Promise.all([
    read('../../electron/main.cjs'),
    read('../../electron/preload.cjs'),
    read('../../src/pages/JessTranscriptOverlayPage.tsx'),
    read('../../src/pages/jess-transcript-overlay.css'),
  ]);

  assert.match(main, /let transcriptOverlayWindow;/);
  assert.match(main, /function createTranscriptOverlayWindow\(\)/);
  assert.match(main, /movable: false, focusable: false/);
  assert.match(main, /transcriptOverlayWindow\.setIgnoreMouseEvents\(true, \{ forward: true \}\)/);
  assert.match(main, /function positionTranscriptOverlayWindow\(\)/);
  assert.match(main, /area\.x \+ \(area\.width - width\) \/ 2/);
  assert.match(main, /hubmind:set-transcript-overlay-visible/);
  assert.match(preload, /setTranscriptOverlayVisible: .*hubmind:set-transcript-overlay-visible/);
  assert.match(page, /hubmind\.jess\.desktopTranscript\.v1/);
  assert.match(page, /setTranscriptOverlayVisible/);
  assert.match(css, /pointer-events: none/);
  assert.match(css, /backdrop-filter: blur/);
  assert.match(css, /rgba\(15, 23, 42, \.12\)/);
  assert.match(css, /backdrop-filter: blur\(28px\) saturate\(175%\)/);
  assert.doesNotMatch(css, /rgba\(2, 6, 23, \.56\)/);
  assert.match(css, /justify-content: center/);
});

test('workspace route changes do not unmount Jess or rebuild Live callbacks', async () => {
  const [app, assistant] = await Promise.all([
    read('../../src/App.tsx'),
    read('../../src/components/JessFloatingAssistant.tsx'),
  ]);

  assert.match(app, /const desktopOverlayRoute = \['\/companion', '\/companion-transcript', '\/orb'\]/);
  assert.match(app, /Keep the actual[\s\S]{0,100}Jess session mounted across authenticated route changes/);
  assert.match(app, /<JessFloatingAssistant \/>/);
  assert.match(assistant, /const locationPathRef = useRef\(location\.pathname\)/);
  assert.match(assistant, /locationPathRef\.current = location\.pathname/);
  assert.match(assistant, /resolveJessContext\(locationPathRef\.current\)/);
  assert.match(assistant, /!isDesktopShell && speechState\.text/);
  assert.doesNotMatch(assistant, /\}, \[connection, location\.pathname, navigate, profile/);
});

test('movable companion stays icon-sized when transcript appears', async () => {
  const [main, css] = await Promise.all([
    read('../../electron/main.cjs'),
    read('../../src/pages/companion.css'),
  ]);
  assert.match(main, /width: 96, height: 96, minWidth: 96, minHeight: 96/);
  assert.match(main, /hubmind:set-companion-transcript-visible[\s\S]{0,220}Legacy compatibility only/);
  assert.match(css, /\.jess-orb-window \.jess-transcript,[\s\S]*display:none!important/);
});
