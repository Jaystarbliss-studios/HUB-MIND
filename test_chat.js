fetch('http://localhost:3000/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{ role: 'user', parts: [{ text: 'what do i have tomorrow?' }] }],
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
                title: { type: "STRING" }
              }
            }
          }
        ]
      }
    ]
  })
}).then(res => res.json()).then(console.log).catch(console.error);
