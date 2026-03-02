// Type definitions for script functions

export interface ScriptContext {
  projectId: string;
  flavor: string;
}

export type ScriptFunction = (context: ScriptContext) => Promise<unknown>;
