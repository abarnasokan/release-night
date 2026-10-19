import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import type { EmailOtpType } from '@supabase/supabase-js';
export async function GET(request: NextRequest) {
    const db = await supabase();
    const code = request.nextUrl.searchParams.get('code');
    const token_hash = request.nextUrl.searchParams.get('token_hash');
    const type = request.nextUrl.searchParams.get('type');
    if (code) {
        const { error } = await db.auth.exchangeCodeForSession(code);
        if (!error)
            return NextResponse.redirect(new URL('/releases', request.url));
    }
    if (token_hash && type === 'signup') {
        const { error } = await db.auth.verifyOtp({ token_hash, type: type as EmailOtpType });
        if (!error)
            return NextResponse.redirect(new URL('/releases', request.url));
    }
    return NextResponse.redirect(new URL('/login?error=Confirmation+link+expired.+Please+try+signing+in.', request.url));
}
