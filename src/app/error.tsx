'use client';
export default function ErrorPage({ reset }: {
    reset: () => void;
}) { return <main className="standalone"><h1>We couldn’t load this workspace.</h1><p>Your saved records are unchanged. Check your connection and try again.</p><button className="button primary" onClick={reset}>Try again</button></main>; }
