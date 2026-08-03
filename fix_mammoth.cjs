const fs = require('fs');
let code = fs.readFileSync('src/components/documents/ImportExportMenu.tsx', 'utf8');

const mammothCode = `
      } else if (file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const options = {
          convertImage: mammoth.images.imgElement(function(image) {
            return image.read("base64").then(function(imageBuffer) {
              return {
                src: "data:" + image.contentType + ";base64," + imageBuffer
              };
            });
          }),
          styleMap: [
            "p[style-name='Heading 1'] => h1:fresh",
            "p[style-name='Heading 2'] => h2:fresh",
            "p[style-name='Heading 3'] => h3:fresh",
            "p[style-name='Heading 4'] => h4:fresh",
            "p[style-name='Heading 5'] => h5:fresh",
            "p[style-name='Heading 6'] => h6:fresh",
            "p[style-name='Title'] => h1:fresh",
            "p[style-name='Subtitle'] => h2:fresh",
            "r[style-name='Strong'] => strong",
            "r[style-name='Emphasis'] => em",
            "p[style-name='Normal'] => p:fresh",
          ],
          includeDefaultStyleMap: true
        };
        const result = await mammoth.convertToHtml({ arrayBuffer }, options);
        editor.commands.setContent(result.value);
      } else {
`;

code = code.replace(
  /\} else if \(file\.name\.endsWith\('\.docx'\)\) \{[\s\S]*?\} else \{/,
  mammothCode.trim() + " else {"
);

fs.writeFileSync('src/components/documents/ImportExportMenu.tsx', code);
