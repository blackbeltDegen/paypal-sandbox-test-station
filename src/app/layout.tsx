import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PayPal Sandbox Test Station",
  description: "Test PayPal subscription flows end-to-end in the sandbox environment.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
