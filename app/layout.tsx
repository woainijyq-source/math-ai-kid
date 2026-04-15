import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BrainPlay Prototype",
  description: "iPad-first AI-native prototype for children's thinking play",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
