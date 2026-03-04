import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // 폰에서 접속 가능하도록 0.0.0.0 노출
    proxy: {
      // 공공데이터 API CORS 우회 (국내 지수)
      "/api/data-go-kr": {
        target: "https://apis.data.go.kr",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/data-go-kr/, ""),
      },
    },
  },
});
