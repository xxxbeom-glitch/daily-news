export interface IndexData {
  name: string;      // "S&P500", "KOSPI" 등
  value: string;     // "5,432.18"
  change: string;    // "-0.87%"
  changeAbs?: string; // "▼47.62"
  isUp: boolean;
}

export interface IssueItem {
  title: string;   // 1줄 제목
  body: string;    // 개조식·명사형 종결 (-음, -기, -함, -됨, 명사)
  changeRate?: string; // 종가 기준 등락률 "+8.4%" (빅테크 이슈용)
}

export interface StockMover {
  name: string;
  ticker: string;
  changeRate: string; // "+8.4%"
  isUp: boolean;
  reason: string;     // 1~2줄 이유
}

export interface EarningsItem {
  company: string;
  ticker: string;
  changeRate?: string; // 종가 기준 등락률 "+12.3%"
  result: string; // "EPS 예상 $2.10 / 실제 $2.34 (서프라이즈 +12%)"
}

export interface SourceRef {
  outlet: string;   // "Bloomberg"
  headline: string; // 기사 제목
}

// 국내 전용: 코스닥/코스피 각각 상승·하락 TOP3
export interface MarketMoversBlock {
  up: StockMover[];
  down: StockMover[];
  sources: SourceRef[];
}

export interface MarketSummaryData {
  date: string;               // "2026. 03. 04 (수)"
  regionLabel: string;        // "해외 시황 요약" | "국내 시황 요약"
  /** 오늘의 시황 총평 (Gemini 전용). 없으면 totalAssessmentError일 수 있음 */
  totalAssessment?: string;
  totalAssessmentError?: boolean;
  indices: IndexData[];
  indicesSources: SourceRef[];
  keyIssues: IssueItem[];         // 최대 10개
  keyIssuesSources: SourceRef[];
  stockMoversLabel: string;       // "S&P500" | "KOSPI" (해외용)
  moversUp: StockMover[];         // 해외용 TOP3
  moversDown: StockMover[];       // 해외용 TOP3
  moversSources: SourceRef[];
  /** 국내 전용: 코스피 기업 상승·하락 TOP3 */
  kospiMovers?: MarketMoversBlock;
  /** 국내 전용: 코스닥 대표·대장주 이슈 (에코프로, 셀리버리, 피엔티, 제넥신 등) */
  kosdaqIssuesLabel?: string;
  kosdaqIssues?: IssueItem[];
  kosdaqIssuesSources?: SourceRef[];
  bigTechLabel: string;           // "빅테크 & AI 기업 이슈" | "국내 시가총액 100위 기업 이슈"
  bigTechIssues: IssueItem[];
  bigTechSources: SourceRef[];
  geopoliticalLabel?: string;     // "국제 정세 이슈" (해외만)
  geopoliticalIssues?: IssueItem[];
  geopoliticalSources?: SourceRef[];
  earningsPast?: EarningsItem[];
  earningsUpcoming?: string[];
  earningsSources?: SourceRef[];
}

