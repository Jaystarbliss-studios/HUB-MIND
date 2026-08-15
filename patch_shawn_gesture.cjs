const fs = require('fs');
let code = fs.readFileSync('src/components/Shawn.tsx', 'utf8');

const oldClick = `                    <button
                      type="button"
                      onClick={() => setVoiceActivated(!voiceActivated)}
                      className={\`p-2 rounded-xl transition-colors \${voiceActivated ? 'bg-amber-500/20 text-amber-500' : 'bg-slate-800 text-slate-400 hover:text-slate-300'}\`}`;

const newClick = `                    <button
                      type="button"
                      onClick={() => {
                        // Ensure AudioContext is created/resumed on user click gesture
                        if (!(window as any).__sharedAudioCtx) {
                          (window as any).__sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                        }
                        const ctx = (window as any).__sharedAudioCtx;
                        if (ctx.state === 'suspended') ctx.resume();
                        setVoiceActivated(!voiceActivated);
                      }}
                      className={\`p-2 rounded-xl transition-colors \${voiceActivated ? 'bg-amber-500/20 text-amber-500' : 'bg-slate-800 text-slate-400 hover:text-slate-300'}\`}`;

code = code.replace(oldClick, newClick);
fs.writeFileSync('src/components/Shawn.tsx', code);
