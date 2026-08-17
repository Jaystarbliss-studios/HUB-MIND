const fs = require('fs');
let code = fs.readFileSync('src/components/Shawn.tsx', 'utf8');

const replacement = `
      // Loop to handle potential multiple turn function calls
      let currentMessages = formattedHistory;
      let finalResponseText = '';
      let currentActionPayload: any = undefined;
      
      let loopCount = 0;
      while (loopCount < 3) {
        loopCount++;
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: currentMessages,
            tools: [{ functionDeclarations: SHAWN_TOOLS_DECLARATIONS }],
            systemInstruction: contextPrompt,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to get AI response');
        }

        const data = await response.json();
        
        if (data.functionCalls && data.functionCalls.length > 0) {
          // Model returned function calls
          const functionResponses: any[] = [];
          
          currentMessages = [
            ...currentMessages,
            { role: 'model', parts: data.message?.parts || data.functionCalls.map(fc => ({ functionCall: { name: fc.name, args: fc.args, id: fc.id } })) }
          ];
          
          for (const fc of data.functionCalls) {
            const toolExec = await executeShawnTool(
              fc.name,
              fc.args,
              profile,
              (newPreferredName) => {
                if (updatePreferredName) updatePreferredName(newPreferredName);
              }
            );

            if (toolExec.actionPayload) {
              currentActionPayload = toolExec.actionPayload;
              if (currentActionPayload.type === 'navigate' && currentActionPayload.path) {
                navigate(currentActionPayload.path);
              }
            }

            functionResponses.push({
              functionResponse: {
                name: fc.name,
                response: toolExec.result,
                id: fc.id
              }
            });
          }
          
          currentMessages = [
            ...currentMessages,
            { role: 'user', parts: functionResponses }
          ];
          // Loop again with the function responses
          continue;
        } else {
          // Final text response
          finalResponseText = data.text || '';
          break;
        }
      }

      if (!finalResponseText) {
        finalResponseText = "Right then, done.";
      }

      const shawnMsgId = \`msg-\${Date.now() + 1}\`;
      const newShawnMsg: ChatMessage = {
        id: shawnMsgId,
        sender: 'shawn',
        text: finalResponseText,
        timestamp: new Date().toISOString(),
        parentMessageId: userMsgId,
        actionPayload: currentActionPayload,
      };
`;

code = code.replace(/const response = await fetch\('\/api\/chat'[\s\S]*?const newShawnMsg: ChatMessage = \{[\s\S]*?actionPayload,[\s\S]*?\};/m, replacement.trim());
fs.writeFileSync('src/components/Shawn.tsx', code);
