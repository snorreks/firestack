// Type definitions for script functions

export type FirestackScriptContext = {
  projectId: string;
  flavor: string;
};

export type ScriptFunction = (context: FirestackScriptContext) => Promise<unknown>;
