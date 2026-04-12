import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NBA Bracket Betting",
  description: "Predict the NBA postseason, compete with friends",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-900 text-slate-100">
        {children}
      </body>
    </html>
  );
}
