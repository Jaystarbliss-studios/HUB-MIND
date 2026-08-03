const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');
code = code.replace(
  /function getGreeting\(name: string\) \{[\s\S]*?export function Dashboard\(\)/,
  `function getGreeting(name: string) {
  const hour = new Date().getHours();
  
  if (hour >= 0 && hour < 5) {
    const greetings = [
      \`Welcome Midnight Owl, \${name}!\`,
      \`Working late, \${name}?\`,
      \`The world sleeps, but you conquer, \${name}.\`,
      \`Early wee hours, \${name}!\`,
      \`Still awake, \${name}?\`
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  } else if (hour >= 5 && hour < 12) {
    const greetings = [
      \`GOOD MORNING, \${name}!\`,
      \`Early work, \${name}?\`,
      \`Rise and shine, \${name}!\`,
      \`Ready to seize the day, \${name}?\`,
      \`A fresh start, \${name}!\`
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  } else if (hour >= 12 && hour < 17) {
    const greetings = [
      \`Afternoon! \${name}.\`,
      \`Keep up the momentum, \${name}!\`,
      \`Hope your day is going well, \${name}.\`,
      \`Afternoon hustle, \${name}!\`,
      \`Halfway there, \${name}!\`
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  } else if (hour >= 17 && hour < 21) {
    const greetings = [
      \`A cool evening, \${name}.\`,
      \`Good evening, \${name}!\`,
      \`Winding down the day, \${name}?\`,
      \`Evening productivity, \${name}!\`,
      \`Hope you had a great day, \${name}.\`
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  } else {
    const greetings = [
      \`Good night, \${name}!\`,
      \`Late night hustle, \${name}?\`,
      \`Nighttime productivity, \${name}!\`,
      \`Almost time to rest, \${name}.\`,
      \`Wrapping up the night, \${name}?\`
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }
}

export function Dashboard()`
);
fs.writeFileSync('src/pages/Dashboard.tsx', code);
