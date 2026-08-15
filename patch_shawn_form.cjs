const fs = require('fs');
let code = fs.readFileSync('src/components/Shawn.tsx', 'utf8');

const oldForm = `                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSend();
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask Shawn..."
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-accent"
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || loading}
                      className="bg-accent hover:bg-accent-hover text-slate-950 p-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </form>`;

const newForm = `                  {interimTranscript && (
                    <div className="text-xs text-accent italic mb-2">Listening: {interimTranscript}</div>
                  )}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSend();
                    }}
                    className="flex gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => setVoiceActivated(!voiceActivated)}
                      className={\`p-2 rounded-xl transition-colors \${voiceActivated ? 'bg-amber-500/20 text-amber-500' : 'bg-slate-800 text-slate-400 hover:text-slate-300'}\`}
                      title={voiceActivated ? "Voice Mode Active" : "Enable Voice Mode"}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                    </button>
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={voiceActivated ? "Listening..." : "Ask Shawn..."}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-accent"
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || loading}
                      className="bg-accent hover:bg-accent-hover text-slate-950 p-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </form>`;

code = code.replace(oldForm, newForm);
fs.writeFileSync('src/components/Shawn.tsx', code);
