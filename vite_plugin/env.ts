import path from "path";
import { normalizePath, Plugin, ResolvedConfig } from "vite";

// 支持三种格式：#{xxx}、[xxx] 和 {xxx}
// match[1] 是 #{xxx} 格式的捕获组
// match[2] 是 [xxx] 格式的捕获组
// match[3] 是 {xxx} 格式的捕获组

const transformCode = `
for (const key in ENV) {
  let value = ENV[key];
  if (typeof value === 'string') {
    if (value.includes('[protocol]')) {
      value = value.replace('[protocol]', location.protocol);
    }
    
    if (value.includes('[host]')) {
      value = value.replace('[host]', location.host);
    }
    
    if (value.includes('[port]')) {
      value = value.replace('[port]', location.port);
    }
    
    if (value.includes('[hostname]')) {
      value = value.replace('[hostname]', location.hostname);
    }
    
    ENV[key] = value;
  }
}
`;
/**
 * 在静态目录中生成环境配置
 * @param envPath 默认值 /config/env.js
 */
export function envPlugin(envPath: string = "/config/env.js"): Plugin {
  let config: ResolvedConfig;
  envPath = normalizePath(path.join("/", envPath));
  return {
    name: "EnvPlugin",
    async configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    async generateBundle() {
      config.env.DEVELOPMENT = false;
      let code = buildCode(config.env);
      this.emitFile({
        type: 'asset',
        fileName: envPath.substring(1),
        source: code,
      });
    },
    configureServer(server) {
      config.env.DEVELOPMENT = true;
      server.middlewares.use((req, res, next) => {
        if (req.url == envPath) {
          let code = buildCode(config.env);
          res.end(code);
        } else {
          next();
        }
      });
    },
    transformIndexHtml(html) {
      html = html.replace('<head>', `<head>\n  <script src="${envPath}"></script>`);
      return html;
    },
  };
}

function buildCode(env: Record<string, any>) {
  let code = "ENV=" + JSON.stringify(env) + ";" + transformCode;
  return code.split("\n").join("");
}