import {
  Dialog,
  Plugin,
  Setting,
  getFrontend,
  fetchPost,
  IWebSocketData,
} from "siyuan";
import "@/index.scss";
import PluginInfoString from '@/../plugin.json'
import { Editor } from "@/editor";
import { initPseudocode, compilePseudocode } from "@/pseudocode";
import {
  getBlockPseudocodeCode,
  getDefaultPseudocodeConfig,
  getBlockPseudocodeConfigByElement,
  getBlockPseudocodeConfigByID,
  setAutoAlgorithmNumber,
  updatePseudocodeBlockData,
  updatePseudocodeElements,
  updatePseudocodeViewAttribute,
  switchPseudocodeView,
  setAutoCompileMuatationObserver,
  turnOnAllPseudocodeView,
  turnOffAllPseudocodeView,
} from "@/main";
import {
  Algorithm2eLabels,
  Algorithm2eFonts,
  Algorithm2ePreset,
  Algorithm2eStyle,
  LABEL_KEYS,
  getDefaultAlgorithm2eSettings,
  labelsForPreset,
  setAlgorithm2eSettings,
} from "@/settings";

let PluginInfo = {
  version: '',
}
try {
  PluginInfo = PluginInfoString
} catch (err) {
  console.log('Plugin info parse error: ', err)
}
const {
  version,
} = PluginInfo

export default class PseudocodePlugin extends Plugin {
  // Run as mobile
  public isMobile: boolean
  // Run in browser
  public isBrowser: boolean
  // Run as local
  public isLocal: boolean
  // Run in Electron
  public isElectron: boolean
  // Run in window
  public isInWindow: boolean
  public platform: SyFrontendTypes
  public readonly version = version

  private _mutationObserver: MutationObserver;
  private _clickBlockIconHandler;
  private _globalKeyDownHandler;

  async onload() {
    await this.loadRenderSettings();
    this.initMetaInfo();

    this.setPdfScript();

    initPseudocode(() => {
      turnOnAllPseudocodeView();
    });

    this._mutationObserver = setAutoCompileMuatationObserver(document.body);

    this.protyleSlash = [{
      filter: ["algorithm2e", "伪代码", "weidaima"],
      id: "algorithm2e",
      html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconCode"></use></svg><span class="b3-list-item__text">${this.i18n.pseudocode}</span></div>`,
      callback: (_protyle, nodeElement) => {
        const code = "";
        const blockID = nodeElement.getAttribute("data-node-id");
        const pseudocodeConfig = getDefaultPseudocodeConfig();
        setAutoAlgorithmNumber(nodeElement, pseudocodeConfig);
        const compileResult = compilePseudocode(code, pseudocodeConfig);
        updatePseudocodeViewAttribute(blockID, pseudocodeConfig.view);
        updatePseudocodeBlockData(blockID, code, pseudocodeConfig, () => {
          updatePseudocodeElements(blockID, pseudocodeConfig, compileResult);
          const blockElement = document.querySelector(`.protyle-wysiwyg [data-node-id="${blockID}"]`) as HTMLElement;
          if (blockElement) {
            this.openEditDialog(blockElement, false, false);
          }
        });
      },
    }];

    if (!window.siyuan.config.readonly) {
      this._clickBlockIconHandler = this.clickBlockIconHandler.bind(this);
      this.eventBus.on("click-blockicon", this._clickBlockIconHandler);
    }

    this._globalKeyDownHandler = this.globalKeyDownHandler.bind(this);
    document.documentElement.addEventListener("keydown", this._globalKeyDownHandler);
  }

  onunload() {
    turnOffAllPseudocodeView();
    if (this._mutationObserver) this._mutationObserver.disconnect();
    if (this._clickBlockIconHandler) this.eventBus.off("click-blockicon", this._clickBlockIconHandler);
    if (this._globalKeyDownHandler) document.documentElement.removeEventListener("keydown", this._globalKeyDownHandler);
  }

