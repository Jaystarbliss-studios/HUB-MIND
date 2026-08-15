const fs = require('fs');
let code = fs.readFileSync('src/components/Shawn.tsx', 'utf8');

// 1. Add delete_task to tools
const oldTools = `        {
          name: "update_document",`;
const newTools = `        {
          name: "delete_task",
          description: "Delete a task by ID. Call this when the user explicitly asks to delete a specific task.",
          parameters: {
            type: "object",
            properties: {
              taskId: { type: "string", description: "The ID of the task to delete." }
            },
            required: ["taskId"]
          }
        },
        {
          name: "update_document",`;
code = code.replace(oldTools, newTools);

// 2. Handle delete_task in handleSend
const oldHandleSend = `            if (call.name === "update_document") {`;
const newHandleSend = `            if (call.name === "delete_task") {
              const taskId = args.taskId;
              if (taskId) {
                setPendingDeleteTask({ id: taskId });
                result = { status: "success", message: "Prompted user for confirmation before deleting." };
              } else {
                result = { status: "error", message: "Task ID missing." };
              }
            } else if (call.name === "update_document") {`;
code = code.replace(oldHandleSend, newHandleSend);


// 3. Add Modal UI for pendingDeleteTask
// I need to find the place to insert this. Let's put it right before the chat messages container.
// Or just absolute position it inside the modal.
const oldUI = `        {/* Chat Area */}`;
const newUI = `        {/* Chat Area */}
        {pendingDeleteTask && (
          <div className="absolute inset-x-0 bottom-20 z-50 p-4 m-4 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl flex flex-col items-center justify-center text-center">
            <h4 className="text-white font-bold mb-2">Confirm Deletion</h4>
            <p className="text-slate-300 text-sm mb-4">Are you sure you want to delete this task?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingDeleteTask(null)}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    await deleteDoc(doc(db, 'tasks', pendingDeleteTask.id));
                    setPendingDeleteTask(null);
                    setMessages(prev => [...prev, { role: 'model', parts: [{ text: "Task deleted successfully!" }] }]);
                    if (voiceActivatedRef.current) speakText("Task deleted successfully!");
                  } catch (e) {
                    console.error(e);
                  }
                }}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        )}`;
code = code.replace(oldUI, newUI);

fs.writeFileSync('src/components/Shawn.tsx', code);
