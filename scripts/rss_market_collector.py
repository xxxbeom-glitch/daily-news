#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
미국 증시 장 종료 후 주요 매체의 '가장 최신' 시황 리포트만 수집
"""

import sys
import feedparser

# Windows 콘솔 UTF-8
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
from datetime import datetime, timezone, timedelta

# KST = UTC+9
KST = timezone(timedelta(hours=9))

# 대상 RSS 피드
FEEDS = [
    {"name": "CNBC Finance", "url": "https://www.cnbc.com/id/10000664/device/rss/rss.html"},
    {"name": "MarketWatch Top Stories", "url": "http://feeds.marketwatch.com/marketwatch/topstories/"},
    {"name": "Seeking Alpha Market News", "url": "https://seekingalpha.com/market_currents.xml"},
]

# 시황 관련 키워드 (제목에 하나라도 포함되면 채택)
MARKET_KEYWORDS = [
    "stock market", "wall street", "closing bell", "market recap",
    "market close", "dow", "s&p", "nasdaq", "market wrap",
    "after hours", "stocks", "market today", "trading",
    "market rally", "market sell", "fed", "inflation",
    "earnings", "quarterly", "economic",
]

def is_market_related(title: str) -> bool:
    """제목이 시황 관련인지 확인"""
    lower = title.lower()
    return any(kw in lower for kw in MARKET_KEYWORDS)


def parse_published(entry) -> str | None:
    """발행 시간을 KST 문자열로 변환"""
    for key in ("published_parsed", "updated_parsed"):
        t = getattr(entry, key, None)
        if t:
            try:
                dt = datetime(*t[:6], tzinfo=timezone.utc)
                kst = dt.astimezone(KST)
                return kst.strftime("%Y-%m-%d %H:%M KST")
            except (TypeError, ValueError):
                pass
    # fallback: published 문자열 그대로
    pub = getattr(entry, "published", None) or getattr(entry, "updated", None)
    return pub if pub else None


def get_title(entry) -> str:
    return getattr(entry, "title", "") or ""

def get_link(entry) -> str:
    return getattr(entry, "link", "") or ""


def pick_best_entry(entries: list) -> dict | None:
    """상위 3개 중 시황 키워드 매칭되는 가장 최신 글 선택"""
    top3 = entries[:3]
    for entry in top3:
        if is_market_related(get_title(entry)):
            return {
                "title": get_title(entry),
                "link": get_link(entry),
                "published": parse_published(entry),
            }
    # 키워드 매칭 없으면 첫 번째(가장 최신) 반환
    if top3:
        e = top3[0]
        return {
            "title": get_title(e),
            "link": get_link(e),
            "published": parse_published(e),
        }
    return None


def fetch_feed(name: str, url: str) -> dict | None:
    """피드에서 최적 항목 1개 추출"""
    try:
        parsed = feedparser.parse(url)
        entries = parsed.entries
        if not entries:
            return None
        item = pick_best_entry(entries)
        if item:
            item["source"] = name
            return item
    except Exception as e:
        print(f"[오류] {name}: {e}")
    return None


def main():
    print("=" * 70)
    print("해외 시황 - 장 마감 후 최신 리포트 수집")
    print("=" * 70)
    results = []
    for feed in FEEDS:
        row = fetch_feed(feed["name"], feed["url"])
        if row:
            results.append(row)
            print(f"\n[Source] {row['source']}")
            print(f"[Published] {row['published'] or '(없음)'}")
            print(f"[Title] {row['title']}")
            print(f"[Link] {row['link']}")
            print("-" * 70)
        else:
            print(f"\n[Source] {feed['name']}")
            print("(항목 없음)")
            print("-" * 70)
    return results


if __name__ == "__main__":
    main()
