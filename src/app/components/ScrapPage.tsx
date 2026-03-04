import { useState, useEffect } from "react";
import { getScrapArticles } from "../utils/scrapStorage";
import { ArticleCard, ReaderViewModal } from "./KeywordNewsPage";
import type { RawRssArticle } from "../utils/fetchRssFeeds";

export function ScrapPage() {
  const [articles, setArticles] = useState<RawRssArticle[]>([]);
  const [readerArticle, setReaderArticle] = useState<RawRssArticle | null>(null);
  const [readerTranslate, setReaderTranslate] = useState(false);

  const load = () => setArticles(getScrapArticles());

  useEffect(() => {
    load();
  }, []);

  if (articles.length === 0) {
    return (
      <div className="px-4 py-6">
        <div className="bg-white/5 border border-white/8 rounded-[10px] px-5 py-6">
          <p className="text-white/60" style={{ fontSize: 14 }}>스크랩한 기사가 없습니다.</p>
          <p className="text-white/40 mt-2" style={{ fontSize: 12 }}>키워드 뉴스에서 북마크 아이콘을 눌러 기사를 스크랩하세요.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="px-4 py-6 pb-[120px]">
        <div className="flex items-center justify-between mb-4">
          <p className="text-white/50" style={{ fontSize: 13 }}>스크랩 {articles.length}건</p>
        </div>

        <div className="space-y-3">
          {articles.map((a) => (
            <ArticleCard
              key={a.link}
              article={a}
              onOpenReader={(art, translate) => {
                setReaderArticle(art);
                setReaderTranslate(translate);
              }}
              onUnscrap={load}
            />
          ))}
        </div>
      </div>

      {readerArticle && (
        <ReaderViewModal
          article={readerArticle}
          translate={readerTranslate}
          onClose={() => setReaderArticle(null)}
        />
      )}
    </>
  );
}
