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
}).then(res => res.json()).then(async (data) => {
  const functionCallMsg = data.message;
  const functionRespMsg = {
    role: 'user',
    parts: [
      {
        functionResponse: {
          name: 'search_database',
          response: { status: 'success', items: [] },
          id: data.functionCalls[0].id
        }
      }
    ]
  };
  const secondRes = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'user', parts: [{ text: 'Can you see a document called "Hub-mind Handbook"' }] },
        functionCallMsg,
        functionRespMsg
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
  });
  console.log(await secondRes.json());
}).catch(console.error);
