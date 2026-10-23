#!/usr/bin/env node
// bot.js —— web二进制启动器（Node版，与bot.py同契约）。
// 逻辑：CONFIG非空项注入环境（面板环境变量优先）→ 定位web二进制 → chmod+x → 拉起 → 转发SIGTERM/SIGINT → 透传退出码。
// 零依赖，只用Node内置模块。

const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CONFIG = {
  UUID: "", // 节点UUID，三协议共用
  ARGO_DOMAIN: "", // Argo固定隧道域名，空则订阅用占位域名
  ARGO_AUTH: "", // Argo隧道token，空则不起隧道
  ARGO_PORT: "8001", // 隧道源站监听端口，dashboard ingress指到本机此端口
  PORT: "", // HTTP订阅端口，填面板分配的端口
  SUB_PATH: "sub", // 订阅路径，访问 PORT/SUB_PATH 取订阅
  CFIP: "", // 优选IP/域名，节点地址用它
  CFPORT: "443", // 优选端口
  NAME: "", // 节点名前缀，空则用协议默认名
  SHOW_LOG: "no", // 日志总闸：no/false/disable=全静默
  DEBUG: "", // true=多打调试行，默认关闭
  WSPATH: "", // 三WS统一路径，空=默认UUID去横线前8
  DOMAIN: "", // 直连节点域名/IP，空则直连链接跳过
  SECURITY: "", // 直连WS用tls还是none；tls要求前面有TLS卸载点
  PUBLIC_PORT: "", // SECURITY=tls时直连三件套的公开端口，默认443
  SERVER_PORT: "", // 容器分配端口，优先于PORT做HTTP监听
  S5_PORT: "", // SOCKS5端口，空=不开启
  HY2_PORT: "", // HY2端口(UDP)，空=不开启
  SS_PORT: "", // SS直连端口，空=不开启
  SS_METHOD: "aes-256-gcm", // SS加密方法，2022系列填2022-blake3-aes-128-gcm等
  SS_PASSWORD: "", // SS密码，空则用UUID(2022系列自动派生base64密钥)
  SS_WS: "yes", // yes=开SS-over-WS(v2ray-plugin,走Argo隧道)，需客户端支持v2ray-plugin；默认开
  REALITY_PORT: "", // Reality端口，空=不开启
  REALITY_SNI: "www.microsoft.com", // Reality伪装域名
  CFSM_URL: "", // CF探针面板地址，缺一即跳过探针
  CFSM_ID: "", // CF探针服务器ID
  CFSM_SECRET: "", // CF探针上报密钥
  CFSM_INTERVAL: "60", // 上报间隔秒，最小10
  GOMEMLIMIT: "90MiB", // Go堆上限，防小内存面板被顶满
  // ENV_FILE: ".env", // 额外env文件路径，一般不用动
  // BOT_BIN: "", // web二进制改名时填，空=.tmp目录下web
};

function main() {
  const here = __dirname;
  for (const [k, v] of Object.entries(CONFIG)) {
    if (v && !(k in process.env)) {
      process.env[k] = String(v);
    }
  }
  let target = process.env.BOT_BIN;
  if (!target) {
    target = path.join(here, ".tmp", os.arch() === "arm64" ? "web-arm64" : "web");
  }
  if (!path.isAbsolute(target)) {
    target = path.join(here, target);
  }
  if (os.platform() !== "win32") {
    try {
      const st = fs.statSync(target);
      fs.chmodSync(target, st.mode | 0o111);
    } catch (_) {
      // 忽略：文件可能尚不存在，交由下方的存在性检查报错
    }
  }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    console.log(`bot: target not found: ${target}`);
    process.exitCode = 1;
    return;
  }
  const proc = spawn(target, { stdio: "inherit" });

  const forward = (sig) => {
    try {
      proc.kill(sig);
    } catch (_) {
      // 子进程可能已退出，忽略
    }
  };
  process.on("SIGTERM", () => forward("SIGTERM"));
  process.on("SIGINT", () => forward("SIGINT"));

  proc.on("exit", (code, signal) => {
    if (signal) {
      // 被信号杀死时按惯例返回128+信号编号，SIGTERM=15 → 143
      process.exitCode = signal === "SIGTERM" ? 143 : 130;
    } else {
      process.exitCode = code === null ? 1 : code;
    }
  });
  proc.on("error", (err) => {
    console.log(`bot: failed to start target: ${err.message}`);
    process.exitCode = 1;
  });
}

main();
