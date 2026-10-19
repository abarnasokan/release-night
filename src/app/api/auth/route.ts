import { NextRequest, NextResponse } from 'next/server';
import { configured, supabase } from '@/lib/supabase/server';
import { z } from 'zod';
export async function POST(request: NextRequest) {
    if (request.headers.get('origin') !== request.nextUrl.origin)
        return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    if (!configured())
        return NextResponse.json({ error: 'Set the Supabase environment variables to enable accounts.' }, { status: 503 });
    const db = await supabase();
    try {
        const body = await request.json();
        if (body.action === 'logout') {
            const { error } = await db.auth.signOut();
            if (error)
                throw error;
            return NextResponse.json({ ok: true });
        }
        const input = z.object({ email: z.email(), password: z.string().min(8).max(128), action: z.enum(['login', 'signup']) }).parse(body);
        const { data, error } = input.action === 'signup' ? await db.auth.signUp({ email: input.email, password: input.password, options: { emailRedirectTo: `${request.nextUrl.origin}/auth/confirm` } }) : await db.auth.signInWithPassword({ email: input.email, password: input.password });
        if (error)
            return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ confirmation: !data.session });
    }
    catch {
        return NextResponse.json({ error: 'Enter a valid email and a password with at least 8 characters.' }, { status: 400 });
    }
}
