/**
 * SettingsPage.tsx 내 손상된 한글(? 문자) 복구
 */
const fs = require("fs");
const path = require("path");
const filePath = path.join(__dirname, "src", "app", "components", "SettingsPage.tsx");

let content = fs.readFileSync(filePath, "utf8");

// [손상된 문자열, 올바른 한글] - 긴 패턴 먼저
const replacements = [
  ["API ?? ???? ?????. (.env? VITE_ANTHROPIC_API_KEY ?? VITE_OPENROUTER_API_KEY ??)", "API 키가 설정되지 않았습니다. (.env에 VITE_ANTHROPIC_API_KEY 또는 VITE_OPENROUTER_API_KEY 추가)"],
  ["API ?? ???? ?????. (.env? VITE_GEMINI_API_KEY ??)", "API 키가 설정되지 않았습니다. (.env에 VITE_GEMINI_API_KEY 추가)"],
  ["API ?? ???? ?????. (.env? VITE_OPENAI_API_KEY ??)", "API 키가 설정되지 않았습니다. (.env에 VITE_OPENAI_API_KEY 추가)"],
  ['loading === "pull" ? "???? ??" : "?????? ????"', 'loading === "pull" ? "가져오는 중…" : "클라우드에서 가져오기"'],
  ['loading === "push" ? "??? ??" : "????? ???"', 'loading === "push" ? "업로드 중…" : "클라우드에 업로드"'],
  ["?????? ??????", "클라우드에서 가져왔습니다"],
  ["Firebase? ?????? ????. (.env? VITE_FIREBASE_* ??)", "Firebase가 비활성화되어 있습니다. (.env에 VITE_FIREBASE_* 추가)"],
  ["??? ? ?? ?????. (?? > ???)", "로그인이 필요합니다. (설정 > 로그인)"],
  ["/** ??? ??? ?? */", "/** 리포트 동기화 버튼 */"],
  ["/** ??? ?? ? ?? ?? */", "/** 동기화 실패 시 확인 사항 */"],
  ["Firestore ??: users/{userId}? read, write ?? ??", "Firestore 규칙: users/{userId}에 read, write 권한 부여"],
  ["??? ???? URL(?? IP) ?? (?: 192.168.x.x)", "허용된 도메인에 URL(또는 IP) 추가 (예: 192.168.x.x)"],
  ["?? ?? ? ??? ??? (Firebase Console &gt; Authentication)", "규칙 저장 후 동기화 재시도 (Firebase Console &gt; Authentication)"],
  ["Firestore ?? 1MB ??: ???? ?? uploadedImages ?? ? ?????.", "Firestore 문서 1MB 제한: 리포트가 크면 uploadedImages 제외 후 저장됩니다."],
  ["???? ?? ??", "스크랩한 기사 보기"],
  ["??? ?? ? ?? ??", "동기화 실패 시 확인 사항"],
  ["PDF(ZIP)? ?? ????????? ????", "PDF(ZIP)을 Google Drive에 저장했습니다."],
  ["PDF(ZIP)????????????.", "PDF(ZIP)을 로컬에 저장했습니다."],
  ["?? ???? ?????. ?? ? ??? ? ????", "모든 리포트를 삭제합니다. 삭제 후 복구할 수 없습니다."],
  ["???? Firebase? ??????. ??? ? ?? ???? ???? ????.", "리포트를 Firebase에 동기화합니다. 동기화 후 다른 기기에서 불러올 수 있습니다."],
  ["?????? ??TradingView lightweight-charts??????", "Charts by TradingView lightweight-charts"],
  ["VPN ??? ??? API ??? ???? ???", "VPN 사용 또는 지역 제한 해제를 시도해 보세요."],
  ["??? ???? ?? ??", "홈으로"],
  ["???? ??? ", "리포트 "],
  ["PDF ?? ??", "PDF 생성 중…"],
  ["PDF(ZIP) ? ??? ??", "PDF(ZIP) 로컬 저장"],
  ["PDF(ZIP) ? ??? ?? ", "PDF(ZIP) Google Drive "],
  ["title={isCustom ? \"??\" : \"?? ??\"}", "title={isCustom ? \"삭제\" : \"선택 해제\"}"],
  ["<CheckCircle2 size={12} />???", "<CheckCircle2 size={12} />연결됨"],
  ["<XCircle size={12} />??", "<XCircle size={12} />실패"],
  ["??? ???", "데이터 동기화"],
  ["???? ????", "데이터 내보내기"],
  ["??? ????", "언론사 연결상태"],
  ["???? ??", "스크랩한 기사"],
  ["??? RSS", "커스텀 RSS"],
  ["AI ?? ??", "AI 모델 설정"],
  ["AI ??", "AI 모델"],
  ["API ??", "API 설정"],
  ["RSS ??", "RSS 소스"],
  ["placeholder=\"??\"", "placeholder=\"이름\""],
  ["PDF ??????", "PDF 생성 실패"],
  ["??????", "내보내기"],
  ["?? ?????? (lightweight-charts attributionLogo ???? ??????)", "Charts by TradingView"],
  ["??? ??", "관리자"],
  ["???", "로그인"],
];

