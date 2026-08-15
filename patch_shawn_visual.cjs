const fs = require('fs');
let code = fs.readFileSync('src/components/Shawn.tsx', 'utf8');

const oldFab = `            voiceActivated ? 'bg-amber-400 animate-pulse shadow-[0_0_20px_rgba(251,191,36,0.8)]' : 'bg-accent hover:bg-accent-hover text-slate-950'`;
const newFab = `            voiceActivated ? (isSpeaking ? 'bg-amber-400 animate-ping shadow-[0_0_30px_rgba(251,191,36,1)]' : 'bg-amber-400 animate-pulse shadow-[0_0_20px_rgba(251,191,36,0.8)]') : 'bg-accent hover:bg-accent-hover text-slate-950'`;
code = code.replace(oldFab, newFab);

const oldHeader = `              <div className="flex items-center gap-3">
                <div className="bg-slate-800 p-2 rounded-xl relative">
                  <LogoIcon className="w-5 h-5 text-accent relative z-10" />
                  {isSpeaking && (
                    <span className="absolute inset-0 rounded-xl bg-accent animate-ping opacity-50"></span>
                  )}
                  {isListeningVoice && !isSpeaking && voiceActivated && (
                    <span className="absolute inset-0 rounded-xl border-2 border-amber-400 animate-pulse"></span>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Shawn</h3>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-slate-400">Intelligent Business Partner</p>
                    {isSpeaking && <span className="flex h-2 items-center gap-0.5"><span className="w-1 h-2 bg-accent animate-bounce rounded-full" style={{animationDelay: '0ms'}}></span><span className="w-1 h-3 bg-accent animate-bounce rounded-full" style={{animationDelay: '75ms'}}></span><span className="w-1 h-2 bg-accent animate-bounce rounded-full" style={{animationDelay: '150ms'}}></span></span>}
                  </div>
                </div>
              </div>`;
const newHeader = `              <div className="flex items-center gap-3">
                <div className="bg-slate-800 p-2 rounded-xl relative">
                  <LogoIcon className="w-5 h-5 text-accent relative z-10" />
                  {isSpeaking && (
                    <span className="absolute inset-0 rounded-xl bg-accent animate-ping opacity-75 duration-500"></span>
                  )}
                  {voiceActivated && !isSpeaking && (
                    <span className="absolute inset-0 rounded-xl border-2 border-amber-400 animate-pulse"></span>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Shawn</h3>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-slate-400">{isSpeaking ? 'Speaking...' : (voiceActivated ? 'Listening...' : 'Intelligent Business Partner')}</p>
                    {isSpeaking && <span className="flex h-3 items-center gap-1 ml-2"><span className="w-1.5 h-full bg-accent animate-bounce rounded-full" style={{animationDelay: '0ms', animationDuration: '0.6s'}}></span><span className="w-1.5 h-full bg-accent animate-bounce rounded-full" style={{animationDelay: '150ms', animationDuration: '0.6s'}}></span><span className="w-1.5 h-full bg-accent animate-bounce rounded-full" style={{animationDelay: '300ms', animationDuration: '0.6s'}}></span></span>}
                  </div>
                </div>
              </div>`;
code = code.replace(oldHeader, newHeader);

fs.writeFileSync('src/components/Shawn.tsx', code);
