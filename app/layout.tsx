import type { Metadata } from 'next';
import './main.css';

export const metadata: Metadata = {
  title: 'Social Skyline',
  description: 'Realtime Instagram skyline visualization with Redis-backed metrics.',
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