for (const [from, to] of replacements) {
  content = content.split(from).join(to);
}

// 잘못된 치환 보정 (순서로 인한 오류)
content = content.split('return "로그인??"').join('return "할당량초과"');
content = content.split('return "API 설정?"').join('return "API 키오류"');
content = content.split('if (!msg) return "스크랩한 기사"').join('if (!msg) return "네트워크 오류"');
content = content.split('return "로그인?"').join('return "지역제한"');

// return 문 내 문자열 (정확한 매칭) - ? 는 \? 로 이스케이프
content = content.replace(/return "\?\?\?\?\s*\?\?"/g, 'return "네트워크 오류"');
content = content.replace(/return "\?\?\?\?\?"/g, 'return "할당량초과"');
content = content.replace(/return "API \?\?\?"/g, 'return "API 키오류"');
content = content.replace(/return "\?\?\?\?"/g, 'return "지역제한"');
content = content.replace(/return "\?\?\s*\?\?"/g, 'return "모델 오류"');
content = content.replace(/errors\.push\("\?\?"\)/g, 'errors.push("정상")');
content = content.replace(/msg\.slice\(0, 50\) \+ "\?"/g, 'msg.slice(0, 50) + "…"');

// alert
content = content.replace(
  /alert\(`\$\{remain\}`\)/,
  'alert(`새로고침은 5분에 한 번만 가능합니다. (${remain}분 후)`)'
);
content = content.replace(
  /alert\(`[^`]+remain[^`]+`\)/,
  'alert(`새로고침은 5분에 한 번만 가능합니다. (${remain}분 후)`)'
);

// 전체 삭제 다이얼로그 - 정확한 패턴
content = content.replace(
  />\s*\?\?\s*\?\?\s*<\/p>/,
  '>전체 삭제</p>'
);
content = content.replace(
  />\s*\?\?\s*\?\?\?\?\s*\?\?\?\?\?\?\?\s*\.\s*\?\?\s*\?\s*\?\?\?\s*\?\s*\?\?\?\?\s*\.\s*<\/p>/,
  '>모든 리포트를 삭제합니다. 삭제 후 복구할 수 없습니다.</p>'
);

// 버튼: 취소/삭제 - onClick으로 구분
const cancelBtn = />\s*\?\?\s*<\/button>\s*<button[\s\S]*?onClick=\{handleClearAllConfirm\}/;
if (cancelBtn.test(content)) {
  content = content.replace(
    /(onClick=\{handleClearAllCancel\}[\s\S]*?)>\s*\?\?\s*<\/button>(\s*<button[\s\S]*?onClick=\{handleClearAllConfirm\})/,
    '$1>취소</button>$2'
  );
}
content = content.replace(
  /(onClick=\{handleClearAllConfirm\}[\s\S]*?)>\s*\?\?\s*<\/button>/,
  '$1>삭제</button>'
);

// 저장 버튼
content = content.replace(
  /(onClick=\{handleSaveSelectedModel\}[\s\S]*?)>\s*\?\?\s*<\/button>/,
  '$1>저장</button>'
);

// 새로고침 버튼 (API 섹션, RSS 섹션)
content = content.replace(
  /(<RefreshCw size=\{14\} className=\{isChecking \? "animate-spin" : ""\} \/>)\s*\?\?\?\?/g,
  '$1\n              새로고침'
);

// API 상태 표시
content = content.replace(
  /(<CheckCircle2 size=\{14\} \/>)\s*\n\s*\?\?\?/g,
  '$1\n                    연결됨'
);
content = content.replace(
  /(<XCircle size=\{14\} \/>)\s*\n\s*\?\?/g,
  '$1\n                    실패'
);
content = content.replace(
  /\?\?\? :/g,
  '연결됨 :'
);
content = content.replace(
  /\?\?\?\? :/g,
  '지역제한 :'
);

// apiStatus.errorMessage.includes
content = content.replace(
  /apiStatus\.errorMessage\.includes\("\?\?\?\?"\)/g,
  'apiStatus.errorMessage.includes("지역제한")'
);

// 전체 삭제 / 내보내기 버튼 (false && 섹션)
content = content.replace(
  /(<Trash2 size=\{16\} \/>)\s*\n\s*\?\?\?\?\?\?/g,
  '$1\n            전체 삭제'
);
content = content.replace(
  /(<Download size=\{16\} \/>)\s*\n\s*\?\?\?\?\?\?/g,
  '$1\n              내보내기'
);

// 리포트 N개
content = content.replace(
  /\?\?\?\?\s*\?\?\?\s*\{sessions\.length\}\s*\?/g,
  '리포트 {sessions.length}개'
);

// 새로고침 (RSS 섹션 버튼)
content = content.replace(
  /(RefreshCw size=\{14\} className=\{isChecking \? "animate-spin" : ""\} \/>)\s*\n\s*\?\?\?\?/,
  '$1\n              새로고침'
);

fs.writeFileSync(filePath, content, "utf8");
console.log("Fixed SettingsPage.tsx");
