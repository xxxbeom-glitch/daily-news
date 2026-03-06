const { execSync } = require("child_process");
const commits = ["669d54d", "76c4d8d", "60b8c5d", "d8c1bef", "dde4003"];
for (const c of commits) {
  try {
    const out = execSync(`git show ${c}:src/app/components/SettingsPage.tsx`, {
      encoding: "utf8",
      maxBuffer: 5 * 1024 * 1024,
    });
    const hasNullish = out.includes('?? ""') || out.includes("?? \"");
    const hasCancel = out.includes("취소");
    const hasMojibake = /ì·¨ì|ë¡ê·¸ì¸/.test(out);
    const sample = out.includes("AI 모델") ? "AI 모델" : out.includes("AI 취소") ? "AI 취소" : out.includes("AI ?") ? "AI ?..." : "?";
    console.log(`${c}: ??=${hasNullish} 취소=${hasCancel} mojibake=${hasMojibake} sample=${sample}`);
  } catch (e) {
    console.log(`${c}: error - ${e.message.slice(0, 50)}`);
  }
}
