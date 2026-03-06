const fs = require("fs");
const path = "src/app/components/SettingsPage.tsx";
let content = fs.readFileSync(path, "utf8");

// 1. Fix 데이터동기화 paragraph - replace any paragraph containing "Firebase"
content = content.replace(
  /(<p style=\{\{ fontSize: 12 \}\} className="text-white\/50 mt-1">\s*)([\s\S]*?)(\s*<\/p>)/g,
  (_, before, middle, after) => {
    if (middle.includes("Firebase")) {
      return before + "리포트를 Firebase에 동기화합니다. 동기화 후 다른 기기에서 불러올 수 있습니다." + after;
    }
    return before + middle + after;
  }
);
content = content.replace(
  /(ë°ì´í° ëê¸°í<\/p>\s*<p[^>]*>\s*)([^<]+)(\s*<\/p>)/,
  "$1리포트를 Firebase에 동기화합니다. 동기화 후 다른 기기에서 불러올 수 있습니다.$3"
);

// 2. Wrap 언론사 연결상태 section in {false && ( ... )}
// Find the section that has "ì¸ë¡ ì¬" or "언론사" - the one with setSourcesExpanded
const sourcesSectionStart = content.indexOf('{/* ê¸°ìµí  ê´ì¬ì¬');
if (sourcesSectionStart === -1) {
  // Try alternative pattern
  const alt = content.indexOf('<section className="mb-4">');
  // Find the section before API 설정
  const apiSection = content.indexOf('{/* API ');
  const sectionBeforeApi = content.lastIndexOf('<section className="mb-4">', apiSection);
  if (sectionBeforeApi !== -1) {
    // Wrap from sectionBeforeApi to the closing </section> before API
    const sectionEnd = content.indexOf('</section>', sectionBeforeApi) + '</section>'.length;
    const sectionContent = content.slice(sectionBeforeApi, sectionEnd);
    // Check if this is the sources section (has setSourcesExpanded)
    if (sectionContent.includes('setSourcesExpanded')) {
      content = content.slice(0, sectionBeforeApi) + '{false && (' + content.slice(sectionBeforeApi, sectionEnd) + ')}' + content.slice(sectionEnd);
    }
  }
}

// Simpler: wrap the specific section by finding unique markers
// The 언론사 section is between "기억할 관심사 - 숨김" comment and "API 설정" comment
const markers = [
  ['{/* ê¸°ìµí  ê´ì¬ì¬ - ì¨ê¹ */}', '{/* API ì¤ì  */}'],
  ['{/* ì¸ë¡ ì¬ ì°ê²°ìí */}', '{/* API ì¤ì  */}'],
];
for (const [startMark, endMark] of markers) {
  const s = content.indexOf(startMark);
  const e = content.indexOf(endMark);
  if (s !== -1 && e !== -1 && s < e) {
    const beforeSection = content.indexOf('<section', s);
    const sectionEnd = content.indexOf('</section>', beforeSection) + '</section>'.length;
    const insertPos = content.lastIndexOf('\n', beforeSection);
    content = content.slice(0, insertPos + 1) + '{false && (\n' + content.slice(insertPos + 1, sectionEnd) + '\n)}\n' + content.slice(sectionEnd);
    break;
  }
}

// 3. Wrap 관리자 section in {false && ( ... )}
const adminSection = content.indexOf('{/* ê´ë¦¬ì ì·¨ì */}');
if (adminSection === -1) {
  const adminAlt = content.indexOf('to="/settings/admin"');
  if (adminAlt !== -1) {
    const sectionStart = content.lastIndexOf('<section', adminAlt);
    const sectionEnd = content.indexOf('</section>', sectionStart) + '</section>'.length;
    content = content.slice(0, sectionStart) + '{false && (\n' + content.slice(sectionStart, sectionEnd) + '\n)}\n' + content.slice(sectionEnd);
  }
} else {
  const sectionStart = content.indexOf('<section', adminSection);
  const sectionEnd = content.indexOf('</section>', sectionStart) + '</section>'.length;
  content = content.slice(0, adminSection) + '{false && (\n' + content.slice(sectionStart, sectionEnd) + '\n)}\n' + content.slice(sectionEnd);
}

fs.writeFileSync(path, content, "utf8");
console.log("Done");
