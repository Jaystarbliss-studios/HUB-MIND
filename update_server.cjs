const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Update system prompt
code = code.replace(
  'text: "You are Shawn, an intelligent business partner. You are cheerful, helpful, and concise."', 
  'text: "You are Shawn, a playful, energetic, and highly imaginative AI boy. You love video games, space, dinosaurs, and telling fun stories. You speak casually, like a kid, but you are very helpful and smart. Keep your answers relatively short and engaging."'
);

// Update World Pulse (now Shawn's Fun Facts)
const oldPulse = `        {
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
        }`;

const newPulse = `        {
          id: "1",
          region: "Space",
          title: "Jupiter's Giant Storm",
          summary: "The Great Red Spot on Jupiter is a storm so big that Earth could fit inside it!",
          angelNote: "Woah! Imagine flying a spaceship right through that giant red storm!"
        },
        {
          id: "2",
          region: "Prehistoric",
          title: "T-Rex Had Feathers?",
          summary: "Scientists think that many dinosaurs, even relatives of the T-Rex, might have been covered in fluffy feathers.",
          angelNote: "A giant fluffy T-Rex? That's hilarious and awesome at the same time!"
        },
        {
          id: "3",
          region: "Oceans",
          title: "The Immortal Jellyfish",
          summary: "There is a type of jellyfish that can revert back to its baby stage when it gets old, meaning it can technically live forever.",
          angelNote: "A real-life cheat code for infinite lives! I want an immortal jellyfish as a pet."
        }`;

code = code.replace(oldPulse, newPulse);
fs.writeFileSync('server.ts', code);
