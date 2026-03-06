const fs = require("fs");
const path = "src/app/components/SettingsPage.tsx";
let content = fs.readFileSync(path, "utf8");

// 1. "모든 API 오류" -> "정상" (when all APIs OK - errors.length === 0)
content = content.replace(
  /if \(errors\.length === 0\) errors\.push\("[^"]+"\)/,
  'if (errors.length === 0) errors.push("정상")'
);

// 2. API status: "ê´ë¦¬ì" or "관리자" -> "연결됨" (ok) and "실패" (error)
// Match the pattern in the API status display
content = content.replace(
  /(\{apiStatus\[key\] === "ok" \? \([^)]+<CheckCircle2[^>]*\/>\s*)ê´ë¦¬ì/g,
  '$1연결됨'
);
content = content.replace(
  /(\{apiStatus\[key\] === "ok" \? \([^)]+<CheckCircle2[^>]*\/>\s*)관리자/g,
  '$1연결됨'
);
content = content.replace(
  /(:\s*\([^)]*<XCircle[^>]*\/>\s*)ê´ë¦¬ì/g,
  '$1실패'
);
content = content.replace(
  /(:\s*\([^)]*<XCircle[^>]*\/>\s*)관리자/g,
  '$1실패'
);

// Simpler: replace the exact lines - CheckCircle2 block gets "연결됨", XCircle block gets "실패"
content = content.replace(
  /<CheckCircle2 size=\{14\} \/>\s*\n\s*ê´ë¦¬ì/g,
  '<CheckCircle2 size={14} />\n                    연결됨'
);
content = content.replace(
  /<CheckCircle2 size=\{14\} \/>\s*\n\s*관리자/g,
  '<CheckCircle2 size={14} />\n                    연결됨'
);
content = content.replace(
  /<XCircle size=\{14\} \/>\s*\n\s*ê´ë¦¬ì/g,
  '<XCircle size={14} />\n                    실패'
);
content = content.replace(
  /<XCircle size=\{14\} \/>\s*\n\s*관리자/g,
  '<XCircle size={14} />\n                    실패'
);

// 3. ReportSyncFailureHint - replace entire component with correct Korean
const correctReportSyncFailureHint = `/** 동기화 실패 시 확인 사항 */
function ReportSyncFailureHint() {
  return (
    <details className="mt-2">
      <summary style={{ fontSize: 12 }} className="text-white/40 cursor-pointer hover:text-white/60">
        동기화 실패 시 확인 사항
      </summary>
      <ul style={{ fontSize: 11, lineHeight: 1.6 }} className="text-white/40 mt-2 pl-4 space-y-1 list-disc">
        <li>스크랩한 기사 보기</li>
        <li>Firestore 문서 1MB 제한: 리포트가 크면 uploadedImages 제외 후 저장됩니다.</li>
        <li>Firebase Console > Authentication > 허용된 도메인에 URL(또는 IP) 추가 (예: 192.168.x.x)</li>
        <li>{"Firestore 규칙: users/{userId}에 read, write 권한 부여"}</li>
        <li>규칙 저장 후 동기화 재시도 (Firebase Console > Authentication)</li>
      </ul>
    </details>
  );
}`;

// Find and replace ReportSyncFailureHint - match from /** to the closing }
const hintRegex = /\/\*\* [^*]+\*\/\s*function ReportSyncFailureHint\(\) \{[\s\S]*?^  \};/m;
if (hintRegex.test(content)) {
  content = content.replace(hintRegex, correctReportSyncFailureHint);
}

fs.writeFileSync(path, content, "utf8");
console.log("Fixed");
