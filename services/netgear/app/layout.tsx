import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Netgear Discovery',
  description: 'A clear, mobile-friendly view of every switch port and VLAN on your AV network.',
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
