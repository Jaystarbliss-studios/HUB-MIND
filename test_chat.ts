import { SHAWN_TOOLS_DECLARATIONS } from './src/lib/shawnTools';

async function test() {
  const response = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{role: 'user', parts: [{text: 'What is overdue right now?'}]}],
      tools: [{ functionDeclarations: SHAWN_TOOLS_DECLARATIONS }],
      systemInstruction: 'You are Shawn',
    })
  });
  const data = await response.json();
  console.log(data);
}
test();
