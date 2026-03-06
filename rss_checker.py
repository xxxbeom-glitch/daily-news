"""
국내 언론사 RSS 유효성 체크 스크립트
사용법: python rss_checker.py
"""

import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
import time
import json
from datetime import datetime

RSS_LIST = [
    # ── 한국경제 ──────────────────────────────
    ("한국경제",   "경제",  "https://www.hankyung.com/feed/economy"),
    ("한국경제",   "증권",  "https://www.hankyung.com/feed/finance"),
    ("한국경제",   "국제",  "https://www.hankyung.com/feed/international"),
    # ── 매일경제 ──────────────────────────────
    ("매일경제",   "경제",  "https://www.mk.co.kr/rss/30100041/"),
    ("매일경제",   "증권",  "https://www.mk.co.kr/rss/40300001/"),
    ("매일경제",   "국제",  "https://www.mk.co.kr/rss/30200030/"),
    # ── 서울경제 ──────────────────────────────
    ("서울경제",   "경제",  "https://www.sedaily.com/RSS/S1"),
    ("서울경제",   "증권",  "https://www.sedaily.com/RSS/S2"),
    ("서울경제",   "국제",  "https://www.sedaily.com/RSS/S5"),
    # ── 종합지 ───────────────────────────────
    ("조선일보",   "경제",  "https://www.chosun.com/arc/outboundfeeds/rss/category/economy/"),
    ("동아일보",   "경제",  "https://rss.donga.com/economy.xml"),
    ("중앙일보",   "경제",  "https://rss.joins.com/joins_economy_list.xml"),
    ("한겨레",    "경제",  "https://www.hani.co.kr/rss/economy/"),
    ("경향신문",   "경제",  "https://www.khan.co.kr/rss/rssdata/economy_news.xml"),
    # ── 경제·금융 전문 ─────────────────────────
    ("이데일리",   "경제",  "https://www.edaily.co.kr/rss/edaily_newsflash.xml"),
    ("머니투데이",  "전체",  "https://www.mt.co.kr/rss/mt_news_total.xml"),
    ("파이낸셜뉴스", "전체",  "https://www.fnnews.com/rss/fn_realtimeissue.xml"),
    ("헤럴드경제",  "경제",  "https://biz.heraldcorp.com/rss/market.xml"),
    ("아시아경제",  "경제",  "https://www.asiae.co.kr/rss/economy.htm"),
    ("연합인포맥스", "증시",  "https://news.einfomax.co.kr/rss/allArticle.xml"),
    ("뉴스1",    "경제",  "https://www.news1.kr/rss/economy.xml"),
    # ── 통신사 ───────────────────────────────
    ("연합뉴스",   "경제",  "https://www.yna.co.kr/rss/economy.xml"),
    ("연합뉴스",   "국제",  "https://www.yna.co.kr/rss/international.xml"),
    ("연합뉴스",   "증시",  "https://www.yna.co.kr/rss/market.xml"),
    ("뉴시스",    "경제",  "https://www.newsis.com/rss/economy/"),
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def check_rss(media, category, url):
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=10) as res:
            code = res.getcode()
            content = res.read()

        # XML 파싱
        try:
            root = ET.fromstring(content)
        except ET.ParseError:
            return "⚠️ ", f"HTTP {code} / XML 파싱 실패 (HTML 응답?)", 0, ""

        ns = {"atom": "http://www.w3.org/2005/Atom"}
        items = root.findall(".//item") or root.findall(".//atom:entry", ns)
        count = len(items)

        if count > 0:
            title_el = items[0].find("title")
            latest = ""
            if title_el is not None:
                latest = (title_el.text or "").strip()
                # CDATA 처리
                if latest.startswith("<![CDATA["):
                    latest = latest[9:-3]
                latest = latest[:40]
            return "✅ ", f"기사 {count}건 | 최신: {latest}", count, latest
        else:
            return "⚠️ ", "HTTP 200 / 기사 0건", 0, ""

    except urllib.error.HTTPError as e:
        return "❌ ", f"HTTP {e.code} {e.reason}", 0, ""
    except urllib.error.URLError as e:
        return "❌ ", f"연결 실패: {e.reason}", 0, ""
    except Exception as e:
        return "❌ ", f"예외: {str(e)[:60]}", 0, ""


def main():
    print(f"\n📡 국내 언론사 RSS 유효성 체크")
    print(f"🕐 실행시각: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 90)
    print(f"{'상태':<5} {'언론사':<10} {'카테고리':<7} {'결과'}")
    print("-" * 90)

    results = []
    for media, category, url in RSS_LIST:
        status, note, count, latest = check_rss(media, category, url)
        results.append({
            "status": status.strip(),
            "media": media,
            "category": category,
            "url": url,
            "note": note,
            "article_count": count,
            "latest_title": latest,
        })
        print(f"{status}[{media:<8}] {category:<5}  → {note}")
        time.sleep(0.3)  # 서버 부하 방지

    # 요약
    ok   = [r for r in results if r["status"] == "✅"]
    warn = [r for r in results if r["status"] == "⚠️"]
    fail = [r for r in results if r["status"] == "❌"]

    print("\n" + "=" * 90)
    print(f"✅ 정상: {len(ok)}개  |  ⚠️ 경고: {len(warn)}개  |  ❌ 실패: {len(fail)}개")

    if warn:
        print("\n⚠️  경고 목록 (수동 확인 필요):")
        for r in warn:
            print(f"  [{r['media']}] {r['category']}: {r['note']}")
            print(f"  → URL: {r['url']}")

    if fail:
        print("\n❌ 실패 목록 (URL 교체 필요):")
        for r in fail:
            print(f"  [{r['media']}] {r['category']}: {r['note']}")
            print(f"  → URL: {r['url']}")

    # 결과를 JSON으로 저장
    output_file = f"rss_check_result_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump({
            "checked_at": datetime.now().isoformat(),
            "summary": {"ok": len(ok), "warn": len(warn), "fail": len(fail)},
            "results": results
        }, f, ensure_ascii=False, indent=2)
    print(f"\n📄 결과 저장: {output_file}")

    # 정상 피드만 추출해서 출력
    print("\n✅ finance-news 앱에 사용 가능한 피드 목록:")
    print("-" * 90)
    for r in ok:
        print(f'  ("{r["media"]}", "{r["category"]}", "{r["url"]}"),')


if __name__ == "__main__":
    main()
