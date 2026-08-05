fetch('http://localhost:3000/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      { role: 'user', parts: [{ text: 'Can you see a document called "Hub-mind Handbook"' }] }
    ],
    systemInstruction: "You are a helpful assistant",
    tools: [
      {
        functionDeclarations: [
          {
            name: "search_database",
            description: "Search across documents, clients, tasks, or meetings by keyword or context.",
            parameters: {
              type: "OBJECT",
              properties: {
                collection_name: { type: "STRING" },
                keyword: { type: "STRING" }
              },
              required: ["collection_name", "keyword"]
            }
          }
        ]
      }
    ]
  })
}).then(res => res.json()).then(console.log).catch(console.error);
