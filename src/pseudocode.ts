import { compileAlgorithm2e } from "./algorithm2e";

export function initPseudocode(callback?: () => void) {
  if (callback) callback();
}

export function compilePseudocode(code: string, config: IPseudocodeConfig): IResCompilePseudocode {
  return compileAlgorithm2e(code, config);
}
