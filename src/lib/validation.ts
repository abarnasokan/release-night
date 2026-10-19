import { z } from 'zod';
export const mutationSchema = z.discriminatedUnion('action', [
    z.object({ action: z.literal('create'), title: z.string().trim().min(1).max(120), version: z.string().trim().min(1).max(80), ai: z.boolean() }),
    z.object({ action: z.literal('samples') }),
    z.object({ action: z.literal('version'), version: z.string().trim().min(1).max(80) }),
    z.object({ action: z.literal('ai'), enabled: z.boolean() }),
    z.object({ action: z.literal('add'), name: z.string().trim().min(1).max(160), required: z.boolean() }),
    z.object({ action: z.literal('record'), check_id: z.uuid(), result: z.enum(['pending', 'passed', 'failed']), evidence: z.string().max(4000), url: z.union([z.literal(''), z.url().max(2000).refine(u => /^https?:\/\//i.test(u), 'Use an HTTP or HTTPS URL')]), required: z.boolean() }),
    z.object({ action: z.literal('ship') }),
]);


