// CodeMirror 6
import { autocompletion, closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete"; // autocompletion, completionKeymap
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import {
    latexLanguage, 
    latexCompletionSource,
    latexLinter,
    autoCloseTags,
    latexHoverTooltip,
    latexBracketMatching,
} from "codemirror-lang-latex";
import { linter } from '@codemirror/lint';
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { EditorState, Compartment } from "@codemirror/state";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import {
    bracketMatching,
    defaultHighlightStyle,
    foldGutter,
    foldKeymap,
    indentOnInput,
    indentUnit,
    LanguageSupport,
    syntaxHighlighting
} from "@codemirror/language";
import {
    crosshairCursor,
    drawSelection,
    dropCursor,
    EditorView,
    highlightActiveLine,
    highlightSpecialChars,
    keymap,
    lineNumbers,
    placeholder,
    rectangularSelection
} from "@codemirror/view";

export class Editor {
    public view: EditorView;

    private editableController = new Compartment();

    constructor(container: HTMLElement, content: string) {
        const theme = window.siyuan.config.appearance.mode === 0 ? vscodeLight : vscodeDark;
        const placeholderText = String.raw`
\begin{algorithm}
\caption{Quicksort}
\begin{algorithmic}
\PROCEDURE{Quicksort}{$A, p, r$}
    \IF{$p < r$} 
        \STATE $q = $ \CALL{Partition}{$A, p, r$}
        \STATE \CALL{Quicksort}{$A, p, q - 1$}
        \STATE \CALL{Quicksort}{$A, q + 1, r$}
    \ENDIF
\ENDPROCEDURE
\PROCEDURE{Partition}{$A, p, r$}
    \STATE $x = A[r]$
    \STATE $i = p - 1$
    \FOR{$j = p$ \TO $r - 1$}
        \IF{$A[j] < x$}
            \STATE $i = i + 1$
            \STATE exchange
            $A[i]$ with $A[j]$
        \ENDIF
        \STATE exchange $A[i]$ with $A[r]$
    \ENDFOR
\ENDPROCEDURE
\end{algorithmic}
\end{algorithm}
        `.trim();

        // 创建编辑器状态
        const state = EditorState.create({
            doc: content,
            extensions: [
                // 显示行号
                lineNumbers(),
                // 标记特殊字符（不可打印或其他令人困惑的字符）
                highlightSpecialChars(),
                // 可编辑
                this.editableController.of(EditorView.editable.of(true)),
                // 占位符
                placeholder(placeholderText),
                // 启用撤销/重做历史记录
                history(),
                // 显示代码折叠图标
                foldGutter(),
                // 绘制文本选择区域
                drawSelection(),
                // 显示拖拽光标（从其他地方拖入编辑器）
                dropCursor(),
                // 允许多重选择
                EditorState.allowMultipleSelections.of(true),
                // 输入时自动缩进
                indentOnInput(),
                // 启用语法高亮，使用默认高亮样式
                syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
                // 高亮匹配的括号
                bracketMatching(),
                // 自动闭合括号
                // closeBrackets(),
                // 启用自动完成功能
                autocompletion(),
                // 启用矩形选择模式
                rectangularSelection(),
                // 显示十字光标
                crosshairCursor(),
                // 高亮当前活动行
                highlightActiveLine(),
                // 高亮所有匹配的选中文本
                highlightSelectionMatches(),
                // 设置缩进单位
                indentUnit.of(" ".repeat(2)),
                // 配置快捷键映射
                keymap.of([
                    // 括号闭合快捷键
                    ...closeBracketsKeymap,
                    // 默认快捷键（复制、粘贴、删除等）
                    ...defaultKeymap,
                    // 搜索快捷键
                    ...searchKeymap,
                    // 历史记录快捷键（撤销、重做）
                    ...historyKeymap,
                    // 代码折叠快捷键
                    ...foldKeymap,
                    // 自动完成快捷键
                    // ...completionKeymap,
                    // Tab 键缩进快捷键
                    indentWithTab,
                ]),
                // 启用语言支持
                // latex({
                //     autoCloseTags: true,
                //     autoCloseBrackets: false,
                //     enableLinting: true,
                //     enableTooltips: false,
                //     enableAutocomplete: true,
                // }),
                new LanguageSupport(latexLanguage, [
                    latexLanguage.data.of({
                        autocomplete: latexCompletionSource(true),
                    }),
                    linter(latexLinter({
                        checkMissingDocumentEnv: false,
                        checkUnmatchedEnvironments: true,
                        checkMissingReferences: false
                    })),
                    ...autoCloseTags,
                    latexHoverTooltip,
                    latexBracketMatching,
                    autocompletion({
                        override: [latexCompletionSource(true)],
                        defaultKeymap: true,
                        activateOnTyping: true,
                        icons: true
                    })
                ]),

                // 应用主题
                theme,
            ],
        });

        // 创建编辑器视图
        this.view = new EditorView({
            state,
            parent: container
        });

        // 将编辑器实例存储到 DOM 元素上，以便后续主题切换时能够找到
        (this.view.dom as any).cmView = this.view;
    }

    public setEditable(editable: boolean) {
        this.view.dispatch({
            // 禁用或启用编辑功能
            effects: this.editableController.reconfigure(EditorView.editable.of(editable)),
        });
    }

    public getContent(): string {
        return this.view.state.doc.toString();
    }

    public setContent(content: string) {
        this.view.dispatch({
            changes: {
                from: 0,
                to: this.view.state.doc.length,
                insert: content,
            },
        });
    }

    public focus() {
        this.view.contentDOM.focus();
    }

}
