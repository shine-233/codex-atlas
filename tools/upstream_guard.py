"""上游抓取守卫：本目录脚本只允许访问固定的公开上游域名。

站点数据里携带的路径/提交号会拼进 URL，为防 SSRF（内网、云元数据、
本机服务、DNS rebinding），这里统一做四层校验：
1. 协议必须是 https（上游全是 https）
2. 主机名必须在白名单内
3. 域名解析出的所有 IP 必须是公网地址（阻断私网/环回/链路本地/保留段）
4. URL 不得包含凭据、控制字符或空白；重定向目标同样过守卫
"""

import ipaddress
import socket
import urllib.parse
import urllib.request

ALLOWED_HOSTS = {
    "raw.githubusercontent.com",
    "api.github.com",
    "github.com",
    "codeload.github.com",
    "objects.githubusercontent.com",
}


def _assert_public_ips(hostname):
    infos = socket.getaddrinfo(hostname, None)
    if not infos:
        raise ValueError(f"upstream host did not resolve: {hostname!r}")
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            raise ValueError(f"upstream host resolved to non-public address: {hostname!r} -> {ip}")


def guard_url(url):
    p = urllib.parse.urlparse(url)
    if p.scheme != "https":
        raise ValueError(f"refusing non-https upstream url: {url!r}")
    if p.username or p.password:
        raise ValueError(f"refusing url with credentials: {url!r}")
    if p.hostname not in ALLOWED_HOSTS:
        raise ValueError(f"refusing non-upstream host: {url!r}")
    if any(ch in url for ch in ("\n", "\r", "\t", " ", "'", '"', "<", ">")):
        raise ValueError(f"refusing malformed url: {url!r}")
    _assert_public_ips(p.hostname)
    return url


class GuardedRedirectHandler(urllib.request.HTTPRedirectHandler):
    """重定向目标同样必须过守卫，防止 30x 跳去内网。"""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        guard_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


_OPENER = urllib.request.build_opener(GuardedRedirectHandler())


def open_guarded(url, headers=None, timeout=30, binary=False):
    req = urllib.request.Request(guard_url(url), headers=headers or {})
    with _OPENER.open(req, timeout=timeout) as r:
        data = r.read()
    return data if binary else data.decode("utf-8")
