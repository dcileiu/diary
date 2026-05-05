import {
  parse,
  parseExpressionAt,
  type Expression,
  type Node,
  type Program,
} from "acorn";

type ScriptHelper = (...args: unknown[]) => unknown;

export type ScriptEvalOptions = {
  functions?: Record<string, ScriptHelper>;
  variables?: Record<string, unknown>;
};

const SCRIPT_TAG_REGEX = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
const NOT_FOUND = Symbol("script-data-not-found");

function isNode(value: unknown): value is Node {
  return !!value && typeof value === "object" && typeof (value as Node).type === "string";
}

function asRecord(value: unknown) {
  return value as Record<string, unknown>;
}

function asShape<T>(value: unknown) {
  return value as T;
}

function parseProgram(source: string) {
  try {
    return parse(source, {
      ecmaVersion: "latest",
      sourceType: "script",
      allowHashBang: true,
    });
  } catch {
    return null;
  }
}

function parseExpression(source: string) {
  const start = source.search(/\S/);
  if (start < 0) return null;
  try {
    const expression = parseExpressionAt(source, start, {
      ecmaVersion: "latest",
      sourceType: "script",
      allowHashBang: true,
    });
    const rest = source.slice(expression.end).replace(/^[;\s]+/g, "").trim();
    return rest ? null : expression;
  } catch {
    return null;
  }
}

function walkUntil(node: unknown, visitor: (current: Node) => unknown): unknown {
  if (!isNode(node)) return NOT_FOUND;

  const directResult = visitor(node);
  if (directResult !== NOT_FOUND) {
    return directResult;
  }

  for (const value of Object.values(asRecord(node))) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const nestedResult = walkUntil(item, visitor);
        if (nestedResult !== NOT_FOUND) {
          return nestedResult;
        }
      }
      continue;
    }
    const nestedResult = walkUntil(value, visitor);
    if (nestedResult !== NOT_FOUND) {
      return nestedResult;
    }
  }

  return NOT_FOUND;
}

function getPropertyName(node: unknown): string | null {
  if (!isNode(node)) return null;
  if (node.type === "Identifier") {
    return String(asShape<{ name: string }>(node).name);
  }
  if (node.type === "Literal") {
    const value = (node as { value?: unknown }).value;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "bigint"
    ) {
      return String(value);
    }
  }
  return null;
}

function getPath(node: unknown): string[] | null {
  if (!isNode(node)) return null;
  if (node.type === "Identifier") {
    return [String(asShape<{ name: string }>(node).name)];
  }
  if (node.type === "ThisExpression") {
    return ["this"];
  }
  if (node.type === "ChainExpression") {
    return getPath(asShape<{ expression: Node }>(node).expression);
  }
  if (node.type !== "MemberExpression") {
    return null;
  }

  const member = asShape<{
    object: Node;
    property: Node;
    computed: boolean;
  }>(node);
  const objectPath = getPath(member.object);
  if (!objectPath) return null;
  const propertyName = member.computed
    ? getPropertyName(member.property)
    : getPropertyName(member.property);
  if (!propertyName) return null;
  return [...objectPath, propertyName];
}

function pathEquals(actual: string[] | null, expected: string[][]) {
  if (!actual?.length) return false;
  return expected.some(
    (candidate) =>
      candidate.length === actual.length &&
      candidate.every((segment, index) => segment === actual[index]),
  );
}

function getLiteralValue(node: Node & { value?: unknown; bigint?: string }) {
  if (node.bigint) {
    return BigInt(node.bigint);
  }
  return node.value;
}

function getIdentifierValue(name: string, options: ScriptEvalOptions) {
  if (name === "undefined") return undefined;
  if (name === "NaN") return Number.NaN;
  if (name === "Infinity") return Number.POSITIVE_INFINITY;
  if (name === "window") return options.variables?.window ?? {};
  if (name === "globalThis") return options.variables?.globalThis ?? {};
  if (Object.prototype.hasOwnProperty.call(options.variables ?? {}, name)) {
    return options.variables?.[name];
  }
  return undefined;
}

