const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

html = html.replace(
  /<title>Hub Mind<\/title>/,
  '<title>Hub Mind</title>\n    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />'
);

fs.writeFileSync('index.html', html);