// Mock 시황 데이터 - 해외
export const mockMarketSummaryInternational: MarketSummaryData = {
  date: "2026. 03. 04 (수)",
  regionLabel: "해외 시황 요약",
  indices: [
    { name: "S&P500", value: "5,432.18", change: "+0.31%", changeAbs: "▲16.82", isUp: true },
    { name: "나스닥", value: "17,234.56", change: "+0.52%", changeAbs: "▲89.12", isUp: true },
    { name: "다우존스", value: "39,876.45", change: "-0.12%", changeAbs: "▼47.83", isUp: false },
    { name: "금", value: "2,156.30", change: "+0.18%", changeAbs: "▲3.89", isUp: true },
    { name: "은", value: "24.82", change: "-0.35%", changeAbs: "▼0.09", isUp: false },
  ],
  indicesSources: [
    { outlet: "Yahoo Finance", headline: "S&P500 closes higher on tech gains" },
    { outlet: "Yahoo Finance", headline: "Nasdaq rises as Nvidia leads rally" },
  ],
  keyIssues: [
    { title: "트럼프, 2차 인프라 법안 서명", body: "1조 달러 인프라 투자안 통과. 건설·원자재 주 긍정적 영향 예상." },
    { title: "반도체 지수, AI 수요 기대에 1.2% 상승", body: "엔비디아·AMD 실적 호조. 반도체 ETF 사상 최고치 경신." },
    { title: "FOMC, 3월 기준금리 동결", body: "인플레이션 둔화·고용 강세 지속. 연내 1~2회 인하 가능성." },
    { title: "원유 가격, OPEC+ 감산 유지에 상승", body: "수요 회복·공급 제한. WTI 80달러대 진입." },
    { title: "달러 강세, Fedspeak 강경론 반영", body: "조기 금리 인하 기대 약화. 주요 통화 대비 상승." },
  ],
  keyIssuesSources: [
    { outlet: "Bloomberg", headline: "Trump signs infrastructure bill" },
    { outlet: "Reuters", headline: "Semiconductor stocks hit record high" },
  ],
  stockMoversLabel: "M7 및 반도체주 등락율",
  moversUp: [
    { name: "엔비디아", ticker: "NVDA", changeRate: "+8.4%", isUp: true, reason: "AI 데이터센터 매출 급증·실적 서프라이즈." },
    { name: "팔란티어", ticker: "PLTR", changeRate: "+5.2%", isUp: true, reason: "정부 계약 확대 기대." },
    { name: "마이크론", ticker: "MU", changeRate: "+4.1%", isUp: true, reason: "HBM·메모리 수요 호조." },
    { name: "알파벳", ticker: "GOOGL", changeRate: "+2.1%", isUp: true, reason: "AI 검색·클라우드 성장." },
  ],
  moversDown: [
    { name: "테슬라", ticker: "TSLA", changeRate: "-3.2%", isUp: false, reason: "1분기 배송량 전망 하향. 중국 경쟁 심화." },
    { name: "애플", ticker: "AAPL", changeRate: "-1.8%", isUp: false, reason: "아이폰 판매 둔화 우려." },
    { name: "인텔", ticker: "INTC", changeRate: "-1.5%", isUp: false, reason: "파운드리 사업 투자 부담." },
  ],
  moversSources: [
    { outlet: "CNBC", headline: "Nvidia stock soars after earnings" },
  ],
  bigTechLabel: "빅테크 & AI 기업 이슈",
  bigTechIssues: [
    { title: "엔비디아(NVDA)", body: "4분기 데이터센터 매출 185억 달러. 예상 대비 12% 초과. 호퍼·블랙웰 수요 2026년까지 이어질 전망.", changeRate: "+8.4%" },
    { title: "마이크로소프트(MSFT)", body: "Azure AI 매출 YoY +31% 성장. 코파일럿 엔터프라이즈 배포 확대. 2분기 가속 예상.", changeRate: "+2.1%" },
    { title: "테슬라(TSLA)", body: "1분기 배송량 가이던스 하향. 중국 경쟁 심화·가격 경쟁 지속.", changeRate: "-3.2%" },
  ],
  bigTechSources: [
    { outlet: "TechCrunch", headline: "Nvidia data center revenue surges" },
  ],
  geopoliticalLabel: "국제 정세 이슈",
  geopoliticalIssues: [
    { title: "중·미 무역 협상 재개", body: "관세 인하·지적재산권 보호 논의. 양국 대표 워싱턴 회담." },
    { title: "ECB, 6월 금리인하 시사", body: "인플레이션 2% 근접. 점진적 완화 가능성 시사." },
    { title: "이스라엘-하마스 휴전 협상", body: "가자지구 인도주의 지원 확대. 협상 진전 모색." },
    { title: "러시아-우크라이나, 에너지 시설 타격", body: "유럽 천연가스 공급 불안. 에너지 가격 변동성." },
    { title: "태국, 디지털 노마드 비자 확대", body: "원격 근무자 유치. 동남아 디지털 허브 경쟁." },
  ],
  geopoliticalSources: [
    { outlet: "BBC", headline: "US-China trade talks resume" },
  ],
  earningsPast: [
    { company: "엔비디아", ticker: "NVDA", changeRate: "+8.4%", result: "EPS 예상 $2.10 / 실제 $2.34 (서프라이즈 +12%)" },
    { company: "Salesforce", ticker: "CRM", changeRate: "+3.2%", result: "수익 가이던스 상향, 클라우드 성장 가속됐음" },
  ],
  earningsUpcoming: [
    "3/5 (2): 코스트코, 브로드컴",
    "3/6 (2): MongoDB, Okta",
  ],
  earningsSources: [
    { outlet: "Bloomberg", headline: "Nvidia earnings beat estimates" },
  ],
};

