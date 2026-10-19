import { NextRequest, NextResponse } from 'next/server';
import { configured, supabase } from '@/lib/supabase/server';
import { mutationSchema } from '@/lib/validation';
export async function POST(request: NextRequest) {
    if (request.headers.get('origin') !== request.nextUrl.origin)
        return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    if (!configured())
        return NextResponse.json({ error: 'Configure Supabase to save releases.' }, { status: 503 });
    const db = await supabase();
    const { data: { user } } = await db.auth.getUser();
    if (!user)
        return NextResponse.json({ error: 'Your session expired. Sign in again.' }, { status: 401 });
    try {
        const raw = await request.json();
        const parsed = mutationSchema.safeParse(raw);
        if (!parsed.success)
            return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid form' }, { status: 400 });
        const { action, ...data } = parsed.data;
        if(action!=='create') return NextResponse.json({error:'Release progress and test edits are saved in this browser.'},{status:409});
        const { data: id, error } = await db.rpc('mutate_release', { p_action: action, p_release: raw.release_id ?? null, p_revision: raw.revision ?? null, p_data: data });
        if (error)
            return NextResponse.json({ error: error.message }, { status: 409 });
        return NextResponse.json({ id });
    }
    catch {
        return NextResponse.json({ error: 'Could not save. Check your connection and retry.' }, { status: 400 });
    }
}
