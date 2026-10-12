const HOST = 'com.jaystarbliss.hubmind';
let nativePort = null;
let reconnectTimer = null;
function connect() {
  if (nativePort) return;
  try {
    nativePort = chrome.runtime.connectNative(HOST);
    nativePort.onMessage.addListener(message => {
      void dispatch(message).then(result => nativePort?.postMessage({ id: message.id, result }))
        .catch(error => nativePort?.postMessage({ id: message.id, result: { ok: false, verified: false, error: String(error?.message || error) } }));
    });
    nativePort.onDisconnect.addListener(() => {
      const error = chrome.runtime.lastError?.message;
      console.warn('[Jess Chrome Bridge] Native host disconnected:', error || 'disconnected');
      nativePort = null;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 2500);
    });
  } catch (error) {
    console.warn('[Jess Chrome Bridge] Could not connect to native host:', error);
    nativePort = null;
    reconnectTimer = setTimeout(connect, 5000);
  }
}
async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) throw new Error('No active Chrome tab is available.');
  return tab;
}
async function tabById(id) {
  const tab = id ? await chrome.tabs.get(Number(id)) : await activeTab();
  if (!tab?.id) throw new Error('Chrome tab not found.');
  return tab;
}
async function dispatch(message) {
  const a = message?.args && typeof message.args === 'object' ? message.args : {};
  switch (message?.method) {
    case 'chrome_list_tabs': {
      const tabs = await chrome.tabs.query({ currentWindow: false });
      return { ok: true, verified: true, evidence: tabs.slice(0, 100).map(t => ({ id: t.id, windowId: t.windowId, title: t.title || '', url: t.url || '', active: !!t.active, index: t.index, status: t.status })) };
    }
    case 'chrome_open_tab': {
      const url = normalizeUrl(a.url);
      const tab = await chrome.tabs.create({ url, active: a.active !== false });
      return { ok: true, verified: !!tab.id, evidence: { id: tab.id, url: tab.url || url, windowId: tab.windowId, active: tab.active } };
    }
    case 'chrome_close_tab': {
      const tab = await tabById(a.tabId);
      await chrome.tabs.remove(tab.id);
      let stillExists = true; try { await chrome.tabs.get(tab.id); } catch { stillExists = false; }
      return { ok: !stillExists, verified: !stillExists, evidence: { tabId: tab.id, closed: !stillExists } };
    }
    case 'chrome_activate_tab': {
      const tab = await tabById(a.tabId);
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
      const current = await chrome.tabs.get(tab.id);
      return { ok: current.active === true, verified: current.active === true, evidence: { id: current.id, title: current.title, url: current.url, active: current.active, windowId: current.windowId } };
    }
    case 'chrome_navigate_tab': {
      const tab = await tabById(a.tabId);
      const url = normalizeUrl(a.url);
      await chrome.tabs.update(tab.id, { url, active: a.active !== false });
      await new Promise(resolve => setTimeout(resolve, 700));
      const current = await chrome.tabs.get(tab.id);
      return { ok: current.url === url || current.url?.startsWith(url), verified: current.url === url || current.url?.startsWith(url), evidence: { id: current.id, title: current.title, url: current.url, status: current.status, requestedUrl: url } };
    }
    case 'chrome_reload_tab': {
      const tab = await tabById(a.tabId);
      await chrome.tabs.reload(tab.id);
      return { ok: true, verified: false, evidence: { tabId: tab.id, note: 'Reload requested; page completion must be checked with chrome_read_page.' } };
    }
    case 'chrome_scroll': {
      const tab = await tabById(a.tabId);
      const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (delta) => { const before = window.scrollY; window.scrollBy({ top: delta, behavior: 'instant' }); return { before, after: window.scrollY, max: document.documentElement.scrollHeight - window.innerHeight, title: document.title }; }, args: [Number(a.delta) || 600] });
      return { ok: true, verified: result?.result?.before !== result?.result?.after, evidence: { tabId: tab.id, ...result?.result } };
    }
    case 'chrome_read_page': {
      const tab = await tabById(a.tabId);
      const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => ({ title: document.title, url: location.href, text: (document.body?.innerText || '').slice(0, 20000), readyState: document.readyState }) });
      return { ok: true, verified: !!result?.result?.text, evidence: { tabId: tab.id, ...result?.result } };
    }
    case 'chrome_find_element': {
      const tab = await tabById(a.tabId);
      const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: ({ selector, text }) => {
        const nodes = selector ? Array.from(document.querySelectorAll(selector)).slice(0, 20) : Array.from(document.querySelectorAll('button,a,input,textarea,select,[role="button"],[role="link"]')).slice(0, 2000);
        const needle = String(text || '').toLowerCase();
        const node = nodes.find(el => !needle || ((el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('title') || '').toLowerCase().includes(needle)));
        if (!node) return null;
        const r = node.getBoundingClientRect();
        return { tag: node.tagName, text: (node.innerText || node.getAttribute('aria-label') || node.getAttribute('placeholder') || '').slice(0, 500), selector: selector || '', rect: { x: r.x, y: r.y, width: r.width, height: r.height }, disabled: !!node.disabled };
      }, args: [{ selector: String(a.selector || '').slice(0, 500), text: String(a.text || '').slice(0, 500) }] });
      return { ok: !!result?.result, verified: !!result?.result, evidence: { tabId: tab.id, element: result?.result || null } };
    }
    case 'chrome_click_element': {
      const tab = await tabById(a.tabId);
      const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: ({ selector, text }) => {
        const nodes = selector ? Array.from(document.querySelectorAll(selector)).slice(0, 20) : Array.from(document.querySelectorAll('button,a,[role="button"],[role="link"]')).slice(0, 2000);
        const needle = String(text || '').toLowerCase();
        const node = nodes.find(el => !needle || ((el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '').toLowerCase().includes(needle)));
        if (!node || node.disabled) return { clicked: false };
        node.click(); return { clicked: true, text: (node.innerText || node.getAttribute('aria-label') || '').slice(0, 300), href: node.href || null };
      }, args: [{ selector: String(a.selector || '').slice(0, 500), text: String(a.text || '').slice(0, 500) }] });
      return { ok: !!result?.result?.clicked, verified: false, evidence: { tabId: tab.id, ...result?.result, note: 'Click dispatched; use chrome_read_page to verify the resulting state.' } };
    }
    case 'chrome_fill_field': {
      const tab = await tabById(a.tabId);
      const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: ({ selector, value }) => {
        const el = document.querySelector(selector);
        if (!el || !('value' in el) || el.disabled) return { filled: false };
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        setter?.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
        return { filled: el.value === value, value: String(el.value).slice(0, 500), tag: el.tagName };
      }, args: [{ selector: String(a.selector || '').slice(0, 500), value: String(a.value || '').slice(0, 10000) }] });
      return { ok: !!result?.result?.filled, verified: !!result?.result?.filled, evidence: { tabId: tab.id, ...result?.result } };
    }
    default: throw new Error('Unsupported Chrome action: ' + message?.method);
  }
}
function normalizeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 2048) throw new Error('Provide a valid URL.');
  const url = /^[a-z]+:\/\//i.test(raw) ? raw : 'https://' + raw;
  const parsed = new URL(url);
  if (!['http:','https:'].includes(parsed.protocol)) throw new Error('Only HTTP and HTTPS pages can be controlled.');
  return parsed.href;
}
connect();
