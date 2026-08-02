const fs = require('fs');

let content = fs.readFileSync('src/pages/Calendar.tsx', 'utf8');

content = content.replace(
  /<p className="text-xs text-slate-400">\{format\(parseISO\(m\.date\), 'h:mm a'\)\}<\/p>\s*<\/div>\s*<\/div>\s*\)\)/g,
  '<p className="text-xs text-slate-400">{format(parseISO(m.date), \'h:mm a\')}</p>\n                                  </div>\n                                </Link>\n                              ))'
);

content = content.replace(
  /<p className="text-xs text-slate-400">\{t\.status\.replace\('_', ' '\)\}<\/p>\s*<\/div>\s*<\/div>\s*\)\)/g,
  '<p className="text-xs text-slate-400">{t.status.replace(\'_\', \' \')}</p>\n                                  </div>\n                                </Link>\n                              ))'
);

fs.writeFileSync('src/pages/Calendar.tsx', content);
