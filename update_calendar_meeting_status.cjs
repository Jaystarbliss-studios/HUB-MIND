const fs = require('fs');
let content = fs.readFileSync('src/pages/Calendar.tsx', 'utf8');

// The tiny badges in the calendar grid
const smallMeetingBadge = `
                      {dayMeetings.map(m => (
                        <div key={m.id} className={\`text-[10px] px-2 py-1 border rounded font-semibold truncate \${
                          m.status === 'in_session' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          m.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          m.status === 'canceled' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          m.status === 'rescheduled' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                          'bg-slate-800/50 text-slate-400 border-slate-700/50'
                        }\`}>
                          {format(parseISO(m.date), 'HH:mm')} {(m.status || 'Scheduled').replace('_', ' ')}
                        </div>
                      ))}
`;
content = content.replace(
  /\{\s*dayMeetings\.map\(m => \(\s*<div key=\{m\.id\} className="text-\[10px\] px-2 py-1 bg-blue-500\/10 text-blue-400 border border-blue-500\/20 rounded font-semibold truncate">\s*\{format\(parseISO\(m\.date\), 'HH:mm'\)\} Meeting\s*<\/div>\s*\)\)\s*\}/m,
  smallMeetingBadge.trim()
);

// The list in the popover
const popoverMeetingBadge = `
                              {dayMeetings.map(m => (
                                <Link to={\`/meetings/\${m.id}\`} key={m.id} className="flex flex-col gap-1.5 p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 transition-colors">
                                  <div className="flex items-center gap-3">
                                    <CalendarIcon className={\`w-4 h-4 shrink-0 \${
                                      m.status === 'in_session' ? 'text-blue-400' :
                                      m.status === 'completed' ? 'text-emerald-400' :
                                      m.status === 'canceled' ? 'text-red-400' :
                                      m.status === 'rescheduled' ? 'text-purple-400' :
                                      'text-slate-400'
                                    }\`} />
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-slate-200 truncate">{m.notesRaw.split('\\n')[0] || 'Meeting'}</p>
                                      <p className="text-xs text-slate-400">{format(parseISO(m.date), 'h:mm a')}</p>
                                    </div>
                                  </div>
                                  <span className={\`text-[10px] w-fit font-bold px-2 py-0.5 rounded uppercase tracking-wider \${
                                    m.status === 'in_session' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                    m.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                    m.status === 'canceled' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                    m.status === 'rescheduled' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                                    'bg-slate-800 text-slate-400 border border-slate-700'
                                  }\`}>
                                    {(m.status || 'scheduled').replace('_', ' ')}
                                  </span>
                                </Link>
                              ))}
`;
content = content.replace(
  /\{\s*dayMeetings\.map\(m => \(\s*<Link to=\{\`\/meetings\/\$\{m\.id\}\`\} key=\{m\.id\} className="flex items-center gap-3 p-2 rounded-lg bg-slate-800\/50 hover:bg-slate-800 border border-slate-700\/50 transition-colors">\s*<CalendarIcon className="w-4 h-4 text-blue-400 shrink-0" \/>\s*<div className="min-w-0">\s*<p className="text-sm font-medium text-slate-200 truncate">\{m\.notesRaw\.split\('\\n'\)\[0\] \|\| 'Meeting'\}<\/p>\s*<p className="text-xs text-slate-400">\{format\(parseISO\(m\.date\), 'h:mm a'\)\}<\/p>\s*<\/div>\s*<\/Link>\s*\)\)\s*\}/m,
  popoverMeetingBadge.trim()
);

fs.writeFileSync('src/pages/Calendar.tsx', content);
console.log('Updated Calendar.tsx meeting status rendering');
