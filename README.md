# 계약전야 — 전세 계약 위험 진단 서비스

전월세 계약 전 위험 신호를 진단하는 공공서비스형 웹앱.

## 시작 전 환경 변수 설정

```bash
cp .env.local.example .env.local
```

`.env.local`을 열고 API 키를 입력하세요:

| 변수명 | 발급처 | 용도 |
|---|---|---|
| `DATA_GO_KR_API_KEY` | [data.go.kr](https://www.data.go.kr) 일반 인증키 | 전월세/매매 실거래가, 건축물대장 |
| `VWORLD_APT_KEY` | [vworld.kr](https://vworld.kr) 개발자센터 | 공동주택 공시가격 |
| `VWORLD_INDVD_KEY` | [vworld.kr](https://vworld.kr) 개발자센터 | 개별주택 공시가격 |

> data.go.kr에서 각 API별 **활용신청**이 별도로 필요합니다.

## 실행

```bash
npm install
npm run dev
```

---

## Getting Started (Original)

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
