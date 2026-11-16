#!/usr/bin/env python3
"""Purge EdgeOne node cache after a deployment.

Required env: TENCENTCLOUD_SECRET_ID, TENCENTCLOUD_SECRET_KEY, EDGEONE_ZONE_ID
Optional env: PURGE_HOSTS (comma separated, defaults to yeranyang.com)

Uses CreatePurgeTask (teo.tencentcloudapi.com, version 2022-09-01) with
purge_host + delete so the next request always fetches the freshly synced
files from the origin.
"""
import os
import sys

from tencentcloud.common import credential
from tencentcloud.common.profile.client_profile import ClientProfile
from tencentcloud.common.profile.http_profile import HttpProfile
from tencentcloud.teo.v20220901 import models, teo_client


def main():
    secret_id = os.environ.get("TENCENTCLOUD_SECRET_ID", "").strip()
    secret_key = os.environ.get("TENCENTCLOUD_SECRET_KEY", "").strip()
    zone_id = os.environ.get("EDGEONE_ZONE_ID", "").strip()
    hosts = [
        host.strip()
        for host in (os.environ.get("PURGE_HOSTS") or "yeranyang.com").split(",")
        if host.strip()
    ]

    missing = [
        name
        for name, value in (
            ("TENCENTCLOUD_SECRET_ID", secret_id),
            ("TENCENTCLOUD_SECRET_KEY", secret_key),
            ("EDGEONE_ZONE_ID", zone_id),
        )
        if not value
    ]
    if missing:
        sys.exit("Missing required environment variables: " + ", ".join(missing))
    if not hosts:
        sys.exit("PURGE_HOSTS resolved to an empty list")

    cred = credential.Credential(secret_id, secret_key)
    http_profile = HttpProfile()
    http_profile.endpoint = "teo.tencentcloudapi.com"
    client_profile = ClientProfile()
    client_profile.httpProfile = http_profile
    client = teo_client.TeoClient(cred, "", client_profile)

    req = models.CreatePurgeTaskRequest()
    req.ZoneId = zone_id
    req.Type = "purge_host"
    req.Targets = hosts
    req.Method = "delete"

    resp = client.CreatePurgeTask(req)
    failed = getattr(resp, "FailedList", None) or []
    for item in failed:
        print("EdgeOne purge failed target: %s" % item, file=sys.stderr)
    if failed:
        sys.exit("EdgeOne reported %d failed target(s)" % len(failed))

    print("EdgeOne cache purged: JobId=%s, hosts=%s" % (resp.JobId, ", ".join(hosts)))


if __name__ == "__main__":
    main()
