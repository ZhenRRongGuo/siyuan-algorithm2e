![algorithm2e](./icon.png)

<p align="center">
    <strong>思源笔记插件</strong>
    <br>
    使用 LaTeX algorithm2e语法，在思源笔记中书写和展示伪代码。
    <br>
    无需外部依赖 · 自由编辑 · 自由分享
</p>

<p align="center">
    <a href="https://github.com/ZhenRRongGuo/siyuan-algorithm2e/blob/main/README_zh_CN.md">中文</a> | <a href="https://github.com/ZhenRRongGuo/siyuan-algorithm2e/blob/main/README.md">English</a>
</p>

---

## 声明

* 本插件参考 [YuxinZhaozyx/siyuan-embed-pseudocode](https://github.com/YuxinZhaozyx/siyuan-embed-pseudocode)制作
* LaTeX有两套使用伪代码的方法，一种方法是依赖宏包`algorithm`+`algorithmic`，另一种方法是依赖宏包`algorithm2e`。
  * 如果更偏好使用`algorithm`+`algorithmic`宏包，请使用 [YuxinZhaozyx/siyuan-embed-pseudocode](https://github.com/YuxinZhaozyx/siyuan-embed-pseudocode) 插件
  * 如果更偏好使用`algorithm2e`宏包，请使用本插件。

> <span style="color: red; font-weight: bold;">⚠️ 本项目重度依赖AI制作，虽然本人使用尚未发现问题，但请自行评估风险。</span>

## 使用效果


<details>
<summary> 伪代码源码 </summary>

```
\begin{algorithm}
    \caption{算法标题}
    \KwIn{算法输入}
    \KwOut{算法输出}
    \For{<For循环>}{
        循环内容\;
    }
    \While{<while循环>}{
        循环内容\;
    }
    \If{<条件>}{
        肯定语句
    }
    \eIf{<条件>}{
        肯定语句}{
        否定语句
    }
\end{algorithm}
```
</details>


| LaTeX效果 | Siyuan效果 |
| :---: | :---: |
| ![LaTeX效果](./assets/example-latex.png) | ![Siyuan效果](./assets/example-sy.png) |

<details>
<summary> 伪代码源码（数学渲染展示） </summary>

```
\begin{algorithm}
    \caption{交换数据}
    \KwIn{算法输入交换前的数据$a$, $b$}
    \KwOut{算法输出交换后的数据$a$, $b$}
    $temp \gets a$ \;
    $a \gets b$ \;
    $b \gets temp$ \;
    \Return $a$, $b$ \;
\end{algorithm}
```
</details>

| LaTeX效果 | Siyuan效果 |
| :---: | :---: |
| ![LaTeX数学效果](./assets/example_math-latex.png) | ![Siyuan数学效果](./assets/example_math-sy.png) |


<details>
<summary> 伪代码源码（注释展示） </summary>

```
\begin{algorithm}
    \caption{注释演示}
    \For{$i \gets 1$ \KwTo $n$}{
        \tcc{这是一个无意义的伪代码，仅用于展示}
        1+1 \tcp{tcp{}命令生成行尾注释}
        $i\gets i+1$ \tcp{注释1}
        \tcp{空行注释}
        $\alpha+\beta$ \tcp*[r]{tcp*[r]{}命令生成右对齐注释}
        \Return{1} \tcp{返回值}
        \tcc{tcc{}命令生成注释块}
    }
\end{algorithm}
```
</details>


| LaTeX效果 | Siyuan效果 |
| :---: | :---: |
| ![LaTeX注释效果](./assets/example_note-latex.png) | ![Siyuan注释效果](./assets/example_note-sy.png) |

<details>
<summary> 伪代码源码（嵌套展示） </summary>

```
\begin{algorithm}
    \caption{嵌套演示}
    $n \gets 100$\;
    \For{$i \leqslant n$}{
        \eIf{$i$是偶数}{
            $i \gets i+1$\;
        }{
            $i \gets i+2$\;
        }
    }
\end{algorithm}
```
</details>

| LaTeX效果 | Siyuan效果 |
| :---: | :---: |
| ![LaTeX嵌套效果](./assets/example_nest-latex.png) | ![Siyuan嵌套效果](./assets/example_nest-sy.png) |

## 功能

- [x] 无网络离线使用
- [x] CodeMirror 编辑器（语法高亮、代码自动补全、错误提示）
- [x] 设置伪代码块的显示风格
- [x] 以 markdown 原生代码块存储伪代码
- [x] PDF 导出支持
- [x] 支持思源 KaTeX 宏定义命令渲染

> 如有更多需求/建议欢迎[在GitHub仓库中提issue](https://github.com/ZhenRRongGuo/siyuan-algorithm2e/issues)

## 使用指南

**创建伪代码：** 在编辑器中输入 `/algorithm2e` 命令即可创建新的伪代码。

**编辑伪代码：** 点击代码块左侧/右上角的菜单按钮，如果代码块被识别为伪代码块（语言为`algorithm2e`的代码块），则会出现 `编辑伪代码` 的选项，点击即可编辑。

**切换伪代码视图：** 点击代码块左侧/右上角的菜单按钮，如果代码块被识别为伪代码块（语言为`algorithm2e`的代码块），则会出现 `开启伪代码视图` / `关闭伪代码视图` 的选项，点击切换。

## 更新日志

+ v0.1.0
    + 第一次发布
