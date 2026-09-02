#!/usr/bin/env python3
import argparse
import json
import os
import sys
import urllib.request


def request_json(url, payload):
    body = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=body, headers={"content-type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=20) as response:
        return json.loads(response.read().decode())


def main():
    parser = argparse.ArgumentParser(prog="co08", description="Create a DNS-only SSH hostname under co08.art")
    sub = parser.add_subparsers(dest="command", required=True)
    ssh = sub.add_parser("ssh", help="request a hostname for this VPS")
    ssh.add_argument("--server", default=os.getenv("CO08_SERVER", "https://co08.art"))
    ssh.add_argument("--token", default=os.getenv("CO08_TOKEN"), help="one-time token from the CO08 dashboard")
    ssh.add_argument("--ip", default=None, help="public IPv4; defaults to automatic detection by the server script")
    ssh.add_argument("--user", default="root", help="SSH username to print")
    ssh.add_argument("--port", type=int, default=22, help="SSH port to print")
    args = parser.parse_args()
    if not args.token:
        parser.error("--token or CO08_TOKEN is required; generate it from the dashboard")
    if not 1 <= args.port <= 65535:
        parser.error("--port must be between 1 and 65535")
    payload = {"token": args.token, "ip": args.ip or "", "user": args.user, "port": args.port}
    try:
        result = request_json(args.server.rstrip("/") + "/api/bootstrap/complete", payload)
    except Exception as exc:
        print(f"co08: bootstrap failed: {exc}", file=sys.stderr)
        return 1
    if not result.get("success"):
        print(f"co08: {result.get('error', 'bootstrap failed')}", file=sys.stderr)
        return 1
    host = result["hostname"]
    print(f"Hostname: {host}")
    print(f"SSH: ssh -p {args.port} {args.user}@{host}")
    print(f"Management ID: {result.get('management_id', host)}")
    print(f"Management proof: {result.get('management_proof', 'Use the proof returned by the dashboard')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
