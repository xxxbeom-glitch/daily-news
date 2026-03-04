export interface IndexData {
  name: string;      // "S&P500", "KOSPI" 등
  value: string;     // "5,432.18"
  change: string;    // "-0.87%"
  changeAbs?: string; // "▼47.62"
  isUp: boolean;
}

export interface IssueItem {
  title: string;   // 1줄 제목
  body: string;    // 2줄 서술 (문체: "~했음", "~임")
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
  date: string;               // "2026-03-04 수요일"
  regionLabel: string;        // "해외 시황 요약" | "국내 시황 요약"
  indices: IndexData[];
  indicesSources: SourceRef[];
  keyIssues: IssueItem[];         // 최대 10개
  keyIssuesSources: SourceRef[];
  stockMoversLabel: string;       // "S&P500" | "KOSPI" (해외용)
  moversUp: StockMover[];         // 해외용 TOP3
  moversDown: StockMover[];       // 해외용 TOP3
  moversSources: SourceRef[];
  /** 국내 전용: 코스닥 기업 상승·하락 TOP3 (있으면 국내 양식) */
  kosdaqMovers?: MarketMoversBlock;
  /** 국내 전용: 코스피 기업 상승·하락 TOP3 */
  kospiMovers?: MarketMoversBlock;
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
  date: "2026-03-04 수요일",
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
    { title: "트럼프 대통령, 2차 인프라 법안 서명했음", body: "1조 달러 규모 인프라 투자안이 통과되며 건설·원자재 주에 긍정적 영향을 줄 것으로 예상됐음." },
    { title: "반도체 지수, AI 수요 기대에 1.2% 상승함", body: "엔비디아·AMD 실적 호조 소식에 반도체 ETF가 사상 최고치를 경신했음." },
    { title: "FOMC, 3월 기준금리 동결 유지했음", body: "인플레이션 둔화에도 고용 지표가 강했으며, 연내 1~2회 인하 가능성이 유지됐음." },
  ],
  keyIssuesSources: [
    { outlet: "Bloomberg", headline: "Trump signs infrastructure bill" },
    { outlet: "Reuters", headline: "Semiconductor stocks hit record high" },
  ],
  stockMoversLabel: "S&P500",
  moversUp: [
    { name: "엔비디아", ticker: "NVDA", changeRate: "+8.4%", isUp: true, reason: "AI 데이터센터 매출 급증, 실적 서프라이즈 발표했음." },
    { name: "팔란티어", ticker: "PLTR", changeRate: "+5.2%", isUp: true, reason: "정부 계약 확대 기대감에 상승했음." },
    { name: "슈퍼 마이크로", ticker: "SMCI", changeRate: "+4.1%", isUp: true, reason: "AI 서버 수요 예상치 상향에 따라 주가 강세임." },
  ],
  moversDown: [
    { name: "테슬라", ticker: "TSLA", changeRate: "-3.2%", isUp: false, reason: "1분기 배송량 전망 하향, 중국 경쟁 심화 우려됐음." },
    { name: "애플", ticker: "AAPL", changeRate: "-1.8%", isUp: false, reason: "아이폰 판매 둔화 우려에 소폭 하락했음." },
    { name: "인텔", ticker: "INTC", changeRate: "-1.5%", isUp: false, reason: "파운드리 사업 투자 부담 우려가 지속됐음." },
  ],
  moversSources: [
    { outlet: "CNBC", headline: "Nvidia stock soars after earnings" },
  ],
  bigTechLabel: "빅테크 & AI 기업 이슈",
  bigTechIssues: [
    { title: "엔비디아(NVDA)", body: "4분기 데이터센터 매출 185억 달러로 예상 대비 12% 초과했음. 호퍼·블랙웰 수요가 2026년까지 이어질 전망임.", changeRate: "+8.4%" },
    { title: "마이크로소프트(MSFT)", body: "Azure AI 매출 YoY +31% 성장했음. 코파일럿 엔터프라이즈 배포 확대로 2분기 가속 예상됐음.", changeRate: "+2.1%" },
  ],
  bigTechSources: [
    { outlet: "TechCrunch", headline: "Nvidia data center revenue surges" },
  ],
  geopoliticalLabel: "국제 정세 이슈",
  geopoliticalIssues: [
    { title: "중·미 무역 협상 재개됐음", body: "관세 인하와 지적재산권 보호 논의를 골자로 양국 대표가 워싱턴에서 회담했음." },
    { title: "ECB, 6월 금리인하 시사했음", body: "인플레이션 2% 근접에 따라 Draghi 후임자는 점진적 완화 가능성을 시사했음." },
  ],
  geopoliticalSources: [
    { outlet: "BBC", headline: "US-China trade talks resume" },
  ],
  earningsPast: [
    { company: "엔비디아", ticker: "NVDA", changeRate: "+8.4%", result: "EPS 예상 $2.10 / 실제 $2.34 (서프라이즈 +12%)" },
    { company: "Salesforce", ticker: "CRM", changeRate: "+3.2%", result: "수익 가이던스 상향, 클라우드 성장 가속됐음" },
  ],
  earningsUpcoming: [
    "내일(3/5): Costco(COST), Broadcom(AVGO)",
    "모레(3/6): MongoDB(MDB), Okta(OKTA)",
  ],
  earningsSources: [
    { outlet: "Bloomberg", headline: "Nvidia earnings beat estimates" },
  ],
};

