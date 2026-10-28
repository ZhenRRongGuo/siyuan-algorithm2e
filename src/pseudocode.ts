import { addScript, addStyle } from "./utils";
import { compileAlgorithm2e } from "./algorithm2e";

export function initPseudocode(callback?: () => void) {
  addStyle("/stage/protyle/js/katex/katex.min.css", "algorithm2eKatexStyle");
  addScript("/stage/protyle/js/katex/katex.min.js", "algorithm2eKatexScript").then(() => {
    if (callback) callback();
  });
}

export function compilePseudocode(code: string, config: IPseudocodeConfig): IResCompilePseudocode {
  return compileAlgorithm2e(code, config);
}
