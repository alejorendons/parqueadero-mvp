import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Parqueo · Control de parqueadero',
  description: 'Entradas, salidas y caja de tu parqueadero en El Retiro, Antioquia.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-CO">
      <body className="antialiased">{children}</body>
    </html>
  );
}
