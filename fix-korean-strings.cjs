const fs = require("fs");
const path = "src/app/components/SettingsPage.tsx";
let content = fs.readFileSync(path, "utf8");

// Map corrupted strings to correct Korean (file has "취소" where it should be other words)
// Based on context from the settings UI
const replacements = [
  ["AI 취소? 취소?", "AI 모델 설정"],
  ["AI 취소?", "AI 모델"],
  ["취소취소              ", "저장              "],
  ["취소취소취소취소 - 취소취소", "기억할 관심사 - 숨김"],
  ["취소취소취소취소취소?", "언론사 연결상태"],
  ["취소취소?", "새로고침"],
  ["취소취소취소 취소", "스크랩한 기사"],
  ["API 취소취소취소", "API 설정"],
  ["취소?", "연결됨"],  // for ok status - but "취소?" also used for "실패" in error case
  ["취소취소취소취소취소? 취소 취소", "스크랩한 기사 보기"],
  ["취소취소? 취소? ", "총 "],
  ["취소", "개"],  // for "N개 세션" - careful, this might over-replace
];

// Do more specific replacements first to avoid over-replacement
const specificReplacements = [
  ["AI 취소? 취소?", "AI 모델 설정"],
  ["AI 취소?", "AI 모델"],
  ["취소취소              ", "저장              "],
  ["취소취소취소취소 - 취소취소", "기억할 관심사 - 숨김"],
  ["취소취소취소취소취소?", "언론사 연결상태"],
  ["취소취소?", "새로고침"],
  ["취소취소취소 취소", "스크랩한 기사"],
  ["API 취소취소취소", "API 설정"],
  ["취소취소취소취소취소? 취소 취소", "스크랩한 기사 보기"],
  ["취소취소? 취소? {sessions.length}취소", "총 {sessions.length}개"],
  ["취소취소취소취소?*", "데이터 동기화*"],
  ["취소취소취소 Firebase 취소취소?전체 삭제취소취소?.", "리포트를 Firebase에 동기화합니다."],
  ["취소? 취소?", "데이터 동기화"],
  ["취소취소취소 취소", "스크랩한 기사"],
  ["취소?", "관리자"],
  ["취소 취소취소취소취소", "차트 라이브러리"],
  ["취소취소?전체 삭제TradingView lightweight-charts취소취소취소취소취소", "본 앱은 TradingView lightweight-charts를 사용합니다."],
  ["취소취소취소취소 - 취소취소", "데이터 전체 삭제 - 내보내기"],
  ["취소취소취소취소취소?", "전체 삭제"],
  ["취소취소취소취소", "내보내기"],
  ["VPN 취소? 취소? API 취소취소취소취소취소? 취소?", "VPN 사용 시 API 키 설정이 필요합니다."],
  ["취소?", "연결됨"],  // for API status ok - but we need "실패" for error
];

// Simpler: replace each unique pattern
const fixes = [
  ["AI 취소? 취소?", "AI 모델 설정"],
  ["AI 취소?", "AI 모델"],
  ["취소취소              ", "저장              "],
  ["취소취소취소취소 - 취소취소", "기억할 관심사 - 숨김"],
  ["취소취소취소취소취소?", "언론사 연결상태"],
  ["취소취소?", "새로고침"],
  ["취소취소취소 취소", "스크랩한 기사"],
  ["API 취소취소취소", "API 설정"],
  ["취소취소취소취소취소? 취소 취소", "스크랩한 기사 보기"],
  ["취소취소? 취소? ", "총 "],
  ["취소취소취소취소?*", "데이터 동기화*"],
  ["취소? 취소?", "데이터 동기화"],
  ["취소?", "관리자"],
  ["취소 취소취소취소취소 (lightweight-charts attributionLogo 취소전체 삭제취소취소)", "차트 라이브러리 (lightweight-charts attributionLogo 표시 필수)"],
  ["취소취소?전체 삭제TradingView lightweight-charts취소취소취소취소취소", "본 앱은 TradingView lightweight-charts를 사용합니다."],
  ["취소취소취소취소 - 취소취소", "데이터 전체 삭제 - 내보내기"],
  ["취소취소취소취소취소?", "전체 삭제"],
  ["취소취소취소취소", "내보내기"],
  ["취소취소취소 Firebase 취소취소?전체 삭제취소취소?. 취소취소전체 삭제? 전체 삭제? 전체 삭제전체 삭제취소취소", "리포트를 Firebase에 동기화합니다. 동기화 후 다른 기기에서 불러올 수 있습니다."],
  ["VPN 취소? 취소? API 취소취소취소취소취소? 취소?", "VPN 사용 시 API 키 설정이 필요합니다."],
];

// For status: "취소?" appears in both "연결됨" (ok) and "실패" (error) - same character
// We need context. Looking at the code: {status === "ok" ? <>...취소?</> : <>...취소?</>}
// So both show "취소?" - one should be "연결됨", one "실패". We can't replace both with same.
// Replace the first occurrence in ok branch with "연결됨" and in error branch with "실패"
// That's tricky with simple replace. Let me replace "취소?" with "연결됨" when it's in the ok branch - we'd need regex.
// Simpler: replace CheckCircle2's "취소?" with "연결됨" and XCircle's "취소?" with "실패"
content = content.replace(/<CheckCircle2[^>]*\/>취소\?/g, (m) => m.replace("취소?", "연결됨"));
content = content.replace(/<XCircle[^>]*\/>취소\?/g, (m) => m.replace("취소?", "실패"));

// For "ì§ìì íì" (지역제한) - that's different mojibake, leave for now
// For "apiStatus.gpt === "ok" ... ? "취소?" : "지역제한"" - the "취소?" should be "연결됨"
content = content.replace(/"취소\?" : "지역제한"/g, '"연결됨" : "지역제한"');

for (const [from, to] of fixes) {
  const before = content.length;
  content = content.split(from).join(to);
  if (content.length !== before) {
    console.log("Replaced:", JSON.stringify(from), "->", JSON.stringify(to));
  }
}

// Fix "취소" in "N개" - " {sessions.length}취소" -> " {sessions.length}개"
content = content.replace(/\{sessions\.length\}취소/g, "{sessions.length}개");

fs.writeFileSync(path, content, "utf8");
console.log("Done");
