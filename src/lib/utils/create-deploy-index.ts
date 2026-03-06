import { writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

/**
 * Creates a temporary index file for a function.
 * @param inputFile The path to the function's source file.
 * @param tempDir The temporary directory to create the file in.
 * @param functionName The name of the function.
 * @returns The path to the temporary index file.
 */
export async function createTemporaryIndexFunctionFile(
  inputFile: string,
  tempDir: string,
  functionName: string
): Promise<string> {
  const temporaryFilePath = join(tempDir, `${functionName}.ts`);
  const importPath = relative(tempDir, inputFile);
  const code = `import * as func from "${importPath}";\nexport const ${functionName} = func.default;`;
  await writeFile(temporaryFilePath, code, 'utf-8');
  return temporaryFilePath;
}
