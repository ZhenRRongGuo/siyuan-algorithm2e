import { fetchPost, fetchSyncPost } from "@/utils/fetch";
import { compilePseudocode } from "@/pseudocode";
import { getAlgorithm2eLabels, getDefaultAlgorithm2eSettings } from "@/settings";

export function turnOnAllPseudocodeView() {
  document.querySelectorAll(".code-block[data-type='NodeCodeBlock'][custom-view='algorithm2e']").forEach((blockElement: HTMLElement) => {
    const blockID = blockElement.getAttribute("data-node-id");
    const code = getBlockPseudocodeCode(blockElement);
    const pseudocodeConfig = getBlockPseudocodeConfigByElement(blockElement);
    setAutoAlgorithmNumber(blockElement, pseudocodeConfig);
    const compileResult = compilePseudocode(code, pseudocodeConfig);
    updatePseudocodeViewAttribute(blockID, pseudocodeConfig.view);
    updatePseudocodeElements(blockID, pseudocodeConfig, compileResult);
  }); 
}

export function turnOffAllPseudocodeView() {
  document.querySelectorAll(".code-block[data-type='NodeCodeBlock'][custom-view='algorithm2e']").forEach((blockElement: HTMLElement) => {
    switchPseudocodeView("off", blockElement);
  }); 
}

export function setAutoCompileMuatationObserver(element: HTMLElement): MutationObserver {
  const mutationObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const addedElement = node as HTMLElement;
            if (addedElement.matches(".code-block[data-type='NodeCodeBlock'][custom-view='algorithm2e']")) {
              const blockElement = addedElement as HTMLElement;
              const blockID = blockElement.getAttribute("data-node-id");
              const code = getBlockPseudocodeCode(blockElement);
              const pseudocodeConfig = getBlockPseudocodeConfigByElement(blockElement);
              setAutoAlgorithmNumber(blockElement, pseudocodeConfig);
              const compileResult = compilePseudocode(code, pseudocodeConfig);
              updatePseudocodeViewAttribute(blockID, pseudocodeConfig.view);
              updatePseudocodeElements(blockID, pseudocodeConfig, compileResult);
            } else {
              addedElement.querySelectorAll(".code-block[data-type='NodeCodeBlock'][custom-view='algorithm2e']").forEach((blockElement: HTMLElement) => {
                const blockID = blockElement.getAttribute("data-node-id");
                const code = getBlockPseudocodeCode(blockElement);
                const pseudocodeConfig = getBlockPseudocodeConfigByElement(blockElement);
                setAutoAlgorithmNumber(blockElement, pseudocodeConfig);
                const compileResult = compilePseudocode(code, pseudocodeConfig);
                updatePseudocodeViewAttribute(blockID, pseudocodeConfig.view);
                updatePseudocodeElements(blockID, pseudocodeConfig, compileResult);
              })
            }
          }
        });
      }
    }
  });

  mutationObserver.observe(element, {
    childList: true,
    subtree: true
  });

  return mutationObserver;
}

export function getPlaceholderContent(errorMessage: string): string {
  let content = `<div class="ft__error" align="center">algorithm2e render error:<br>${errorMessage}</div>`;
  return content;
}

export function updatePseudocodeBlockData(blockID: string, code: string, config: IPseudocodeConfig, callback: () => void) {
  fetchPost('/api/block/updateBlock', {
    id: blockID,
    data: `\`\`\`algorithm2e\n${code}\n\`\`\``,
    dataType: "markdown",
  }, () => {
    fetchPost("/api/attr/setBlockAttrs", {
      id: blockID,
      attrs: {
        "custom-view": config.view,
        "custom-algorithm-number": config.algorithmNumber,
      },
    }, () => {
      callback();
    });
  });
}

