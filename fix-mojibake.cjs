const fs = require("fs");
const path = "src/app/components/SettingsPage.tsx";
let content = fs.readFileSync(path, "utf8");

// Restore ?? operator - "ì·¨ì" or "취소" was wrongly used to replace ??
content = content.replace(/\)\s*ì·¨ì\s*"/g, ') ?? "');
content = content.replace(/\)\s*취소\s*"/g, ') ?? "');
content = content.replace(/\]\s*ì·¨ì\s*"/g, '] ?? "');
content = content.replace(/\]\s*취소\s*"/g, '] ?? "');
content = content.replace(/(\w+)\s*ì·¨ì\s*"/g, '$1 ?? "');
content = content.replace(/(\w+)\s*취소\s*"/g, '$1 ?? "');

// Fix Korean display strings - replace mojibake with correct Korean
const fixes = [
  ["AI ì·¨ì?", "AI 모델"],
  ["ì·¨ìì·¨ì              ", "저장              "],
  ["ì·¨ìì·¨ìì·¨ìì·¨ì - ì·¨ìì·¨ì", "기억할 관심사 - 숨김"],
  ["ì·¨ìì·¨ìì·¨ìì·¨ìì·¨ì?", "언론사 연결상태"],
  ["ì·¨ìì·¨ì?", "새로고침"],
  ["ì·¨ìì·¨ìì·¨ì ì·¨ì", "스크랩한 기사"],
  ["ë¡ê·¸ì¸", "로그인"],
  ["ì·¨ì? ì·¨ì", "관리자"],
  ["ì·¨ìì·¨ì*/", "로그인*/"],
  ["ì·¨ìì·¨ìì·¨ìì·¨ì", "리포트 동기화"],
  ["ì·¨ì?", "관리자"],
  ["ì·¨ì ì·¨ìì·¨ìì·¨ì (lightweight-charts attributionLogo ì·¨ìì ì²´ ì­ì ì·¨ìì·¨ì)", "차트 라이브러리 (lightweight-charts attributionLogo 표시 필수)"],
  ["ì·¨ìì·¨ì?ì ì²´ ì­ì TradingView lightweight-chartsì·¨ìì·¨ìì·¨ìì·¨ìì·¨ì", "본 앱은 TradingView lightweight-charts를 사용합니다."],
];

for (const [from, to] of fixes) {
  content = content.split(from).join(to);
}

fs.writeFileSync(path, content, "utf8");
console.log("Fixed");
