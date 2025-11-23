# 오늘의 국장: 개인화 주식 대시보드 (Personalized Stock Dashboard)

[![Documentation](https://img.shields.io/badge/📖-Documentation-blue)](https://docs.google.com/document/d/140_O0eGaRDloFZE8FHh0flYccWmB1o30j9PUTBHrmG0/edit?tab=t.0) [![Live Demo](https://img.shields.io/badge/🚀-Live%20Demo-brightgreen)](https://stockdashboard-e8gtedayc5bdgkch.koreacentral-01.azurewebsites.net/)

'오늘의 국장'은 국내 주식 시장에 관심 있는 투자자들을 위한 개인화 대시보드 웹 애플리케이션입니다. 다양한 시장 정보를 하나의 화면에서 직관적으로 파악하고, 사용자가 직접 대시보드를 커스터마이징하여 투자 효율을 높일 수 있도록 설계되었습니다.

## 🔗 바로가기 (Quick Links)

*   **라이브 데모 (Live Demo):** [애플리케이션 바로가기](https://your-live-server-url.com)
*   **프로젝트 명세서 (Docs):** [상세 명세서 보기](https://your-docs-url.com)

## 🚀 기술 스택 (Tech Stack)

본 프로젝트는 백엔드와 프론트엔드가 분리된 모던 웹 아키텍처로 구성되었습니다.

*   **백엔드 (Backend):**
    *   **Framework:** Spring Boot (Java)
    *   **Database:** MS SQL Server (사용자 정보와 주식 데이터를 위한 Multi-DataSource 구성)
    *   **Authentication:** Spring Security
*   **프론트엔드 (Frontend):**
    *   **Framework:** React.js
    *   **Development Env:** Vite
    *   **Layout:** `react-grid-layout`을 활용한 동적 그리드 시스템
    *   **Data Visualization:** `d3.js`를 이용한 인터랙티브 차트

## ✨ 주요 기능 (Features)

### 1. 대시보드 및 레이아웃 커스터마이징
*   **동적 그리드 시스템:** 드래그 앤 드롭으로 위젯의 위치와 크기를 자유롭게 변경할 수 있습니다.
*   **레이아웃 저장 및 복원:** 로그인 시 사용자가 설정한 레이아웃이 자동으로 복원됩니다.
*   **반응형 디자인:** 화면 크기에 따라 4/3/2열로 레이아웃이 자동 조정됩니다.
*   **체험 모드:** 비로그인 사용자도 샘플 대시보드를 통해 모든 기능을 체험해볼 수 있습니다.

### 2. 위젯 상세 기능
*   **트리맵 차트 (Treemap Chart):**
    *   전체/코스피/코스닥 시장별 등락 현황을 트리맵으로 시각화합니다.
    *   특정 섹터를 클릭하여 상세 종목을 확인할 수 있습니다.
*   **순위 테이블 (RankTable):**
    *   상승률, 거래량 등 다양한 기준으로 종목 순위를 실시간으로 확인할 수 있습니다.
    *   테이블에 표시될 컬럼과 너비를 직접 설정하고 저장할 수 있습니다.
*   **국내/글로벌 주식 차트 (KrxChartWidget & SymbolChartWidget):**
    *   국내 종목의 캔들 차트 및 거래량 정보를 제공합니다.
    *   TradingView 위젯을 통해 해외 주식 및 가상화폐 차트도 확인할 수 있습니다.
*   **다양한 보조 위젯:**
    *   **지표 텍스트 (TextWidget):** 코스피, 코스닥 등 주요 지수를 텍스트로 표시합니다.
    *   **메모장 (MemoWidget):** 간단한 메모를 작성하고 저장할 수 있습니다.
    *   **관심종목 (WatchlistWidget):** 나만의 관심 종목 리스트를 관리할 수 있습니다.

### 3. Known Issue
*   **코스피/코스닥 지표 차트가 휴일에는 작동하지 않음.

## 🔮 향후 개선 과제 (Future Plans)

*   **신규 위젯 타입 개발**
    *   **기술적 분석 위젯:** 이동평균선(MA), RSI, MACD 등 기술적 분석 지표를 시각화하는 차트 위젯을 추가하여 심층적인 분석을 지원할 계획입니다.
    *   **시장 데이터 위젯:** 주요 공시, 뉴스 피드, 환율 차트 등 시장 상황을 종합적으로 파악할 수 있는 위젯을 개발합니다.
    *   **포트폴리오 위젯:** 사용자가 자신의 보유 종목을 등록하고 수익률을 관리할 수 있는 개인 포트폴리오 기능을 추가합니다.
*   **외부 API 연동 기능**
    *   위젯 설정에 '데이터 소스 URL' 항목을 추가하여, 사용자가 직접 외부 3rd-party API로부터 JSON 데이터를 가져와 대시보드에서 시각화할 수 있도록 기능을 확장합니다.
