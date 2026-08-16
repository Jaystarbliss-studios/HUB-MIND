const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const endpoints = `
  let memories = [];
  let conversations = [];

  app.get("/api/memories", (req, res) => {
    res.json({ memories });
  });

  app.post("/api/memories", (req, res) => {
    const memory = { id: Date.now().toString(), ...req.body, timestamp: new Date().toISOString() };
    memories.unshift(memory);
    res.json({ memory });
  });

  app.delete("/api/memories/:id", (req, res) => {
    memories = memories.filter(m => m.id !== req.params.id);
    res.json({ success: true });
  });

  app.get("/api/conversations", (req, res) => {
    res.json({ conversations });
  });

  app.post("/api/conversations", (req, res) => {
    const conversation = { id: Date.now().toString(), ...req.body, createdAt: new Date().toISOString() };
    conversations.unshift(conversation);
    res.json({ conversation });
  });

  app.delete("/api/conversations/:id", (req, res) => {
    conversations = conversations.filter(c => c.id !== req.params.id);
    res.json({ success: true });
  });

  app.get("/api/world-pulse", (req, res) => {
    res.json({
      pulse: [
        {
          id: "1",
          region: "Global",
          title: "AI in Enterprise Software",
          summary: "Companies are increasingly integrating AI directly into their core SaaS platforms.",
          angelNote: "A critical shift. We must ensure our AI features solve real problems, not just act as novelties."
        },
        {
          id: "2",
          region: "Asia Pacific",
          title: "Semiconductor Supply Shifts",
          summary: "Major investments are flowing into new semiconductor foundries across the APAC region.",
          angelNote: "This will alleviate long-term hardware bottlenecks, but short-term volatility remains."
        },
        {
          id: "3",
          region: "Europe",
          title: "New Data Privacy Frameworks",
          summary: "The EU is preparing stricter guidelines on AI data harvesting.",
          angelNote: "We need to audit our data pipelines proactively to stay ahead of compliance."
        }
      ]
    });
  });
`;

code = code.replace('  app.get("/api/config", (req, res) => {\n    res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || "" });\n  });', '  app.get("/api/config", (req, res) => {\n    res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || "" });\n  });\n' + endpoints);

fs.writeFileSync('server.ts', code);
