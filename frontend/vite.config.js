import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // '/api'로 시작하는 모든 요청을 프록시합니다.
      '/api': {
        // 실제 API 서버 주소를 타겟으로 설정합니다.
        target: 'https://stockdashboard-e8gtedayc5bdgkch.koreacentral-01.azurewebsites.net/',
        // 다른 도메인으로 요청을 보낼 때, 요청 헤더의 'origin'을
        // 타겟의 origin으로 변경합니다. CORS 에러를 피하기 위해 필수입니다.
        changeOrigin: true,
        // rewrite 옵션은 여기서는 필요 없습니다. /api/market-data 요청이
        // 그대로 http://localhost:8080/api/market-data 로 전달되어야 합니다.
        // 만약 /api를 경로에서 제거하고 싶다면 rewrite: (path) => path.replace(/^\/api/, '') 를 추가합니다.
      },
    },
  },
})
