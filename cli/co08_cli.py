#!/usr/bin/env python3
"""CO08 command line client.

The client stores only the API token locally. Password prompts are deliberately
local confirmation only; passwords and private keys are never sent to CO08.
"""
from __future__ import annotations

import argparse
import getpass
import json
import os
import stat
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Optional

DEFAULT_SERVER = "https://co08.art"
CONFIG_PATH = Path(os.environ.get("CO08_CONFIG", "~/.config/co08/config.json")).expanduser()


def request_json(server: str, path: str, *, token: Optional[str] = None,
                 payload: Optional[dict[str, Any]] = None, method: Optional[str] = None) -> dict[str, Any]:
    body = None if payload is None else json.dumps(payload).encode()
    headers = {"accept": "application/json"}
    if payload is not None:
        headers["content-type"] = "application/json"
    if token:
        headers["authorization"] = f"Bearer {token}"
    req = urllib.request.Request(server.rstrip("/") + path, data=body, headers=headers, method=method or ("POST" if body else "GET"))
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            raw = response.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        try:
            details = json.loads(exc.read().decode())
            message = details.get("error", f"HTTP {exc.code}")
        except Exception:
            message = f"HTTP {exc.code}"
        raise RuntimeError(message) from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise RuntimeError(f"could not reach {server}: {exc}") from exc


def load_config() -> dict[str, Any]:
    try:
        with CONFIG_PATH.open(encoding="utf-8") as handle:
            data = json.load(handle)
        return data if isinstance(data, dict) else {}
    except FileNotFoundError:
        return {}
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"cannot read {CONFIG_PATH}: {exc}") from exc


def save_config(data: dict[str, Any]) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix="co08-", dir=str(CONFIG_PATH.parent), text=True)
    try:
        os.fchmod(fd, stat.S_IRUSR | stat.S_IWUSR)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(data, handle, indent=2)
            handle.write("\n")
        os.replace(temp_name, CONFIG_PATH)
        os.chmod(CONFIG_PATH, stat.S_IRUSR | stat.S_IWUSR)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def server_for(args: argparse.Namespace, config: dict[str, Any]) -> str:
    return (args.server or config.get("server") or os.getenv("CO08_SERVER") or DEFAULT_SERVER).rstrip("/")


def token_for(args: argparse.Namespace, config: dict[str, Any]) -> str:
    token = args.token or os.getenv("CO08_TOKEN") or config.get("token")
    if not token:
        raise RuntimeError("not logged in; run `co08 login` first")
    return str(token)


def login(args: argparse.Namespace) -> int:
    server = server_for(args, {})
    token = args.token or os.getenv("CO08_TOKEN") or getpass.getpass("CO08 API token: ").strip()
    if not token:
        raise RuntimeError("a token is required")
    result = request_json(server, "/api/v1/hosts", token=token)
    if not result.get("success"):
        raise RuntimeError(result.get("error", "login failed"))
    save_config({"server": server, "token": token})
    print(f"Logged in to {server}")
    print(f"Saved token securely at {CONFIG_PATH} (mode 600)")
    print(f"Existing SSH hosts: {len(result.get('hosts', []))}")
    return 0


def logout(_: argparse.Namespace) -> int:
    try:
        CONFIG_PATH.unlink()
        print("Logged out and removed the local token.")
    except FileNotFoundError:
        print("Already logged out.")
    return 0


def ssh_command(host: dict[str, Any], user: str, port: int) -> str:
    return f"ssh -p {port} {user}@{host['hostname']}"


def ssh(args: argparse.Namespace) -> int:
    config = load_config()
    server = server_for(args, config)
    token = token_for(args, config)
    if not 1 <= args.port <= 65535:
        raise RuntimeError("--port must be between 1 and 65535")

    if not args.new:
        result = request_json(server, "/api/v1/hosts", token=token)
        hosts = result.get("hosts", [])
        if not hosts:
            print("No SSH hosts yet. Create one with: co08 ssh --new --ip PUBLIC_VPS_IP")
            return 0
        print("Your CO08 SSH hosts:")
        for host in hosts:
            print(f"  [{host.get('status', 'unknown')}] {ssh_command(host, args.user, args.port)}")
            print(f"       id={host.get('id')} ip={host.get('ip')}")
        return 0

    if not args.ip:
        raise RuntimeError("--ip is required for a new host; use the VPS public IPv4 address")
    first = getpass.getpass("New SSH password (local confirmation only): ")
    second = getpass.getpass("Repeat SSH password: ")
    if first != second:
        raise RuntimeError("passwords do not match")
    if not first:
        raise RuntimeError("password cannot be empty")
    del first, second
    result = request_json(server, "/api/v1/hosts", token=token, payload={"ip": args.ip, "ttl": args.ttl, "expires_in": args.expires_in})
    if not result.get("success"):
        raise RuntimeError(result.get("error", "host creation failed"))
    print(f"Hostname: {result['hostname']}")
    print(f"SSH: ssh -p {args.port} {args.user}@{result['hostname']}")
    print("Password was not uploaded or stored by CO08. Configure it directly on the VPS.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(prog="co08", description="CO08 SSH hostname client")
    sub = parser.add_subparsers(dest="command", required=True)

    p_login = sub.add_parser("login", help="validate and save a CO08 API token")
    p_login.add_argument("--server", default=None)
    p_login.add_argument("--token", default=None, help="token; omitted means hidden prompt")
    p_login.set_defaults(handler=login)

    p_logout = sub.add_parser("logout", help="remove the locally saved token")
    p_logout.set_defaults(handler=logout)

    p_ssh = sub.add_parser("ssh", help="list hosts, or create one with --new")
    p_ssh.add_argument("--server", default=None)
    p_ssh.add_argument("--token", default=None)
    p_ssh.add_argument("--new", action="store_true", help="create a new DNS-only SSH hostname")
    p_ssh.add_argument("--ip", default=None, help="public VPS IPv4 address")
    p_ssh.add_argument("--user", default="root")
    p_ssh.add_argument("--port", type=int, default=22)
    p_ssh.add_argument("--ttl", type=int, choices=(300, 600, 3600), default=300)
    p_ssh.add_argument("--expires-in", type=int, default=3600)
    p_ssh.set_defaults(handler=ssh)

    args = parser.parse_args()
    try:
        return int(args.handler(args))
    except RuntimeError as exc:
        print(f"co08: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
