fetch('http://localhost:3000/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{ role: 'user', parts: [{ text: 'what do i have tomorrow?' }] }],
    systemInstruction: "Current Workspace Context:\n- Pending Tasks: None\n- Upcoming Meetings: None",
    tools: [
      {
        functionDeclarations: [
          { name: "create_document", description: "...", parameters: { type: "OBJECT", properties: { title: { type: "STRING" } } } },
          { name: "navigate_to", description: "...", parameters: { type: "OBJECT", properties: { path: { type: "STRING" } } } }
        ]
      }
    ]
  })
}).then(res => res.json()).then(console.log).catch(console.error);
