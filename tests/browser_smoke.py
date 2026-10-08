"""Non-destructive Zenix POS browser smoke for a LOCAL or explicitly named STAGING host.

Run after a clean Vite build/preview and staging API setup:
  ZENIX_STAGING_URL=http://localhost:4173 python tests/browser_smoke.py
  ZENIX_STAGING_URL=https://staging.example.com ZENIX_E2E_USERNAME=... \
      ZENIX_E2E_PASSWORD=... python tests/browser_smoke.py

Requires `pip install playwright` and `playwright install chromium`.
Never points at a production hostname or registers/mutates a business.
"""
from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright


def staging_base_url() -> str:
    url = os.getenv("ZENIX_STAGING_URL", "").rstrip("/")
    parsed = urlsplit(url)
    host = (parsed.hostname or "").lower()
    loopback = host in ("localhost", "127.0.0.1", "::1")
    staging = "staging" in host or "preview" in host
    if parsed.scheme not in ("http", "https") or not (loopback or staging):
        raise RuntimeError("ZENIX_STAGING_URL must be a local or explicitly named staging/preview host")
    if not loopback and parsed.scheme != "https":
        raise RuntimeError("Remote staging browser checks require HTTPS")
    return url


def main() -> None:
    base = staging_base_url()
    user = os.getenv("ZENIX_E2E_USERNAME", "")
    password = os.getenv("ZENIX_E2E_PASSWORD", "")
    if bool(user) != bool(password):
        raise RuntimeError("Set both ZENIX_E2E_USERNAME and ZENIX_E2E_PASSWORD, or neither")
    output = Path(os.getenv("ZENIX_E2E_ARTIFACTS", "browser-smoke-artifacts"))
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            for width in (320, 375, 430, 1440):
                ctx = browser.new_context(viewport={"width": width, "height": 900}, device_scale_factor=1)
                page = ctx.new_page()
                page.goto(f"{base}/login", wait_until="domcontentloaded", timeout=30000)
                page.get_by_role("heading", name="Tizimga kirish").wait_for(timeout=20000)
                page.locator('input[autocomplete="username"]').wait_for()
                page.locator('input[autocomplete="current-password"]').wait_for()
                if width <= 430:
                    viewport_fits = page.evaluate(
                        "() => document.documentElement.scrollWidth <= window.innerWidth + 2"
                    )
                    assert viewport_fits, f"Login overflows {width}px viewport"
                page.screenshot(path=str(output / f"login-{width}.png"), full_page=True)
                print(f"PASS: login renders at {width}px")
                ctx.close()

            # Optional staging demo account, read-only navigation only.
            if user:
                ctx = browser.new_context(viewport={"width": 1440, "height": 900})
                page = ctx.new_page()
                page.goto(f"{base}/login", wait_until="domcontentloaded", timeout=30000)
                page.locator('input[autocomplete="username"]').fill(user)
                page.locator('input[autocomplete="current-password"]').fill(password)
                page.locator('button.auth-submit').click()
                page.wait_for_url(lambda url: "/login" not in url.path, timeout=20000)
                page.screenshot(path=str(output / "post-login.png"), full_page=True)
                print(f"PASS: staging account login navigates to {urlsplit(page.url).path}")
                ctx.close()
            else:
                print("SKIP: authenticated staging browser navigation (no E2E credentials)")
        finally:
            browser.close()


if __name__ == "__main__":
    main()
