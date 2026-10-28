// What a form's server action sends back to the page: a message to show.
export type FormState = { ok: boolean; message: string } | null;

export const ok = (message: string): FormState => ({ ok: true, message });
export const fail = (message: string): FormState => ({ ok: false, message });
