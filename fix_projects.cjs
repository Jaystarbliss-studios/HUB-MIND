const fs = require('fs');

let content = fs.readFileSync('src/pages/Projects.tsx', 'utf8');

const cnImport = `
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`;

content = content.replace(/export function Projects\(\) \{/, cnImport + '\nexport function Projects() {');
fs.writeFileSync('src/pages/Projects.tsx', content);
