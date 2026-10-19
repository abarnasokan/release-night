import Link from 'next/link';
export default function NotFound() { return <main className="standalone"><h1>Release not found.</h1><p>This release doesn’t exist or isn’t available to your account.</p><Link className="button primary" href="/releases">Back to releases</Link></main>; }
