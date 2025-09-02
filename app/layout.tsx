import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Memory MCP Server",
  description: "Semantic memory server for AI agents",
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
