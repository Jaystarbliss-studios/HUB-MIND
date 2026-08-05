fetch('http://localhost:3000/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      { role: 'user', parts: [{ text: 'create a task for me called "buy milk"' }] }
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
}).then(res => res.json()).then(async data => {
  console.log("Model response:", data.message);
  
  if (data.functionCalls && data.functionCalls.length > 0) {
    const fnResponse = data.functionCalls.map(c => ({
      name: c.name,
      response: { status: 'success' },
      id: c.id
    }));
    
    let messages = [
      { role: 'user', parts: [{ text: 'create a task for me called "buy milk"' }] },
      data.message,
      { role: 'user', parts: fnResponse.map(r => ({ functionResponse: r })) }
    ];
    
    let res = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, systemInstruction: "You are a helpful assistant", tools: [] })
    });
    
    let secondData = await res.json();
    console.log("Final response:", secondData.text);
  }
}).catch(console.error);