export function updatePseudocodeElements(blockID: string, config: IPseudocodeConfig, compileResult: IResCompilePseudocode) {
  if (compileResult) {
    document.querySelectorAll(`.protyle-wysiwyg [data-node-id="${blockID}"]`).forEach((blockElement: HTMLElement) => {
      if (config.view == "algorithm2e") {
        switchPseudocodeView("on", blockElement);
        const containerElement = blockElement.querySelector(".pseudocode-container") as HTMLElement;
        if (containerElement) {
          containerElement.innerHTML = compileResult.ok ? compileResult.html : getPlaceholderContent(compileResult.message);
        }
      }
    });
  }
}

export function switchPseudocodeView(mode: "on" | "off", blockElement: HTMLElement) {
  const codeElement = blockElement.querySelector(".hljs");
  if (codeElement) {
    codeElement.classList.toggle("fn__none", mode === "on");
    blockElement.querySelector(".protyle-action__language").classList.toggle("fn__none", mode === "on");
    const containerElement = blockElement.querySelector(".pseudocode-container");
    if (mode === "on") {
      if (!containerElement) {
        codeElement.insertAdjacentHTML('afterend', '<div spin="1" class="pseudocode-container" contenteditable="false"></div>');
      }
    } else {
      if (containerElement) containerElement.remove();
    }
  }
}

export function updatePseudocodeViewAttribute(blockID: string, view: string) {
  document.querySelectorAll(`.code-block[data-node-id="${blockID}"]`).forEach((blockElement: HTMLElement) => {
    blockElement.setAttribute("custom-view", view);
  });
  fetchPost("/api/attr/setBlockAttrs", {
    id: blockID,
    attrs: {
      "custom-view": view,
    }
  });
}

export function getDefaultPseudocodeConfig(): IPseudocodeConfig {
  return {
    view: "algorithm2e",
    algorithmLabel: getAlgorithm2eLabels().algorithm,
    algorithmNumber: "",
    lineNumber: getDefaultAlgorithm2eSettings().lineNumber ? "true" : "false",
    blockEnding: getDefaultAlgorithm2eSettings().blockEnding ? "true" : "false",
    scopeLine: getDefaultAlgorithm2eSettings().scopeLine ? "true" : "false",
    _defaultAlgorithmNumber: "1",
  }
}

export async function getBlockPseudocodeConfigByID(blockID: string): Promise<IPseudocodeConfig> {
  const config = getDefaultPseudocodeConfig();
  const response = await fetchSyncPost("/api/attr/getBlockAttrs", { id: blockID })
  if (response.code != 0) {
    throw new Error("get block attrs failed");
  };
  if (response.data) {
    config.view = response.data["custom-view"] || "";
    config.algorithmNumber = response.data["custom-algorithm-number"] || config.algorithmNumber;
  }
  return config;
}

export function getBlockPseudocodeConfigByElement(blockElement: HTMLElement): IPseudocodeConfig {
  const config = getDefaultPseudocodeConfig();
  config.view = blockElement.getAttribute("custom-view") || "";
  config.algorithmNumber = blockElement.getAttribute("custom-algorithm-number") || config.algorithmNumber;
  return config;
}

export function getBlockPseudocodeCode(blockElement: HTMLElement): string {
  return blockElement.querySelector(".hljs [contenteditable]:not(.protyle-linenumber__rows)")?.textContent || "";
}

export function setAutoAlgorithmNumber(blockElement: HTMLElement, pseudocodeConfig: IPseudocodeConfig) {
  if (!pseudocodeConfig.algorithmNumber) {
    let rootElement = blockElement;
    while (rootElement.parentElement && !rootElement.classList.contains("protyle-wysiwyg")) {
      rootElement = rootElement.parentElement;
    }
    const originType = blockElement.getAttribute("data-type");
    const originView = blockElement.getAttribute("custom-view");
    blockElement.setAttribute("data-type", "NodeCodeBlock");
    blockElement.setAttribute("custom-view", "algorithm2e");
    pseudocodeConfig._defaultAlgorithmNumber = (Array.from(rootElement.querySelectorAll("[data-type='NodeCodeBlock'][custom-view='algorithm2e']")).indexOf(blockElement) + 1).toString();
    blockElement.setAttribute("data-type", originType);
    blockElement.setAttribute("custom-view", originView);
  }
}
