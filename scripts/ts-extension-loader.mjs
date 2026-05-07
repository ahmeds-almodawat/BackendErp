import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (
      error?.code !== "ERR_MODULE_NOT_FOUND" ||
      (!specifier.startsWith(".") && !specifier.startsWith("/")) ||
      !context.parentURL?.startsWith("file:")
    ) {
      throw error;
    }

    const requested = new URL(specifier, context.parentURL);
    const requestedPath = fileURLToPath(requested);
    const tsCandidates = specifier.endsWith(".js")
      ? [
          requestedPath.replace(/\.js$/, ".ts"),
          requestedPath.replace(/\.js$/, ".tsx"),
        ]
      : [`${requestedPath}.ts`, `${requestedPath}.tsx`];
    const sourcePath = tsCandidates.find((candidate) => existsSync(candidate));

    if (!sourcePath) {
      throw error;
    }

    return {
      url: pathToFileURL(sourcePath).href,
      shortCircuit: true,
    };
  }
}
