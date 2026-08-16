const fs = require('fs');
let code = fs.readFileSync('src/components/Shawn.tsx', 'utf8');

// 1. Text Replacements
code = code.replace(/Angel\b/g, 'Shawn');
code = code.replace(/angel\b/g, 'shawn');
code = code.replace(/ANGEL\b/g, 'SHAWN');

// For CSS Classes
code = code.replace(/stone/g, 'slate');
code = code.replace(/amber/g, 'teal');
code = code.replace(/yellow/g, 'emerald'); 
code = code.replace(/rose/g, 'indigo'); 
code = code.replace(/purple/g, 'blue'); 
code = code.replace(/zinc/g, 'slate'); 

// 2. Persona Changes
code = code.replace(/M\.D\. • Ph\.D\. • Korea · Nigeria · Ghana · SA · US · China · Japan/g, 'Space Explorer • Dino Expert • Best Friend');
code = code.replace(/M\.D\. • Ph\.D\. • Strategist/g, 'Playful • Curious • Buddy');
code = code.replace(/Direct • Loyal • Unscripted/g, 'Playful • Fun • Adventurous');
code = code.replace(/High-class, brilliant, and fiercely loyal conversational voice companion/g, 'A playful and imaginative voice companion');
code = code.replace(/Strategic Pushback/g, 'Playtime');
code = code.replace(/M\.D\. Insight/g, 'Dino Facts');

// 3. Brainstorm Studio (Scenarios) Replacements
const oldScenarios = `    {
      id: 'ceo-audit',
      title: 'CEO Pitch & Business Model Stress-Test',
      badge: 'Strategic Pushback',
      category: 'strategy',
      description:
        'Have Shawn analyze your product thesis, point out vulnerable assumptions, and calculate real leverage.',
      prompt:
        "Shawn, I want you to stress-test my current business strategy. Don't be a yes-woman—critique my revenue assumptions, point out blind spots, and tell me if I'm wasting capital.",
    },
    {
      id: 'talent-negotiation',
      title: 'High-Stakes Executive Negotiation Rehearsal',
      badge: 'Talent & Compensation',
      category: 'negotiation',
      description:
        'Roleplay a tough salary, equity, or client pitch negotiation with Shawn acting as the counterparty.',
      prompt:
        "Shawn, let's roleplay a high-stakes negotiation. You are a senior partner evaluating my contract terms. Push back hard on my pricing and see how I defend my value.",
    },
    {
      id: 'cross-border',
      title: 'Cross-Border Expansion (Asia • Africa • US)',
      badge: 'Multicultural Fluency',
      category: 'culture',
      description:
        'Tap into Shawn’s childhood and professional background spanning Korea, Nigeria, Ghana, South Africa, and the US.',
      prompt:
        "Shawn, looking across the markets you know intimately—from Seoul to Lagos, Accra, and New York—what are the key cultural and operational nuances I need to respect before expanding?",
    },
    {
      id: 'clinical-wellness',
      title: 'Clinical & Cognitive Endurance Audit',
      badge: 'M.D. Insight',
      category: 'wellness',
      description:
        'Review burnout prevention, focus architecture, and circadian energy cycles with your resident medical mind.',
      prompt:
        'Shawn, as a medical doctor and high-output strategist, audit my current routine. How do I sustain peak cognitive endurance and recovery without burning out?',
    },
    {
      id: 'unvarnished-truth',
      title: 'The Unvarnished Reality Check',
      badge: 'Direct & Honest',
      category: 'strategy',
      description:
        'Get raw, unfiltered feedback on a risky or questionable decision with no corporate fluff.',
      prompt:
        "Shawn, give me your 100% unvarnished, direct take on something I'm planning. If you think it's foolish or unprofitable, don't sugarcoat it—tell me straight.",
    },
    {
      id: 'witty-banter',
      title: 'High-Style Banter & Corny One-Liners',
      badge: 'Classy Wit',
      category: 'humor',
      description:
        'Lighten the mood with Shawn’s signature situational humor and playful teasing.',
      prompt:
        'Shawn, drop everything for a second. Give me your finest corny one-liner and tell me what interesting world news or observation has caught your eye today.',
    },`;

