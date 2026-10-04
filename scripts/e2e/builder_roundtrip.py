"""Browser test: open published studies in the builder, visit every page, and
download them unchanged; the file must come back identical (the builder
never rewrites what you didn't touch).  Run with `npm start` running:
python scripts/e2e/builder_roundtrip.py [id,id,...]"""
from playwright.sync_api import sync_playwright
import json, sys, os
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ids=(sys.argv[1] if len(sys.argv)>1 else "demo-comprehensive,demo-lens2,mad2023,mad2020b,test-multiplayer,taskswitch").split(",")
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1440,"height":900}, accept_downloads=True)
    errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    pg.goto("http://localhost:3000/#/builder"); pg.wait_for_timeout(2500)
    for sid in ids:
        pg.get_by_role("button", name="Open").click()
        pg.get_by_placeholder("e.g. demo-lens2").fill(sid)
        pg.get_by_role("dialog").get_by_role("button", name="Open", exact=True).click()
        pg.wait_for_timeout(800)
        n=pg.locator(".lb-page-list > li").count()
        for i in range(n):
            pg.locator(".lb-page-list > li").nth(i).locator("button.lb-page").click()
            pg.wait_for_timeout(60)
        pg.locator("button.lb-page-settings").click(); pg.wait_for_timeout(100)
        chip=pg.locator(".MuiChip-label").inner_text()
        with pg.expect_download() as d:
            pg.get_by_role("button", name="Download").click()
        got=json.load(open(d.value.path()))
        pg.get_by_role("button", name="Done").click()
        orig=json.load(open(f"{ROOT}/public/experiments/{sid}.json"))
        orig2=dict(orig); orig2.setdefault("studyId", sid)
        same = got==orig2
        print(f"{sid:28} pages={n:3} chip='{chip}' round-trip identical={same}")
        if not same:
            diff=[k for k in set(got)|set(orig2) if got.get(k)!=orig2.get(k)]
            print("   differs in:", diff)
        assert same, sid
    print("page errors:", errs[:5])
    assert not errs
    print("BUILDER ROUND-TRIP OK")
    b.close()
