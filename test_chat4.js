fetch('http://localhost:3000/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      { role: 'user', parts: [{ text: 'create a task for me called "buy milk"' }] },
      { role: 'model', parts: [{ functionCall: { name: 'create_task', args: { title: 'buy milk' }, id: 'call123' } }] },
      { role: 'user', parts: [{ functionResponse: { name: 'create_task', response: { status: 'success' }, id: 'call123' } }] }
    ],
    systemInstruction: "You are a helpful assistant",
    tools: [
      {
        functionDeclarations: [
          {
            name: "create_task",
            description: "Creates a new task.",
            parameters: {
              type: "OBJECT",
              properties: {
                title: { type: "STRING" },
                description: { type: "STRING" }
              }
            }
          }
        ]
      }
    ]
  })
}).then(res => res.json()).then(console.log).catch(console.error);
