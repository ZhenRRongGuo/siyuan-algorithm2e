

export function escapeHTML(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function unescapeHTML(str: string): string {
  const div = document.createElement('div');
  div.innerHTML = str;
  return div.textContent || '';
}

export function parseHTMLAsElement(html: string): HTMLElement {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content.firstElementChild as HTMLElement;

}

// 从思源源码中复制的addStyle
export const addStyle = (url: string, id: string) => {
    if (!document.getElementById(id)) {
        const styleElement = document.createElement("link");
        styleElement.id = id;
        styleElement.rel = "stylesheet";
        styleElement.type = "text/css";
        styleElement.href = url;
        const pluginsStyle = document.querySelector("#pluginsStyle");
        if (pluginsStyle) {
            pluginsStyle.before(styleElement);
        } else {
            document.getElementsByTagName("head")[0].appendChild(styleElement);
        }
    }
};

// 从思源源码中复制的addScript
export const addScript = (path: string, id: string) => {
    return new Promise((resolve) => {
        if (document.getElementById(id)) {
            // 脚本加载后再次调用直接返回
            resolve(false);
            return false;
        }
        const scriptElement = document.createElement("script");
        scriptElement.src = path;
        scriptElement.async = true;
        // 循环调用时 Chrome 不会重复请求 js
        document.head.appendChild(scriptElement);
        scriptElement.onload = () => {
            if (document.getElementById(id)) {
                // 循环调用需清除 DOM 中的 script 标签
                scriptElement.remove();
                resolve(false);
                return false;
            }
            scriptElement.id = id;
            resolve(true);
        };
    });
};
