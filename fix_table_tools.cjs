const fs = require('fs');
let code = fs.readFileSync('src/components/documents/DocumentToolbar.tsx', 'utf8');

const tableToolsCode = `
      {editor.isActive('table') && (
        <div className="flex items-center gap-1 px-2 border-l border-slate-800 bg-accent/10 rounded-lg ml-2">
          <span className="text-xs font-semibold text-accent px-1">Table:</span>
          <ToolbarButton onClick={() => editor.chain().focus().addColumnBefore().run()} title="Add Column Before">
            <span className="text-[10px] font-bold">+C&lt;</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add Column After">
            <span className="text-[10px] font-bold">+C&gt;</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete Column">
            <span className="text-[10px] font-bold">-C</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().addRowBefore().run()} title="Add Row Before">
            <span className="text-[10px] font-bold">+R^</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().addRowAfter().run()} title="Add Row After">
            <span className="text-[10px] font-bold">+R_</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().deleteRow().run()} title="Delete Row">
            <span className="text-[10px] font-bold">-R</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().mergeCells().run()} title="Merge Cells">
            <span className="text-[10px] font-bold">Merge</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().splitCell().run()} title="Split Cell">
            <span className="text-[10px] font-bold">Split</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().deleteTable().run()} title="Delete Table">
            <span className="text-[10px] font-bold text-red-400">Del</span>
          </ToolbarButton>
        </div>
      )}
`;

code = code.replace(
  "      </div>\n    </div>",
  "      </div>\n" + tableToolsCode + "\n    </div>"
);

fs.writeFileSync('src/components/documents/DocumentToolbar.tsx', code);
