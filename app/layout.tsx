import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ROBO-ARENA // Competition Queue & Master Timer",
  description:
    "Next.js & MongoDB powered Robotics Competition management platform with live roll-no webhook, automated queueing, and multi-lane synchronized stopwatches.",
  keywords: ["robotics", "queue", "stopwatch", "mongodb", "nextjs", "competition"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#080c14] text-slate-100 cyber-grid selection:bg-cyan-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}