function evaluateBinary(operator: string, left: unknown, right: unknown) {
  switch (operator) {
    case "+":
      return (left as never) + (right as never);
    case "-":
      return (left as never) - (right as never);
    case "*":
      return (left as never) * (right as never);
    case "/":
      return (left as never) / (right as never);
    case "%":
      return (left as never) % (right as never);
    case "**":
      return (left as never) ** (right as never);
    case "<<":
      return (left as never) << (right as never);
    case ">>":
      return (left as never) >> (right as never);
    case ">>>":
      return (left as never) >>> (right as never);
    case "|":
      return (left as never) | (right as never);
    case "^":
      return (left as never) ^ (right as never);
    case "&":
      return (left as never) & (right as never);
    case "==":
      return left == right;
    case "!=":
      return left != right;
    case "===":
      return left === right;
    case "!==":
      return left !== right;
    case "<":
      return (left as never) < (right as never);
    case "<=":
      return (left as never) <= (right as never);
    case ">":
      return (left as never) > (right as never);
    case ">=":
      return (left as never) >= (right as never);
    case "in":
      if (right == null || typeof right !== "object") {
        return false;
      }
      return (typeof left === "string" ||
        typeof left === "number" ||
        typeof left === "symbol"
        ? left
        : String(left ?? "")) in (right as object);
    default:
      throw new Error(`Unsupported binary operator: ${operator}`);
  }
}

function evaluateUnary(operator: string, argument: unknown) {
  switch (operator) {
    case "+":
      return +(argument as never);
    case "-":
      return -(argument as never);
    case "!":
      return !argument;
    case "~":
      return ~(argument as never);
    case "typeof":
      return typeof argument;
    case "void":
      return undefined;
    default:
      throw new Error(`Unsupported unary operator: ${operator}`);
  }
}

function evaluateMemberCall(
  callee: Node,
  args: unknown[],
  options: ScriptEvalOptions,
) {
  if (!isNode(callee) || callee.type !== "MemberExpression") {
    return NOT_FOUND;
  }
  const member = asShape<{
    object: Expression;
    property: Node;
    computed: boolean;
  }>(callee);
  const target = evaluateExpression(member.object, options);
  const methodName = member.computed
    ? String(evaluateExpression(member.property as Expression, options) ?? "")
    : getPropertyName(member.property) ?? "";

  if (Array.isArray(target) && methodName === "slice") {
    return target.slice(
      Number(args[0] ?? 0),
      args[1] == null ? undefined : Number(args[1]),
    );
  }

  if (target && typeof target === "object") {
    const method = (target as Record<string, unknown>)[methodName];
    if (typeof method === "function") {
      return method.apply(target, args);
    }
  }

  return NOT_FOUND;
}

