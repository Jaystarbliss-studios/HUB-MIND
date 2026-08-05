const tools = [
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
];

async function run() {
  const res = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'user', parts: [{ text: 'Can you see a document called "Hub-mind Handbook"' }] }
      ],
      systemInstruction: "You are a helpful assistant",
      tools
    })
  });
  const data = await res.json();
  if (data.error) {
    console.error("Error 1:", data.error);
    return;
  }
  console.log("First response:", JSON.stringify(data, null, 2));

  if (data.functionCalls) {
    const secondRes = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'user', parts: [{ text: 'Can you see a document called "Hub-mind Handbook"' }] },
          data.message,
          {
            role: 'user',
            parts: data.functionCalls.map(c => ({
              functionResponse: { name: c.name, response: { status: 'success', items: [] }, id: c.id }
            }))
          }
        ],
        systemInstruction: "You are a helpful assistant",
        tools
      })
    });
    const secondData = await secondRes.json();
    console.log("Second response:", JSON.stringify(secondData, null, 2));
  }
}
run();
