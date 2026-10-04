"""Browser test: build a study from scratch in the builder (every Lens 2 page
type), edit text in English and Persian, break and fix a setting, download,
and check the file with the validator.  Run: python scripts/e2e/builder_build.py [out-dir]
with `npm start` running (no game server needed)."""
from playwright.sync_api import sync_playwright
import sys, json, time, subprocess, os
out=sys.argv[1] if len(sys.argv) > 1 else "."
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":1440,"height":900}, accept_downloads=True); pg=ctx.new_page()
    errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append("console: "+m.text[:300]) if m.type=="error" and "ERR_TUNNEL" not in m.text and "defaultProps" not in m.text and "Failed to load resource" not in m.text else None)
    pg.goto("http://localhost:3000/#/builder"); pg.wait_for_timeout(2500)
    # fresh study
    pg.get_by_role("button", name="New").click(); pg.get_by_role("button", name="New study").click()
    pg.get_by_label("Study id (file name)").fill("builder-test")
    labels=["Choice questions / scale","Prolific ID","Stroop","Go/No-Go","N-back","BART","Dictator game","Ultimatum game","Multiplayer game (live)"]
    for lab in labels:
        pg.get_by_role("button", name="Add page").click()
        pg.get_by_role("menuitem", name=lab, exact=True).click()
        pg.wait_for_timeout(500)
        fields=pg.locator(".lb-editor .lb-field").count()
        print(f"{lab:28} fields={fields}")
        if lab in ("Choice questions / scale","Stroop","Ultimatum game"):
            pg.screenshot(path=f"{out}/b-{lab.split()[0].lower()}.png", full_page=False)
    print("pages:", pg.locator(".lb-page-list > li").count())
    # edit the scale: first question text, tick required on 2nd, then Persian text
    pg.locator(".lb-page-list > li").nth(1).click(); pg.wait_for_timeout(300)
    rows=pg.locator(".lb-editor .lb-list-row")
    rows.nth(0).locator("input").first.fill("I enjoy puzzles.")
    rows.nth(1).locator("input[type=checkbox]").check()
    pg.get_by_role("button", name="فارسی").click(); pg.wait_for_timeout(400)
    rows=pg.locator(".lb-editor .lb-list-row")
    rows.nth(0).locator("input").first.fill("از معما لذت می‌برم.")
    pg.wait_for_timeout(1200)
    pg.screenshot(path=f"{out}/b-farsi.png")
    pg.get_by_role("button", name="English").click(); pg.wait_for_timeout(300)
    # break something: nback too many
    pg.locator(".lb-page-list > li").nth(5).click(); pg.wait_for_timeout(300)
    pg.get_by_label("Nback", exact=True).fill("50"); pg.wait_for_timeout(800)
    print("problem chip:", pg.locator(".MuiChip-label").inner_text())
    print("issues on page:", [t.inner_text() for t in pg.locator(".lb-issue").all()][:3])
    pg.get_by_label("Nback", exact=True).fill("2"); pg.wait_for_timeout(800)
    print("problem chip after fix:", pg.locator(".MuiChip-label").inner_text())
    # download
    with pg.expect_download() as d:
        pg.get_by_role("button", name="Download").click()
    path=d.value.path(); data=json.load(open(path))
    json.dump(data, open(f"{out}/builder-test.json","w"), indent=2)
    pg.wait_for_timeout(500); pg.screenshot(path=f"{out}/b-download.png")
    print("downloaded views:", [v["type"] for v in data["views"]], "string langs:", list(data.get("strings",{}).keys()))
    print("matrix:", json.dumps({k:data["views"][1][k] for k in ("questions","requiredQuestions") if k in data["views"][1]})[:300])
    print("errors:", errs[:6])
    assert not errs
    b.close()
root=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
r=subprocess.run(["node","scripts/validate-studies.js",os.path.abspath(f"{out}/builder-test.json")],cwd=root,capture_output=True,text=True)
print(r.stdout.strip().splitlines()[-1]); assert r.returncode==0
print("BUILDER BUILD OK")