// Mock 시황 데이터 - 국내 (코스닥·코스피 양식)
export const mockMarketSummaryDomestic: MarketSummaryData = {
  date: "2026. 03. 04 (수)",
  regionLabel: "한국 시장 뉴스",
  indices: [
    { name: "코스피", value: "2,734.52", change: "-0.24%", changeAbs: "▼6.58", isUp: false },
    { name: "코스닥", value: "875.32", change: "+0.41%", changeAbs: "▲3.57", isUp: true },
    { name: "코스피 200", value: "358.21", change: "-0.18%", changeAbs: "▼0.65", isUp: false },
  ],
  indicesSources: [
    { outlet: "한국경제 종합", headline: "코스피, 외국인 매수에도 소폭 하락" },
    { outlet: "한국경제 증권", headline: "코스닥 반도체주 강세" },
    { outlet: "매일경제", headline: "주요 지수 시황" },
  ],
  keyIssues: [
    { title: "이재명 대통령, 규제 샌드박스 5차 확대", body: "핀테크·모빌리티 12개 분야 신규 지정. 스타트업 투자 활성화 기대." },
    { title: "한국은행, 3월 기준금리 동결", body: "인플레이션 2% 근접. 연내 1~2회 인하 가능성 시사." },
    { title: "삼성전자, 갤럭시 S27 사전예약 호조", body: "AI 기능 강화 모델 출시. 소비자 관심 고조. 주가 0.8% 상승." },
    { title: "반도체 지수, HBM 수요 기대에 상승", body: "SK하이닉스·삼성전자 HBM3E 양산. 반도체 ETF 강세." },
    { title: "국내 2차전지, 북미 수주 확대", body: "테슬라·포드 공급 계약. 양극재·음극재 수출 증가." },
  ],
  keyIssuesSources: [
    { outlet: "매일경제", headline: "한국은행 기준금리 동결" },
    { outlet: "한국경제 종합", headline: "규제 샌드박스 확대" },
    { outlet: "SBS", headline: "갤럭시 S27 사전예약" },
  ],
  stockMoversLabel: "",
  moversUp: [],
  moversDown: [],
  moversSources: [],
  bigTechLabel: "국내 시가총액 상위 기업 이슈",
  bigTechIssues: [
    { title: "삼성전자(005930)", body: "갤럭시 S27 사전예약 1일 100만 대 돌파. AI 번역·챗봇 기능 강화가 차별점.", changeRate: "+2.1%" },
    { title: "SK하이닉스(000660)", body: "HBM3E 양산 본격화. 주가 강세. AI 서버 수요 확대로 2026년 실적 기대.", changeRate: "+1.8%" },
    { title: "현대차(005380)", body: "美 전기차 관세 발표. 北미 수출 전망 우려. 내수 판매 안정. 소폭 조정.", changeRate: "-1.5%" },
  ],
  bigTechSources: [
    { outlet: "SBS", headline: "갤럭시 S27 AI 기능 주목" },
    { outlet: "한국경제 증권", headline: "하이닉스 HBM 양산" },
    { outlet: "매일경제", headline: "현대차 美 관세" },
  ],
};
