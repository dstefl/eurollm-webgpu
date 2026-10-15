import { z } from 'zod';

export const MARKER = 'EUROLLM_READY';
export const ACCEPTANCE_PROMPT = 'Return marker EUROLLM_READY and minutes 60.';
export const ACCEPTANCE_SCHEMA = {
  type: 'object',
  properties: {
    marker: { type: 'string', enum: [MARKER] },
    minutes: { type: 'integer', enum: [60] },
  },
  required: ['marker', 'minutes'],
  additionalProperties: false,
};
const outputSchema = z.object({ marker: z.literal(MARKER), minutes: z.literal(60) }).strict();

export function checkAcceptance(raw) {
  try {
    const parsed = outputSchema.safeParse(JSON.parse(raw));
    return parsed.success
      ? { pass: true, value: parsed.data }
      : { pass: false, reason: 'The returned object did not match the requested values and schema.' };
  } catch {
    return { pass: false, reason: 'The response was not valid JSON.' };
  }
}
