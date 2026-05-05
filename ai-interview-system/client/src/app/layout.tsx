import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Interview Pro | Master Your Interview',
  description: 'AI-powered interview preparation with real-time feedback, voice analysis, and adaptive questioning',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body bg-obsidian-950 text-white antialiased">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#0c0c40',
              color: '#fff',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              borderRadius: '12px',
              fontFamily: 'DM Sans, sans-serif',
            },
            success: {
              iconTheme: { primary: '#00ff9f', secondary: '#0c0c40' },
            },
            error: {
              iconTheme: { primary: '#ff4444', secondary: '#0c0c40' },
            },
          }}
        />
      </body>
    </html>
  );
}
