export type JessOfflineCommand =
  | { kind: 'stop'; label: string }
  | {
      kind: 'native';
      method: 'launch_app' | 'show_desktop' | 'minimize_all' | 'switch_window' | 'media_key';
      args: Record<string, string>;
      label: string;
    };

/**
 * A deliberately small, deterministic offline command catalogue.
 * Only exact, low-risk phrases are eligible; everything else returns null
 * and is handed to the normal Jess conversation path.
 */
export function parseJessOfflineCommand(input: unknown): JessOfflineCommand | null {
  const phrase = String(input ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[.!?,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^please\s+/, '');

  if (!phrase) return null;

  if (['stop', 'stop jess', 'stop full control', 'stop desktop control', 'stop controlling windows'].includes(phrase)) {
    return { kind: 'stop', label: 'stop Full Control' };
  }

  const apps: Record<string, { name: string; label: string }> = {
    'open notepad': { name: 'notepad.exe', label: 'open Notepad' },
    'open the notepad': { name: 'notepad.exe', label: 'open Notepad' },
    'open calculator': { name: 'calc.exe', label: 'open Calculator' },
    'open the calculator': { name: 'calc.exe', label: 'open Calculator' },
    'open file explorer': { name: 'explorer.exe', label: 'open File Explorer' },
    'open explorer': { name: 'explorer.exe', label: 'open File Explorer' },
    'open chrome': { name: 'chrome', label: 'open Chrome' },
    'open google chrome': { name: 'chrome', label: 'open Chrome' },
    'open edge': { name: 'msedge', label: 'open Microsoft Edge' },
    'open microsoft edge': { name: 'msedge', label: 'open Microsoft Edge' },
    'open settings': { name: 'ms-settings:', label: 'open Windows Settings' },
    'open windows settings': { name: 'ms-settings:', label: 'open Windows Settings' },
  };
  const app = apps[phrase];
  if (app) return { kind: 'native', method: 'launch_app', args: { name: app.name }, label: app.label };

  if (['show desktop', 'show me the desktop', 'go to desktop'].includes(phrase)) {
    return { kind: 'native', method: 'show_desktop', args: {}, label: 'show the desktop' };
  }
  if (['minimize all windows', 'minimize all'].includes(phrase)) {
    return { kind: 'native', method: 'minimize_all', args: {}, label: 'minimize all windows' };
  }
  if (['switch window', 'switch windows', 'next window'].includes(phrase)) {
    return { kind: 'native', method: 'switch_window', args: {}, label: 'switch windows' };
  }
  if (['mute volume', 'mute sound', 'mute the volume', 'volume mute'].includes(phrase)) {
    return { kind: 'native', method: 'media_key', args: { action: 'volume_mute' }, label: 'mute the volume' };
  }
  if (['volume up', 'turn volume up', 'increase volume', 'turn up the volume'].includes(phrase)) {
    return { kind: 'native', method: 'media_key', args: { action: 'volume_up' }, label: 'turn the volume up' };
  }
  if (['volume down', 'turn volume down', 'decrease volume', 'turn down the volume'].includes(phrase)) {
    return { kind: 'native', method: 'media_key', args: { action: 'volume_down' }, label: 'turn the volume down' };
  }

  return null;
}
