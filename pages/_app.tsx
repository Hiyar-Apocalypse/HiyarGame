import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useEffect } from 'react';
import { VT323 } from 'next/font/google';

const vt323 = VT323({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <main className={vt323.className}>
      <Component {...pageProps} />
    </main>
  );
}
