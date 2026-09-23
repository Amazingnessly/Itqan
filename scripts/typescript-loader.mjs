import { access, readFile } from "node:fs/promises";
import ts from "typescript";

const TYPESCRIPT_EXTENSION = /\.tsx?$/;
const EXPLICIT_MODULE_EXTENSION = /\.[cm]?[jt]sx?$/;
const TYPESCRIPT_CANDIDATES = [".ts", ".tsx", "/index.ts", "/index.tsx"];

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !EXPLICIT_MODULE_EXTENSION.test(specifier)) {
    for (const suffix of TYPESCRIPT_CANDIDATES) {
      const candidate = new URL(`${specifier}${suffix}`, context.parentURL);
      try {
        await access(candidate);
        return { url: candidate.href, shortCircuit: true };
      } catch {
        // Keep looking; unresolved imports are reported by Node below.
      }
    }
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".json")) {
    const source = await readFile(new URL(url), "utf8");
    return { format: "module", source: `export default ${source}`, shortCircuit: true };
  }

  if (!TYPESCRIPT_EXTENSION.test(url)) return nextLoad(url, context);

  const source = await readFile(new URL(url), "utf8");
  const transpiled = ts.transpileModule(source, {
    fileName: new URL(url).pathname,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });

  return { format: "module", source: transpiled.outputText, shortCircuit: true };
}
