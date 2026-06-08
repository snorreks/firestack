type Token =
  | { type: 'string'; value: string }
  | { type: 'number'; value: number }
  | { type: 'boolean'; value: boolean }
  | { type: 'null' }
  | { type: 'identifier'; value: string }
  | { type: 'openBrace' }
  | { type: 'closeBrace' }
  | { type: 'openBracket' }
  | { type: 'closeBracket' }
  | { type: 'colon' }
  | { type: 'comma' };

const isWhitespace = (c: string): boolean => c === ' ' || c === '\t' || c === '\n' || c === '\r';
const isDigit = (c: string): boolean => c >= '0' && c <= '9';
const isIdentifierStart = (c: string): boolean =>
  (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_' || c === '$';
const isIdentifierPart = (c: string): boolean => isIdentifierStart(c) || isDigit(c);

const tokenize = (source: string): Token[] => {
  const tokens: Token[] = [];
  let i = 0;

  while (i < source.length) {
    const c = source[i];

    // Whitespace
    if (isWhitespace(c)) {
      i++;
      continue;
    }

    // Single-line comment
    if (c === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }

    // Block comment
    if (c === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    // Trailing comma before close brace/bracket — skip
    if (c === ',' && i + 1 < source.length) {
      let j = i + 1;
      while (j < source.length && isWhitespace(source[j])) j++;
      if (source[j] === '}' || source[j] === ']') {
        i++; // skip the comma
        continue;
      }
    }

    // Strings (single-quoted, double-quoted, or backtick)
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      let value = '';
      i++;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\' && i + 1 < source.length) {
          value += source[i + 1];
          i += 2;
        } else {
          value += source[i];
          i++;
        }
      }
      i++; // skip closing quote
      tokens.push({ type: 'string', value });
      continue;
    }

    // Numbers
    if (c === '-' ? isDigit(source[i + 1]) : isDigit(c)) {
      let numStr = '';
      while (
        i < source.length &&
        (isDigit(source[i]) ||
          source[i] === '.' ||
          source[i] === '-' ||
          source[i] === 'e' ||
          source[i] === 'E')
      ) {
        numStr += source[i];
        i++;
      }
      tokens.push({ type: 'number', value: parseFloat(numStr) });
      continue;
    }

    // Keywords: true, false, null
    if (source.startsWith('true', i)) {
      tokens.push({ type: 'boolean', value: true });
      i += 4;
      continue;
    }
    if (source.startsWith('false', i)) {
      tokens.push({ type: 'boolean', value: false });
      i += 5;
      continue;
    }
    if (source.startsWith('null', i)) {
      tokens.push({ type: 'null' });
      i += 4;
      continue;
    }
    if (source.startsWith('undefined', i)) {
      // Treat undefined as null
      tokens.push({ type: 'null' });
      i += 9;
      continue;
    }

    // Identifiers (unquoted keys)
    if (isIdentifierStart(c)) {
      let value = '';
      while (i < source.length && isIdentifierPart(source[i])) {
        value += source[i];
        i++;
      }
      tokens.push({ type: 'identifier', value });
      continue;
    }

    // Punctuation
    switch (c) {
      case '{':
        tokens.push({ type: 'openBrace' });
        i++;
        break;
      case '}':
        tokens.push({ type: 'closeBrace' });
        i++;
        break;
      case '[':
        tokens.push({ type: 'openBracket' });
        i++;
        break;
      case ']':
        tokens.push({ type: 'closeBracket' });
        i++;
        break;
      case ':':
        tokens.push({ type: 'colon' });
        i++;
        break;
      case ',':
        tokens.push({ type: 'comma' });
        i++;
        break;
      default:
        // Unknown character — skip
        i++;
    }
  }

  return tokens;
};

type JsonValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | JsonValue[]
  | { [key: string]: JsonValue }
  | Record<string, unknown>;

/**
 * Safely parses a TypeScript object literal string into a plain object.
 * Only handles JSON-compatible values — no code execution, no expressions.
 * Unsupported constructs (function calls, template expressions, etc.) are
 * silently ignored, producing `undefined` for those values.
 *
 * @param source - Raw source text of a TS object literal
 * @returns Parsed object, or undefined on unparseable input
 */
export const parseOptionsObject = (source: string): Record<string, unknown> | undefined => {
  const tokens = tokenize(source);
  if (tokens.length === 0) {
    return {};
  }

  let pos = 0;

  const peek = (): Token | undefined => tokens[pos];
  const consume = (): Token => tokens[pos++];

  const parseValue = (expectingKey?: boolean): { value: JsonValue; isIdentifier?: boolean } => {
    const t = peek();
    if (!t) {
      return { value: undefined };
    }

    // String/number/boolean/null literal
    if (t.type === 'string') {
      consume();
      return { value: t.value };
    }
    if (t.type === 'number') {
      consume();
      return { value: t.value };
    }
    if (t.type === 'boolean') {
      consume();
      return { value: t.value };
    }
    if (t.type === 'null') {
      consume();
      return { value: undefined };
    }

    // Identifier (could be a key when expectingKey, or undefined reference when used as value)
    if (t.type === 'identifier') {
      consume();
      if (expectingKey) {
        return { value: t.value };
      }
      // Identifiers as values — treat as undefined (safe default)
      return { value: undefined };
    }

    // Object
    if (t.type === 'openBrace') {
      consume();
      const obj: Record<string, unknown> = {};

      while (peek() && peek()?.type !== 'closeBrace') {
        // Parse key
        const keyToken = peek();
        if (!keyToken) {
          break;
        }
        let key: string;

        if (keyToken.type === 'string') {
          consume();
          key = keyToken.value;
        } else if (keyToken.type === 'identifier') {
          consume();
          key = keyToken.value;
        } else {
          // Unexpected, skip
          consume();
          continue;
        }

        // Skip colon
        if (peek()?.type === 'colon') {
          consume();
        }

        // Parse value
        const { value } = parseValue();
        obj[key] = value as unknown;

        // Skip comma if present
        if (peek()?.type === 'comma') {
          consume();
        }
      }

      if (peek()?.type === 'closeBrace') {
        consume();
      }
      return { value: obj };
    }

    // Array
    if (t.type === 'openBracket') {
      consume();
      const arr: JsonValue[] = [];

      while (peek() && peek()?.type !== 'closeBracket') {
        const { value } = parseValue();
        arr.push(value);

        if (peek()?.type === 'comma') {
          consume();
        }
      }

      if (peek()?.type === 'closeBracket') {
        consume();
      }
      return { value: arr };
    }

    // Unknown — skip
    consume();
    return { value: undefined };
  };

  if (peek()?.type !== 'openBrace') {
    return undefined;
  }

  const result = parseValue();
  return result.value as Record<string, unknown>;
};