// Mock 시황 데이터 - 국내 (코스닥·코스피 양식)
export const mockMarketSummaryDomestic: MarketSummaryData = {
  date: "2026-03-04 수요일",
  regionLabel: "국내 시황 요약",
  indices: [
    { name: "코스닥", value: "875.32", change: "+0.41%", changeAbs: "▲3.57", isUp: true },
    { name: "코스피", value: "2,734.52", change: "-0.24%", changeAbs: "▼6.58", isUp: false },
  ],
  indicesSources: [
    { outlet: "한국경제 종합", headline: "코스피, 외국인 매수에도 소폭 하락" },
    { outlet: "한국경제 증권", headline: "코스닥 반도체주 강세" },
    { outlet: "매일경제", headline: "주요 지수 시황" },
  ],
  keyIssues: [
    { title: "이재명 대통령, 규제 샌드박스 5차 확대 발표했음", body: "핀테크·모빌리티 등 12개 분야 신규 지정, 스타트업 투자 활성화 기대됐음." },
    { title: "한국은행, 3월 기준금리 동결 유지했음", body: "인플레이션 2% 근접에 따라 연내 1~2회 인하 가능성이 시사됐음." },
    { title: "삼성전자, 갤럭시 S27 사전예약 호조했음", body: "AI 기능 강화 모델 출시에 소비자 관심이 높았으며 주가가 0.8% 상승했음." },
    { title: "반도체 지수, HBM 수요 기대에 상승했음", body: "SK하이닉스·삼성전자 HBM3E 양산 소식에 반도체 ETF가 강세를 보였음." },
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
  kosdaqMovers: {
    up: [
      { name: "에코프로비엠", ticker: "247540", changeRate: "+12.3%", isUp: true, reason: "2차전지 양극재 수주 호조, 실적 기대감에 상승했음." },
      { name: "피엔티", ticker: "137400", changeRate: "+8.7%", isUp: true, reason: "AI 반도체 장비 수주 소식에 급등했음." },
      { name: "로보티즈", ticker: "108490", changeRate: "+6.2%", isUp: true, reason: "人형 로봇 수주 계약 발표에 매수세 몰렸음." },
    ],
    down: [
      { name: "셀리버리", ticker: "268600", changeRate: "-9.1%", isUp: false, reason: "실적 부진 전망에 매도세 몰렸음." },
      { name: "제넥신", ticker: "095700", changeRate: "-5.4%", isUp: false, reason: "임상 결과 미달 발표에 하락했음." },
      { name: "유니셈", ticker: "036200", changeRate: "-4.8%", isUp: false, reason: "분기 실적 컨센서스 하회 우려에 소폭 하락했음." },
    ],
    sources: [
      { outlet: "한국경제 증권", headline: "코스닥 강세주" },
      { outlet: "매일경제", headline: "에코프로비엠 급등" },
    ],
  },
  kospiMovers: {
    up: [
      { name: "삼성전자", ticker: "005930", changeRate: "+2.1%", isUp: true, reason: "HBM3E 양산 본격화, AI 반도체 수주 기대감임." },
      { name: "SK하이닉스", ticker: "000660", changeRate: "+1.8%", isUp: true, reason: "DDR5·HBM 시장 점유율 확대 전망에 상승했음." },
      { name: "네이버", ticker: "035420", changeRate: "+1.2%", isUp: true, reason: "커머스·광고 매출 회복 기대에 소폭 상승했음." },
    ],
    down: [
      { name: "현대차", ticker: "005380", changeRate: "-1.5%", isUp: false, reason: "美 관세 발표에 해외 수출 우려가 반영됐음." },
      { name: "기아", ticker: "000270", changeRate: "-1.2%", isUp: false, reason: "원료비 상승 우려에 연동해 하락했음." },
      { name: "POSCO홀딩스", ticker: "005490", changeRate: "-0.9%", isUp: false, reason: "철강 원자재 가격 하락에 소폭 하락했음." },
    ],
    sources: [
      { outlet: "한국경제 증권", headline: "삼성전자 HBM3E 양산 착수" },
      { outlet: "매일경제", headline: "현대차 美 관세 영향" },
    ],
  },
  bigTechLabel: "국내 시가총액 100위 기업 이슈",
  bigTechIssues: [
    { title: "삼성전자(005930)", body: "갤럭시 S27 사전예약 1일 100만 대 돌파했음. AI 번역·챗봇 기능 강화가 차별점으로 작용했음.", changeRate: "+2.1%" },
    { title: "SK하이닉스(000660)", body: "HBM3E 양산 본격화 소식에 주가 강세임. AI 서버 수요 확대로 2026년 실적 기대됐음.", changeRate: "+1.8%" },
    { title: "현대차(005380)", body: "美 전기차 관세 발표에 北미 수출 전망 우려됐음. 내수 판매는 안정적이라 소폭 조정에 그쳤음.", changeRate: "-1.5%" },
  ],
  bigTechSources: [
    { outlet: "SBS", headline: "갤럭시 S27 AI 기능 주목" },
    { outlet: "한국경제 증권", headline: "하이닉스 HBM 양산" },
    { outlet: "매일경제", headline: "현대차 美 관세" },
  ],
};
