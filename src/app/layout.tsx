import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Release Night · Ship with a clear record', description: 'A focused workspace for release checks, evidence, and confident shipping decisions.' };
export default function RootLayout({ children }: {
    children: React.ReactNode;
}) { return <html lang="en"><body>{children}</body></html>; }
