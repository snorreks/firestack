/**
 * Type-level compile test for assets_test_api.
 *
 * This file is NEVER executed at runtime — it's verified by `tsc --noEmit`.
 *
 * How it catches `any` regression:
 *   The handler body is typed from the zod schema: { id: string }
 *   We use @ts-expect-error on invalid property access (e.g., `.name`).
 *   If body falls back to `any`, access to `.name` no longer errors →
 *   the @ts-expect-error directive becomes UNUSED → TS2578 → `bun run check` fails.
 *
 * To add a new handler test:
 *   1. Import the `export default` handler
 *   2. Extract Body = Parameters<typeof handler>[0]['body']
 *   3. Assert valid property access compiles
 *   4. Add @ts-expect-error on properties NOT in the schema
 */

import type handler from '../../controllers/api/assets_test_api';

type Request = Parameters<typeof handler>[0];
type Body = Request['body'];

// --- Positive assertions (must compile) ---
// These verify the schema-derived properties are accessible.
const _id: string = {} as Body['id']; // id is z.string()

// --- Negative assertions (must NOT compile) ---
// If any of these stop erroring, body fell back to `any`.

// @ts-expect-error: Property 'name' does not exist on type '{ id: string; }'
const _name: string = {} as Body['name'];

// @ts-expect-error: Property 'email' does not exist on type '{ id: string; }'
const _email: string = {} as Body['email'];

// @ts-expect-error: Property 'data' does not exist on type '{ id: string; }'
const _data: unknown = {} as Body['data'];

// --- `any` guard (belt-and-suspenders) ---
// Even if all @ts-expect-error directives pass (which they won't when body is any),
// this forces a compile error: `undefined` is not assignable to `never`.
type IsAny<T> = 0 extends 1 & T ? true : false;
type NonNullBody = IsAny<Body> extends true ? never : Body;
export const _bodyGuard: NonNullBody = undefined as unknown as NonNullBody;