const newScenarios = `    {
      id: 'story-time',
      title: 'Epic Space Adventure',
      badge: 'Story Time',
      category: 'fun',
      description: 'Go on a wild imaginary adventure through the galaxy with Shawn.',
      prompt: "Shawn, let's pretend we're astronauts on a mission to Mars! What happens when our ship runs into an asteroid field?",
    },
    {
      id: 'dino-facts',
      title: 'Dinosaur Encyclopedia',
      badge: 'Cool Facts',
      category: 'fun',
      description: 'Ask Shawn to tell you the coolest and weirdest facts about dinosaurs.',
      prompt: "Shawn, what was the biggest dinosaur ever, and could it defeat a T-Rex?",
    },
    {
      id: 'joke-time',
      title: 'Silly Joke Battle',
      badge: 'Humor',
      category: 'fun',
      description: 'Take turns telling the silliest knock-knock jokes and puns.',
      prompt: "Shawn, I challenge you to a joke battle! Tell me your funniest knock-knock joke.",
    },
    {
      id: 'game-ideas',
      title: 'Invent a New Game',
      badge: 'Creative',
      category: 'fun',
      description: 'Brainstorm rules for a brand new game to play outside or inside.',
      prompt: "Shawn, let's invent a brand new game that uses a balloon, two pillows, and a timer. What are the rules?",
    },`;
code = code.replace(oldScenarios, newScenarios);

// Quick Scenario Chips
const oldChips = `[
                  {
                    label: 'Critique my business pitch',
                    prompt: "Shawn, I want your unfiltered opinion on my current business pitch. Point out where my assumptions fall flat.",
                  },
                  {
                    label: 'Tell me a corny one-liner',
                    prompt: "Shawn, drop your best corny one-liner and share a quick observation from your travels today.",
                  },
                  {
                    label: 'Audit my focus & endurance',
                    prompt: "Shawn, wearing your doctor's hat, how can I structure my recovery to avoid mental fatigue during high-stakes sprints?",
                  },
                  {
                    label: 'West Africa & Asia market check',
                    prompt: "Shawn, based on your multi-country background, what cultural intuition am I missing for cross-border expansion?",
                  },
                ]`;
const newChips = `[
                  {
                    label: 'Tell me a funny story',
                    prompt: "Shawn, tell me a really funny story about a penguin who learns to fly a helicopter.",
                  },
                  {
                    label: 'Space Facts!',
                    prompt: "Shawn, tell me the coolest fact you know about black holes.",
                  },
                  {
                    label: 'Let\\'s play a game',
                    prompt: "Shawn, let's play 20 questions! You think of an animal and I will guess what it is.",
                  },
                ]`;
code = code.replace(oldChips, newChips);

// Voice Profiles
const oldVoices = `[
              { id: 'Kore', label: 'Kore (Default)', desc: 'Refined, cultured, warm' },
              { id: 'Aoede', label: 'Aoede', desc: 'Melodic, sharp, confident' },
              { id: 'Zephyr', label: 'Zephyr', desc: 'Airy, energetic, playful' },
              { id: 'Fenrir', label: 'Fenrir', desc: 'Deep, resonant, grounded' },
            ]`;
const newVoices = `[
              { id: 'Puck', label: 'Puck (Default)', desc: 'Energetic, young, boyish' },
              { id: 'Aoede', label: 'Aoede', desc: 'Melodic, sharp, confident' },
              { id: 'Zephyr', label: 'Zephyr', desc: 'Airy, energetic, playful' },
              { id: 'Fenrir', label: 'Fenrir', desc: 'Deep, resonant, grounded' },
            ]`;
code = code.replace(oldVoices, newVoices);
code = code.replace(oldVoices, newVoices); // it appears twice in the file

// Wake word prompts
code = code.replace(/"I'm here\. What's on your mind\?"/g, '"Hey there! Ready to play?"');

// Other minor text replacements
code = code.replace(/Executive Consultation/g, 'Playtime Chat');
code = code.replace(/Strategy Hub/g, 'Fun Hub');
code = code.replace(/Global Pulse & Intelligence/g, "Shawn's Discoveries");
code = code.replace(/Cross-cultural market dispatches, clinical insights & situational wit from Shawn\./g, 'Cool facts about space, dinos, and the world from Shawn!');

// Icon changes (Crown -> Smile, etc.)
code = code.replace(/<Crown /g, '<Smile ');

fs.writeFileSync('src/components/Shawn.tsx', code);
