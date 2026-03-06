const fs = require("fs");
const path = "src/app/components/SettingsPage.tsx";
let content = fs.readFileSync(path, "utf8");

// Restore ?? operator - only in expression context (between identifiers/values)
// Pattern: ".message " + (취소 or ì·¨ì) + " err" -> ".message ?? err"
content = content.replace(/\.message\s+취소\s+err/g, ".message ?? err");
content = content.replace(/\.message\s+취소\s+`/g, ".message ?? `");
content = content.replace(/\.code\s+취소\s+\(/g, ".code ?? (");

// Also handle mojibake form if present
content = content.replace(/\.message\s+ì·¨ì[^\s]*\s+err/g, ".message ?? err");
content = content.replace(/\.message\s+ì·¨ì[^\s]*\s+`/g, ".message ?? `");
content = content.replace(/\.code\s+ì·¨ì[^\s]*\s+\(/g, ".code ?? (");

fs.writeFileSync(path, content, "utf8");
console.log("Fixed ?? operators");