export function evaluateExpression(
  expression: Expression,
  options: ScriptEvalOptions = {},
): unknown {
  switch (expression.type) {
    case "Literal":
      return getLiteralValue(expression as Node & { value?: unknown; bigint?: string });
    case "Identifier":
      return getIdentifierValue(
        String(asShape<{ name: string }>(expression).name),
        options,
      );
    case "TemplateLiteral": {
      const template = expression as {
        quasis: Array<{ value?: { cooked?: string | null; raw?: string } }>;
        expressions: Expression[];
      };
      let out = "";
      for (let index = 0; index < template.quasis.length; index += 1) {
        out += template.quasis[index]?.value?.cooked ?? template.quasis[index]?.value?.raw ?? "";
        if (template.expressions[index]) {
          out += String(evaluateExpression(template.expressions[index], options) ?? "");
        }
      }
      return out;
    }
    case "ArrayExpression": {
      const arrayNode = expression as {
        elements: Array<Expression | Node | null>;
      };
      return arrayNode.elements.map((item) => {
        if (!item) return undefined;
        if (isNode(item) && item.type === "SpreadElement") {
          return evaluateExpression(
            asShape<{ argument: Expression }>(item).argument,
            options,
          );
        }
        return evaluateExpression(item as Expression, options);
      });
    }
    case "ObjectExpression": {
      const objectNode = expression as {
        properties: Node[];
      };
      const out: Record<string, unknown> = {};
      for (const property of objectNode.properties) {
        if (!isNode(property)) continue;
        if (property.type === "SpreadElement") {
          const spreadValue = evaluateExpression(
            asShape<{ argument: Expression }>(property).argument,
            options,
          );
          if (spreadValue && typeof spreadValue === "object") {
            Object.assign(out, spreadValue);
          }
          continue;
        }
        if (property.type !== "Property") continue;
        const objectProperty = asShape<{
          key: Expression;
          value: Expression;
          kind: string;
          computed: boolean;
          shorthand: boolean;
        }>(property);
        if (objectProperty.kind !== "init") continue;
        const key = objectProperty.computed
          ? String(evaluateExpression(objectProperty.key, options) ?? "")
          : getPropertyName(objectProperty.key) ?? "";
        if (!key) continue;
        out[key] = objectProperty.shorthand
          ? getIdentifierValue(key, options)
          : evaluateExpression(objectProperty.value, options);
      }
      return out;
    }
    case "UnaryExpression": {
      const unary = expression as { operator: string; argument: Expression };
      return evaluateUnary(
        unary.operator,
        evaluateExpression(unary.argument, options),
      );
    }
    case "BinaryExpression": {
      const binary = expression as {
        operator: string;
        left: Expression;
        right: Expression;
      };
      return evaluateBinary(
        binary.operator,
        evaluateExpression(binary.left, options),
        evaluateExpression(binary.right, options),
      );
    }
    case "LogicalExpression": {
      const logical = expression as {
        operator: string;
        left: Expression;
        right: Expression;
      };
      const left = evaluateExpression(logical.left, options);
      switch (logical.operator) {
        case "&&":
          return left ? evaluateExpression(logical.right, options) : left;
        case "||":
          return left ? left : evaluateExpression(logical.right, options);
        case "??":
          return left ?? evaluateExpression(logical.right, options);
        default:
          throw new Error(`Unsupported logical operator: ${logical.operator}`);
      }
    }
    case "ConditionalExpression": {
      const conditional = expression as {
        test: Expression;
        consequent: Expression;
        alternate: Expression;
      };
      return evaluateExpression(conditional.test, options)
        ? evaluateExpression(conditional.consequent, options)
        : evaluateExpression(conditional.alternate, options);
    }
    case "CallExpression": {
      const call = expression as { callee: Node; arguments: Expression[] };
      const args = call.arguments.map((argument) =>
        evaluateExpression(argument, options),
      );
      const directName = getPath(call.callee)?.join(".");
      const helper =
        (directName && options.functions?.[directName]) ||
        (getPropertyName(call.callee) && options.functions?.[getPropertyName(call.callee)!]);
      if (helper) {
        return helper(...args);
      }
      const memberCall = evaluateMemberCall(call.callee, args, options);
      if (memberCall !== NOT_FOUND) {
        return memberCall;
      }
      throw new Error("Unsupported function call");
    }
    case "MemberExpression": {
      const member = expression as {
        object: Expression;
        property: Expression;
        computed: boolean;
      };
      const target = evaluateExpression(member.object, options);
      if (target == null) return undefined;
      const propertyName = member.computed
        ? String(evaluateExpression(member.property, options) ?? "")
        : getPropertyName(member.property) ?? "";
      return propertyName ? (target as Record<string, unknown>)[propertyName] : undefined;
    }
    case "ChainExpression":
      return evaluateExpression(
        asShape<{ expression: Expression }>(expression).expression,
        options,
      );
    case "SequenceExpression": {
      const sequence = expression as { expressions: Expression[] };
      let value: unknown;
      for (const item of sequence.expressions) {
        value = evaluateExpression(item, options);
      }
      return value;
    }
    case "ParenthesizedExpression":
      return evaluateExpression(
        asShape<{ expression: Expression }>(expression).expression,
        options,
      );
    default:
      throw new Error(`Unsupported expression type: ${expression.type}`);
  }
}

export function extractScriptContents(html: string) {
  const scripts = [...String(html || "").matchAll(SCRIPT_TAG_REGEX)].map(
    (match) => match[1] || "",
  );
  return scripts.length > 0 ? scripts : [String(html || "")];
}

export function extractExpressionValueFromText(
  text: string,
  options: ScriptEvalOptions = {},
) {
  const expression = parseExpression(String(text || "").trim());
  if (!expression) return undefined;
  try {
    return evaluateExpression(expression, options);
  } catch {
    return undefined;
  }
}

export function extractAssignedValueFromText(
  text: string,
  candidatePaths: string[][],
  options: ScriptEvalOptions = {},
) {
  const source = String(text || "");
  const program = parseProgram(source);
  if (!program) return undefined;

  const found = walkUntil(program, (node) => {
    if (node.type === "AssignmentExpression") {
      const assignment = asShape<{ left: Node; right: Expression }>(node);
      if (!pathEquals(getPath(assignment.left), candidatePaths)) {
        return NOT_FOUND;
      }
      try {
        return evaluateExpression(assignment.right, options);
      } catch {
        return NOT_FOUND;
      }
    }

    if (node.type === "VariableDeclarator") {
      const declarator = asShape<{ id: Node; init?: Expression | null }>(node);
      if (!declarator.init || !pathEquals(getPath(declarator.id), candidatePaths)) {
        return NOT_FOUND;
      }
      try {
        return evaluateExpression(declarator.init, options);
      } catch {
        return NOT_FOUND;
      }
    }

    return NOT_FOUND;
  });

  return found === NOT_FOUND ? undefined : found;
}

export function extractAssignedValueFromHtml(
  html: string,
  candidatePaths: string[][],
  options: ScriptEvalOptions = {},
) {
  for (const script of extractScriptContents(html)) {
    const value = extractAssignedValueFromText(script, candidatePaths, options);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}
