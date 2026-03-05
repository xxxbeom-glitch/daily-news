import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0", // 폰/내부망 접속용 (192.168.x.x)
    port: 5173,
    proxy: {
      // 공공데이터 API CORS 우회 (국내 지수)
      "/api/data-go-kr": {
        target: "https://apis.data.go.kr",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/data-go-kr/, ""),
      },
      // Yahoo Finance CORS 우회 (오늘의 시장)
      "/api/yahoo": {
        target: "https://query1.finance.yahoo.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo/, ""),
      },
    },
  },
});
