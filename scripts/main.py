#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
미국 증시 장 종료 후(한국시간 6시) 시황 리포트만 수집
- closing bell, market recap, market wrap 키워드 매칭
- 장 마감 시간대(5시~11시 KST) 발행 기사만 선별
"""

import sys
import feedparser
from datetime import datetime, timezone, timedelta

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

KST = timezone(timedelta(hours=9))

FEEDS = [
    {"name": "CNBC Finance", "url": "https://www.cnbc.com/id/10000664/device/rss/rss.html"},
    {"name": "MarketWatch Top Stories", "url": "http://feeds.marketwatch.com/marketwatch/topstories/"},
    {"name": "Seeking Alpha Market News", "url": "https://seekingalpha.com/market_currents.xml"},
]

# 시황 전용 키워드 (closing bell, market recap, market wrap)
MARKET_KEYWORDS = ["closing bell", "market recap", "market wrap"]

# 장 마감: 한국시간 6시. 수집 허용 창: 5시 ~ 11시 KST
MARKET_CLOSE_HOUR_START = 5
MARKET_CLOSE_HOUR_END = 11


def _kst_now():
    return datetime.now(KST)


def _market_close_date():
    """가장 최근 장 마감일 (한국시간 6시 기준)"""
    now = _kst_now()
    if now.hour >= 6:
        return now.date()
    return (now - timedelta(days=1)).date()


def is_market_related(title: str) -> bool:
    lower = title.lower()
    return any(kw in lower for kw in MARKET_KEYWORDS)


def parse_published_dt(entry) -> datetime | None:
    """발행 시간을 KST datetime으로"""
    for key in ("published_parsed", "updated_parsed"):
        t = getattr(entry, key, None)
        if t:
            try:
                dt = datetime(*t[:6], tzinfo=timezone.utc)
                return dt.astimezone(KST)
            except (TypeError, ValueError):
                pass
    return None


def format_published(dt: datetime | None, fallback: str | None = None) -> str:
    if dt:
        return dt.strftime("%Y-%m-%d %H:%M KST")
    return fallback or "(없음)"


def is_within_market_close_window(dt: datetime | None) -> bool:
    """장 마감 시간대(5시~11시 KST) 발행인지"""
    if not dt:
        return False
    target_date = _market_close_date()
    if dt.date() != target_date:
        return False
    return MARKET_CLOSE_HOUR_START <= dt.hour < MARKET_CLOSE_HOUR_END


def pick_best_entry(entries: list) -> dict | None:
    """1순위: 시황 키워드 + 장 마감 시간대 / 2순위: 시황 키워드만 (시간 무관)"""
    in_window = []
    keyword_only = []
    for entry in entries[:15]:
        title = getattr(entry, "title", "") or ""
        if not is_market_related(title):
            continue
        dt = parse_published_dt(entry)
        item = {
            "title": title,
            "link": getattr(entry, "link", "") or "",
            "published_dt": dt,
            "published": format_published(dt),
        }
        if is_within_market_close_window(dt):
            in_window.append(item)
        else:
            keyword_only.append(item)
    if in_window:
        return in_window[0]  # 가장 최신
    if keyword_only:
        best = keyword_only[0]
        best["time_note"] = "(시간대 미충족, 키워드만 매칭)"
        return best
    return None


def fetch_feed(name: str, url: str) -> dict | None:
    try:
        parsed = feedparser.parse(url)
        if not parsed.entries:
            return None
        item = pick_best_entry(parsed.entries)
        if item:
            item["source"] = name
            return item
    except Exception as e:
        print(f"[오류] {name}: {e}")
    return None


def main():
    target_date = _market_close_date()
    print("=" * 70)
    print("해외 시황 - 장 마감 후 시황 리포트 수집")
    print(f"(대상: {target_date} 05:00~11:00 KST, closing bell/market recap/market wrap)")
    print("=" * 70)
    for feed in FEEDS:
        row = fetch_feed(feed["name"], feed["url"])
        if row:
            note = row.get("time_note", "")
            print(f"\n[Source] {row['source']} {note}")
            print(f"[Published] {row['published']}")
            print(f"[Title] {row['title']}")
            print(f"[Link] {row['link']}")
        else:
            print(f"\n[Source] {feed['name']}")
            print("(항목 없음)")
        print("-" * 70)


if __name__ == "__main__":
    main()