  private async loadRenderSettings() {
    try {
      const stored = await this.loadData("algorithm2e-settings.json");
      setAlgorithm2eSettings(stored);
    } catch (error) {
      console.warn("Failed to load algorithm2e settings", error);
    }
  }

  openSetting() {
    const draft = getDefaultAlgorithm2eSettings();
    const controls = new Map<keyof Algorithm2eLabels, HTMLInputElement>();
    const fontControls = new Map<keyof Algorithm2eFonts, HTMLSelectElement>();
    let presetSelect: HTMLSelectElement;
    let styleSelect: HTMLSelectElement;
    let scopeLineSelect: HTMLSelectElement;
    let blockEndingSelect: HTMLSelectElement;
    let lineNumberSelect: HTMLSelectElement;

    const commandNames: Record<keyof Algorithm2eLabels, string> = {
      algorithm: "\\caption",
      for: "\\For",
      foreach: "\\ForEach",
      while: "\\While",
      do: "do",
      if: "\\If",
      then: "then",
      else: "\\Else",
      kwIn: "\\KwIn",
      kwOut: "\\KwOut",
      kwTo: "\\KwTo",
      kwAnd: "\\KwAnd",
      kwOr: "\\KwOr",
      return: "\\Return",
      tcp: "\\tcp",
      tcc: "\\tcc",
      endIf: "结束 If",
      endLoop: "结束循环",
      separator: "标点",
    };
    const i18n = this.i18n as Record<string, string>;
    const settingLabels: Record<keyof Algorithm2eLabels, string> = {
      algorithm: i18n.settingAlgorithm || "Algorithm label",
      for: i18n.settingFor || "For",
      foreach: i18n.settingForEach || "For each",
      while: i18n.settingWhile || "While",
      do: i18n.settingDo || "Do",
      if: i18n.settingIf || "If",
      then: i18n.settingThen || "Then",
      else: i18n.settingElse || "Else",
      kwIn: i18n.settingKwIn || "Input",
      kwOut: i18n.settingKwOut || "Output",
      kwTo: i18n.settingKwTo || "To",
      kwAnd: i18n.settingKwAnd || "And",
      kwOr: i18n.settingKwOr || "Or",
      return: i18n.settingReturn || "Return",
      tcp: i18n.settingTcp || "Inline comment",
      tcc: i18n.settingTcc || "Block comment",
      endIf: i18n.settingEndIf || "End if",
      endLoop: i18n.settingEndLoop || "End loop",
      separator: i18n.settingSeparator || "Punctuation",
    };

    const refreshInputs = () => {
      presetSelect.value = draft.preset;
      styleSelect.value = draft.style;
      scopeLineSelect.value = draft.scopeLine ? "true" : "false";
      blockEndingSelect.value = draft.blockEnding ? "true" : "false";
      lineNumberSelect.value = draft.lineNumber ? "true" : "false";
      fontControls.forEach((select, key) => {
        select.value = draft.fonts[key];
      });
      controls.forEach((input, key) => {
        input.value = draft.labels[key];
      });
    };

    const createEditor = () => {
      const wrapper = document.createElement("div");
      wrapper.className = "algorithm2e-settings-editor";

      presetSelect = document.createElement("select");
      presetSelect.className = "b3-select algorithm2e-settings-preset";
      [
        ["zh-CN", i18n.settingPresetChinese || "中文方案"],
        ["en-US", i18n.settingPresetEnglish || "English preset"],
        ["custom", i18n.settingPresetCustom || "自定义"],
      ].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        presetSelect.appendChild(option);
      });
      presetSelect.addEventListener("change", () => {
        draft.preset = presetSelect.value as Algorithm2ePreset;
        if (draft.preset !== "custom") draft.labels = labelsForPreset(draft.preset);
        refreshInputs();
      });
      const styleLabel = document.createElement("label");
      styleLabel.className = "algorithm2e-settings-style-label";
      styleLabel.textContent = i18n.settingStyleTitle || "Rendering style";
      styleSelect = document.createElement("select");
      styleSelect.className = "b3-select algorithm2e-settings-style";
      [
        ["rounded", i18n.settingStyleRounded || "Rounded card"],
        ["three-line", i18n.settingStyleThreeLine || "Three-line paper style"],
      ].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        styleSelect.appendChild(option);
      });
      styleSelect.addEventListener("change", () => {
        draft.style = styleSelect.value as Algorithm2eStyle;
      });
      wrapper.append(styleLabel, styleSelect);

      const renderOptions = document.createElement("div");
      renderOptions.className = "algorithm2e-settings-render-options";
      const createRenderOption = (
        title: string,
        className: string,
        options: Array<[string, string]>,
        onChange: (value: boolean) => void,
      ): HTMLSelectElement => {
        const optionWrapper = document.createElement("div");
        optionWrapper.className = "algorithm2e-settings-render-option";
        const label = document.createElement("label");
        label.className = "algorithm2e-settings-render-option-label";
        label.textContent = title;
        const select = document.createElement("select");
        select.className = `b3-select ${className}`;
        options.forEach(([value, optionText]) => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = optionText;
          select.appendChild(option);
        });
        select.addEventListener("change", () => onChange(select.value === "true"));
        optionWrapper.append(label, select);
        renderOptions.appendChild(optionWrapper);
        return select;
      };
      const booleanOptions = (show: string, hide: string): Array<[string, string]> => [
        ["true", show],
        ["false", hide],
      ];
      scopeLineSelect = createRenderOption(
        i18n.settingScopeLineTitle || "Scope lines",
        "algorithm2e-settings-scope",
        booleanOptions(i18n.withScopeLine || "Show scope lines", i18n.withoutScopeLine || "Hide scope lines"),
        (value) => { draft.scopeLine = value; },
      );
      blockEndingSelect = createRenderOption(
        i18n.settingBlockEndingTitle || "Block endings",
        "algorithm2e-settings-block-ending",
        booleanOptions(i18n.withBlockEnding || "Show block endings", i18n.withoutBlockEnding || "Hide block endings"),
        (value) => { draft.blockEnding = value; },
      );
      lineNumberSelect = createRenderOption(
        i18n.settingLineNumberTitle || "Line numbers",
        "algorithm2e-settings-line-number",
        booleanOptions(i18n.withLineNumber || "Show line numbers", i18n.withoutLineNumber || "Hide line numbers"),
        (value) => { draft.lineNumber = value; },
      );
      wrapper.appendChild(renderOptions);

      const fontTitle = document.createElement("div");
      fontTitle.className = "algorithm2e-settings-font-title";
      fontTitle.textContent = i18n.settingFontTitle || "Fonts";
      wrapper.appendChild(fontTitle);
      const fontOptions: Record<keyof Algorithm2eFonts, Array<[string, string]>> = {
        chinese: [
          ["SimSun", i18n.settingFontSimSun || "宋体"],
          ["Microsoft YaHei", i18n.settingFontYaHei || "微软雅黑"],
          ["KaiTi", i18n.settingFontKaiTi || "楷体"],
          ["SimHei", i18n.settingFontSimHei || "黑体"],
        ],
        english: [
          ["Times New Roman", "Times New Roman"],
          ["Arial", "Arial"],
          ["Georgia", "Georgia"],
          ["Courier New", "Courier New"],
        ],
        math: [
          ["Times New Roman", "Times New Roman"],
          ["Cambria Math", "Cambria Math"],
          ["STIX Two Math", "STIX Two Math"],
          ["Latin Modern Math", "Latin Modern Math"],
        ],
      };
      const fontLabels: Record<keyof Algorithm2eFonts, string> = {
        chinese: i18n.settingChineseFont || "Chinese font",
        english: i18n.settingEnglishFont || "English font",
        math: i18n.settingMathFont || "Formula font",
      };
      (Object.keys(fontOptions) as Array<keyof Algorithm2eFonts>).forEach((key) => {
        const row = document.createElement("div");
        row.className = "algorithm2e-settings-font-row";
        const label = document.createElement("label");
        label.textContent = fontLabels[key];
        const select = document.createElement("select");
        select.className = "b3-select";
        fontOptions[key].forEach(([value, text]) => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = text;
          select.appendChild(option);
        });
        select.addEventListener("change", () => {
          draft.fonts[key] = select.value;
        });
        fontControls.set(key, select);
        row.append(label, select);
        wrapper.appendChild(row);
      });

      const presetLabel = document.createElement("label");
      presetLabel.className = "algorithm2e-settings-preset-label";
      presetLabel.textContent = i18n.settingPresetLabel || i18n.settingPresetTitle || "Field preset";
      wrapper.append(presetLabel, presetSelect);

      const table = document.createElement("table");
      table.className = "algorithm2e-settings-table";
      const header = document.createElement("tr");
      [i18n.settingCommand || "Command", i18n.settingRenderResult || "Rendered text"].forEach((text) => {
        const cell = document.createElement("th");
        cell.textContent = text;
        header.appendChild(cell);
      });
      table.appendChild(header);

      LABEL_KEYS.forEach((key) => {
        const row = document.createElement("tr");
        const commandCell = document.createElement("td");
        commandCell.textContent = `${commandNames[key]} (${settingLabels[key]})`;
        const valueCell = document.createElement("td");
        const input = document.createElement("input");
        input.className = "b3-text-field";
        input.type = "text";
        input.addEventListener("input", () => {
          draft.preset = "custom";
          draft.labels[key] = input.value;
          presetSelect.value = "custom";
        });
        controls.set(key, input);
        commandCell.title = settingLabels[key];
        valueCell.appendChild(input);
        row.append(commandCell, valueCell);
        table.appendChild(row);
      });
      wrapper.appendChild(table);
      refreshInputs();
      return wrapper;
    };

    const setting = new Setting({
      height: "75vh",
      width: "720px",
      confirmCallback: async () => {
        const saved = setAlgorithm2eSettings(draft);
        await this.saveData("algorithm2e-settings.json", saved);
        turnOnAllPseudocodeView();
      },
    });
    setting.addItem({
      title: i18n.settingOptionsTitle || "Rendering options",
      description: i18n.settingPresetDescription || "The setting applies to all algorithm2e blocks.",
      direction: "column",
      createActionElement: createEditor,
    });
    setting.open(i18n.settingTitle || "Algorithm2e settings");
  }

  private initMetaInfo() {
    const frontEnd = getFrontend();
    this.platform = frontEnd as SyFrontendTypes
    this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";
    this.isBrowser = frontEnd.includes('browser');
    this.isLocal = location.href.includes('127.0.0.1') || location.href.includes('localhost');
    this.isInWindow = location.href.includes('window.html');

    try {
      require("@electron/remote")
        .require("@electron/remote/main");
      this.isElectron = true;
    } catch (err) {
      this.isElectron = false;
    }
  }

  public async openEditDialog(blockElement: HTMLElement, autoCompile?: boolean, autoClose?: boolean) {
    const editDialogHTML = `
<div class="pseudocode-edit-dialog">
    <div class="edit-dialog-header resize__move"></div>
    <div class="edit-dialog-container">
        <div class="edit-dialog-toolbar">
          <span class="edit-dialog-toolbar-title">${this.i18n.algorithm2eEditorTitle}</span>
          <input class="b3-text-field" data-type="algorithm-number" type="number" placeholder="${this.i18n.algorithmNumberPlaceholder}">
        </div>
        <div class="fn__hr--b"></div>
        <div class="edit-dialog-editor"></div>
        <div class="fn__hr--b"></div>
        <textarea readonly class="edit-dialog-message fn__none" placeholder="${this.i18n.noMessage}"></textarea>
    </div>
    <div class="b3-dialog__action">
        <div data-action="main">
            <button data-action="success" class="b3-button b3-button--success fn__none">${this.i18n.compileSuccessButton}</button>
            <button data-action="error" class="b3-button b3-button--error fn__none">${this.i18n.compileErrorButton}</button>
            <div class="fn__space"></div>
            <button data-action="compile" class="b3-button b3-button--text">${this.i18n.compile}</button>
        </div>
        <div data-action="compiling" class="status__backgroundtask fn__none">${this.i18n.compiling}<div><div></div></div></div>
    </div>
</div>
    `;

    const dialog = new Dialog({
      content: editDialogHTML,
      width: this.isMobile ? "92vw" : "70vw",
      height: "80vh",
      hideCloseIcon: this.isMobile,
    });

    const blockID = blockElement.getAttribute("data-node-id");
    const pseudocodeConfig = await getBlockPseudocodeConfigByID(blockID);
    (dialog.element.querySelector("[data-type=algorithm-number]") as HTMLInputElement).value = pseudocodeConfig.algorithmNumber;

    // 获取伪代码源码
    const code = getBlockPseudocodeCode(blockElement).trim();

    // 创建编辑器
    const editorContainer = dialog.element.querySelector(".edit-dialog-editor") as HTMLElement;
    const editor = new Editor(editorContainer, code);
    editor.focus();

    const compileHandler = async () => {
      editor.setEditable(false);
      dialog.element.querySelector("[data-action=main]").classList.toggle("fn__none", true);
      dialog.element.querySelector("[data-action=compiling]").classList.toggle("fn__none", false);
      dialog.element.querySelector(".edit-dialog-message").classList.toggle("fn__none", true);

      pseudocodeConfig.algorithmNumber = (dialog.element.querySelector("[data-type=algorithm-number]") as HTMLInputElement).value;
      const code = editor.getContent().trim();

      setAutoAlgorithmNumber(blockElement, pseudocodeConfig);
      const compileResult = compilePseudocode(code, pseudocodeConfig);
      updatePseudocodeBlockData(blockID, code, pseudocodeConfig, () => {
        updatePseudocodeElements(blockID, pseudocodeConfig, compileResult);
      });

      dialog.element.querySelector("[data-action=success]").classList.toggle("fn__none", !compileResult.ok);
      dialog.element.querySelector("[data-action=error]").classList.toggle("fn__none", compileResult.ok);
      dialog.element.querySelector(".edit-dialog-message").classList.toggle("fn__none", compileResult.ok);
      (dialog.element.querySelector(".edit-dialog-message") as HTMLTextAreaElement).value = compileResult.message;
      if (autoClose && compileResult.ok) dialog.destroy();

      editor.setEditable(true);
      dialog.element.querySelector("[data-action=main]").classList.toggle("fn__none", false);
      dialog.element.querySelector("[data-action=compiling]").classList.toggle("fn__none", true);
    }
    dialog.element.querySelector("[data-action=compile]").addEventListener("click", compileHandler);

    const compileSuccessHandler = () => {
      dialog.destroy();
    }
    dialog.element.querySelector("[data-action=success]").addEventListener("click", compileSuccessHandler);

    const compileErrorHandler = () => {
      dialog.element.querySelector(".edit-dialog-message").classList.toggle("fn__none");
    }
    dialog.element.querySelector("[data-action=error]").addEventListener("click", compileErrorHandler);

    if (autoCompile) compileHandler();
  }

  private clickBlockIconHandler({ detail }) {
    if (detail.blockElements.length != 1) return;
    const selectedElement = detail.blockElements[0];
    // 挂件块的转换
    const iframeElement = selectedElement.querySelector("iframe[src='/widgets/siyuan-pseudocode/']");
    if (iframeElement) {
      window.siyuan.menus.menu.addItem({
        id: "transform-pseudocode",
        icon: 'iconRefresh',
        label: `${this.i18n.transformPseudocode}`,
        index: 0,
        click: () => {
          const blockID = selectedElement.getAttribute("data-node-id");
          fetchPost('/api/attr/getBlockAttrs', { id: blockID }, (response: IWebSocketData) => {
            if (response.code != 0) {
              throw new Error("get block attrs failed");
            };
            if (response.data) {
              const pseudocodeConfig = getDefaultPseudocodeConfig();
              const code = response.data["custom-latex-code"] || "";
              pseudocodeConfig.algorithmLabel = response.data["custom-titile-prefix"] || pseudocodeConfig.algorithmLabel;
              pseudocodeConfig.algorithmNumber = response.data["custom-caption-count"] || pseudocodeConfig.algorithmNumber;

              setAutoAlgorithmNumber(selectedElement, pseudocodeConfig);
              const compileResult = compilePseudocode(code, pseudocodeConfig);
              updatePseudocodeViewAttribute(blockID, pseudocodeConfig.view);
              updatePseudocodeBlockData(blockID, code, pseudocodeConfig, () => {
                updatePseudocodeElements(blockID, pseudocodeConfig, compileResult);
              });

            }
          })
        }
      });
    }
    // 对伪代码代码块的处理
    if (selectedElement.querySelector("[data-type='NodeCodeBlock'] .protyle-action__language")?.textContent == "algorithm2e") {
      if (selectedElement.getAttribute("custom-view") == "algorithm2e") {
        // 伪代码视图
        window.siyuan.menus.menu.addItem({
          id: "turn-off-pseudocode-view",
          icon: 'iconCode',
          label: `${this.i18n.turnOffPseudocodeView}`,
          index: 1,
          click: () => {
            updatePseudocodeViewAttribute(selectedElement.getAttribute("data-node-id"), "");
            switchPseudocodeView("off", selectedElement);
          }
        });
      } else {
        // 代码块视图
        window.siyuan.menus.menu.addItem({
          id: "turn-on-pseudocode-view",
          icon: 'iconCode',
          label: `${this.i18n.turnOnPseudocodeView}`,
          index: 1,
          click: () => {
            const blockID = selectedElement.getAttribute("data-node-id");
            const code = getBlockPseudocodeCode(selectedElement);
            const pseudocodeConfig = getBlockPseudocodeConfigByElement(selectedElement);
            setAutoAlgorithmNumber(selectedElement, pseudocodeConfig);
            const compileResult = compilePseudocode(code, pseudocodeConfig);
            pseudocodeConfig.view = "algorithm2e";
            updatePseudocodeViewAttribute(blockID, pseudocodeConfig.view);
            updatePseudocodeElements(blockID, pseudocodeConfig, compileResult);
          }
        });
      }
      // 编辑伪代码
      window.siyuan.menus.menu.addItem({
        id: "edit-pseudocode",
        icon: 'iconEdit',
        label: `${this.i18n.editPseudocode}`,
        index: 1,
        click: () => {
          this.openEditDialog(selectedElement);
        }
      });
    }
  }

  private globalKeyDownHandler = (event: KeyboardEvent) => {
    // 如果是在代码编辑器里使用快捷键，则阻止冒泡 https://github.com/YuxinZhaozyx/siyuan-embed-tikz/issues/1
    if (document.activeElement.closest(".b3-dialog--open .pseudocode-edit-dialog")) {
      event.stopPropagation();
    }
  };

  private setPdfScript() {
    const injectStyle = document.createElement('style');
    injectStyle.id = `snippetCSS-pdf-algorithm2e`;
    injectStyle.textContent = `</style><script src="/plugins/siyuan-algorithm2e/daemon.js"></script><style>`;
    document.head.appendChild(injectStyle);
  }

}
