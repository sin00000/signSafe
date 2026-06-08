import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "계약전야 — 전세 계약 위험 진단",
  description: "계약 전 전세사기 위험을 미리 확인하세요. 국토교통부 실거래가 기반 자동 분석 서비스.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
