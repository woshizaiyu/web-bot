#!/usr/bin/env python3

import os
import platform
import signal
import subprocess
import sys


CONFIG = {
    "UUID": "20e6e496-cf19-45c8-b883-14f5e11cd9f1",  # 节点UUID，三协议共用
    "ARGO_DOMAIN": "",  # Argo固定隧道域名，空则订阅用占位域名
    "ARGO_AUTH": "",  # Argo隧道token，空则不起隧道
    "ARGO_PORT": "8001",  # 隧道源站监听端口，dashboard ingress指到本机此端口
    "PORT": "",  # HTTP订阅端口，填面板分配的端口
    "SUB_PATH": "c1e5829bc402",  # 订阅路径，访问 PORT/SUB_PATH 取订阅
    "CFIP": "cf.877774.xyz",  # 优选IP/域名，节点地址用它
    "CFPORT": "443",  # 优选端口
    "NAME": "",  # 节点名前缀，空则用协议默认名
    "SHOW_LOG": "no",  # 日志总闸：no/false/disable=全静默
    "DEBUG": "",  # true=多打调试行，默认关闭
    "WSPATH": "",  # 三WS统一路径，空=默认UUID去横线前8
    "DOMAIN": "ldsceoceo-1nqwy.puratya.com",  # 直连节点域名/IP，空则直连链接跳过
    "SECURITY": "tls",  # 直连WS用tls还是none；tls要求前面有TLS卸载点
    "PUBLIC_PORT": "443",  # SECURITY=tls时直连三件套的公开端口，默认443
    "SERVER_PORT": "",  # 容器分配端口，优先于PORT做HTTP监听
    "S5_PORT": "",  # SOCKS5端口，空=不开启
    "HY2_PORT": "",  # HY2端口(UDP)，空=不开启
    "SS_PORT": "",  # SS直连端口，空=不开启
    "SS_METHOD": "aes-256-gcm",  # SS加密方法，2022系列填2022-blake3-aes-128-gcm等
    "SS_PASSWORD": "",  # SS密码，空则用UUID(2022系列自动派生base64密钥)
    "SS_WS": "yes",  # yes=开SS-over-WS(v2ray-plugin,走Argo隧道)，需客户端支持v2ray-plugin；默认开
    "REALITY_PORT": "",  # Reality端口，空=不开启
    "REALITY_SNI": "www.microsoft.com",  # Reality伪装域名
    "CFSM_URL": "",  # CF探针面板地址，缺一即跳过探针
    "CFSM_ID": "",  # CF探针服务器ID
    "CFSM_SECRET": "",  # CF探针上报密钥
    "CFSM_INTERVAL": "60",  # 上报间隔秒，最小10
    "GOMEMLIMIT": "90MiB",  # Go堆上限，防小内存面板被顶满
    # "ENV_FILE": ".env",  # 额外env文件路径，一般不用动
    # "BOT_BIN": "",  # web二进制改名时填，空=.tmp目录下web
}


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    for k, v in CONFIG.items():
        if v and k not in os.environ:
            os.environ[k] = str(v)
    target = os.environ.get("BOT_BIN")
    if not target:
        name = "web-arm64" if platform.machine().lower() in ("aarch64", "arm64") else "web"
        target = os.path.join(here, ".tmp", name)
    if not os.path.isabs(target):
        target = os.path.join(here, target)
    if os.name == "posix":
        try:
            st = os.stat(target)
            os.chmod(target, st.st_mode | 0o111)
        except OSError:
            pass
    if not os.path.isfile(target):
        print(f"bot: target not found: {target}", flush=True)
        return 1
    proc = subprocess.Popen([target])

    def forward(signum, frame):
        try:
            proc.send_signal(signum)
        except Exception:
            pass

    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            signal.signal(sig, forward)
        except Exception:
            pass
    try:
        return proc.wait()
    except KeyboardInterrupt:
        try:
            proc.terminate()
        except Exception:
            pass
        return proc.wait()


if __name__ == "__main__":
    sys.exit(main())
