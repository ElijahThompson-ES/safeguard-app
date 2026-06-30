import './globals.css';

export const metadata = {
  title: 'SafeGuard AI — Compliance Intelligence Platform',
  description: 'AI-powered workplace safety and OSHA compliance platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
