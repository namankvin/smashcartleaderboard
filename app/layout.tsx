import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmashKart // Registration & Track Control",
  description:
    "SmashKart event control: register students and visitors, prepare three tracks and record race results.",
  keywords: ["robotics", "queue", "stopwatch", "mongodb", "nextjs", "competition"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}

