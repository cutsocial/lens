"""Browser test: the builder's JSON view. Picking a page scrolls to it, edits
apply to the study (page list, preview), broken JSON is flagged and not
applied, the cursor selects pages, and a round trip through the JSON view
leaves the file identical.  Run with `npm start` running:
python scripts/e2e/builder_json.py [screenshot-dir]
Also: study settings highlight in the JSON, and dragging pages in the page list."""
from playwright.sync_api import sync_playwright
import json, os, sys
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SHOTS=sys.argv[1] if len(sys.argv)>1 else None
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1440,"height":900}, accept_downloads=True)
    errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    pg.goto("http://localhost:3000/#/builder"); pg.wait_for_timeout(2500)
    pg.get_by_role("button", name="Open").click()
    pg.get_by_placeholder("e.g. demo-lens2").fill("demo-lens2")
    pg.get_by_role("dialog").get_by_role("button", name="Open", exact=True).click()
    pg.wait_for_timeout(800)
    pages=pg.locator(".lb-page-list > li button.lb-page")
    n=pages.count()

    pg.get_by_role("button", name="JSON", exact=True).click()
    pg.wait_for_selector(".cm-editor"); pg.wait_for_timeout(500)
    editor=pg.locator(".cm-content")

    # picking a page scrolls the JSON to it and highlights it
    target=n-2
    pages.nth(target).click(); pg.wait_for_timeout(400)
    top=pg.evaluate("""() => { const s=document.querySelector('.cm-scroller'); const f=document.querySelector('.lb-json-page-first');
        return f ? [Math.round(f.getBoundingClientRect().top - s.getBoundingClientRect().top), s.scrollTop] : null }""")
    print("page", target+1, "highlight top/scrollTop:", top)
    assert top and 0 <= top[0] < 80 and top[1] > 0
    if SHOTS: pg.screenshot(path=f"{SHOTS}/b-json.png")

    # an edit in the JSON shows up in the page list and preview
    first_id=json.load(open(f"{ROOT}/public/experiments/demo-lens2.json"))["views"][0]["id"]
    pages.nth(0).click(); pg.wait_for_timeout(300)
    pg.locator(".cm-line", has_text=f'"id": "{first_id}"').first.click()
    pg.keyboard.press("End"); pg.keyboard.press("ArrowLeft"); pg.keyboard.press("ArrowLeft"); pg.keyboard.type("-edited")
    pg.wait_for_timeout(500)
    assert pg.locator(".lb-page-list > li").nth(0).locator(".lb-page-sub").count() == 1
    pg.get_by_role("button", name="Form", exact=True).click(); pg.wait_for_timeout(300)
    assert pg.get_by_label("Page id").input_value() == f"{first_id}-edited", pg.get_by_label("Page id").input_value()
    pg.get_by_role("button", name="JSON", exact=True).click(); pg.wait_for_selector(".cm-editor"); pg.wait_for_timeout(300)

    # broken JSON: flagged, not applied; fixing it applies again
    pg.locator(".cm-line", has_text=f'"id": "{first_id}-edited"').first.click()
    pg.keyboard.press("End"); pg.keyboard.press("Backspace")  # remove the comma
    pg.wait_for_timeout(400)
    status=pg.locator(".lb-json-status").inner_text(); print("broken:", status)
    assert "Not valid JSON: comma expected (line 11)" in status, status
    assert pg.locator(".cm-lint-marker-error").count() >= 1
    if SHOTS: pg.screenshot(path=f"{SHOTS}/b-json-error.png")
    pg.keyboard.type(","); pg.wait_for_timeout(400)
    assert "apply" in pg.locator(".lb-json-status").inner_text()

    # take the id edit back out
    pg.keyboard.press("ArrowLeft"); pg.keyboard.press("ArrowLeft")
    for _ in range(len("-edited")): pg.keyboard.press("Backspace")
    pg.wait_for_timeout(400)
    # the editor's undo works (and redo)
    idline=lambda: pg.evaluate("() => [...document.querySelectorAll('.cm-line')].map(l=>l.textContent).find(t=>t.includes('survey_intro') && t.includes('\"id\"'))")
    print("after delete:", idline())
    pg.keyboard.press("Control+z"); pg.wait_for_timeout(300); print("undo:", idline())
    assert "-edited" in idline()
    pg.keyboard.press("Control+y"); pg.wait_for_timeout(300); print("redo:", idline())
    assert "-edited" not in idline()

    # the cursor selects the page it's in (moving up out of the BART page)
    types=[v["type"] for v in json.load(open(f"{ROOT}/public/experiments/demo-lens2.json"))["views"]]
    bi=types.index("bart2")
    pages.nth(bi).click(); pg.wait_for_timeout(400)
    editor.focus()
    for _ in range(3): pg.keyboard.press("ArrowUp")
    pg.wait_for_timeout(300)
    on=pg.locator(".lb-page-list > li").nth(bi-1).locator("button.lb-page").get_attribute("class")
    print("cursor moved above BART -> previous page selected:", "lb-page-on" in on)
    assert "lb-page-on" in on

    # a check's problem is marked in the JSON
    pages.nth(bi).click(); pg.wait_for_timeout(400)
    pg.locator(".cm-line", has_text='"type": "bart2"').first.click()
    pg.keyboard.press("End"); pg.keyboard.press("ArrowLeft"); pg.keyboard.press("ArrowLeft")
    pg.keyboard.type("x")   # "bart2x" is not a page type
    for _ in range(50):
        if pg.locator(".cm-lint-marker-error").count(): break
        pg.wait_for_timeout(100)
    marks=pg.locator(".cm-lint-marker-error").count(); print("error markers for bad type:", marks)
    assert marks >= 1
    if SHOTS: pg.screenshot(path=f"{SHOTS}/b-json-problem.png")
    pg.keyboard.press("Backspace"); pg.wait_for_timeout(800)

    # round trip: nothing changed, file is identical
    with pg.expect_download() as d:
        pg.get_by_role("button", name="Download").click()
    got=json.load(open(d.value.path()))
    pg.get_by_role("button", name="Done").click()
    orig=json.load(open(f"{ROOT}/public/experiments/demo-lens2.json")); orig.setdefault("studyId","demo-lens2")
    print("identical after edits undone:", got==orig)
    if got!=orig:
        print([ (i,a.get("id"),bb.get("id")) for i,(a,bb) in enumerate(zip(got["views"],orig["views"])) if a!=bb][:3], set(got)^set(orig))
    assert got==orig
    # study settings: in the JSON view, the top-level settings lines are highlighted
    pg.locator("button.lb-page-settings").click(); pg.wait_for_timeout(400)
    hl=pg.evaluate("() => [...document.querySelectorAll('.lb-json-page')].map(l=>l.textContent.trim().split(':')[0])")
    print("settings highlight:", hl)
    assert '"studyId"' in hl and '"views"' not in hl

    # drag a page to a new place in the page list
    titles=lambda: [t.inner_text() for t in pg.locator(".lb-page-list > li .lb-page-sub").all()]
    before=titles()
    pg.locator(".lb-page-list > li").nth(2).locator("button.lb-page").drag_to(
        pg.locator(".lb-page-list > li").nth(0).locator("button.lb-page"), target_position={"x": 40, "y": 5})
    pg.wait_for_timeout(400)
    after=titles()
    print("dragged page 3 to the top:", after[:3])
    assert after[0]==before[2] and after[1]==before[0] and after[2]==before[1]
    assert pg.locator(".lb-page-list > li").nth(0).locator("button.lb-page.lb-page-on").count()==1
    # and down: back below the fourth page (just under the two it passed)
    pg.locator(".lb-page-list > li").nth(0).locator("button.lb-page").drag_to(
        pg.locator(".lb-page-list > li").nth(3).locator("button.lb-page"), target_position={"x": 40, "y": 50})
    pg.wait_for_timeout(400)
    print("dragged it down below page 4:", titles()[:4])
    assert titles()[:4]==[before[0], before[1], before[3], before[2]]
    ids=pg.evaluate("() => JSON.parse(localStorage.getItem('lens-builder-draft-v1')).study.views.map(v=>v.id)")
    orig=[v["id"] for v in json.load(open(f"{ROOT}/public/experiments/demo-lens2.json"))["views"]]
    assert ids[:4]==[orig[0],orig[1],orig[3],orig[2]] and ids[4:]==orig[4:]

    print("page errors:", errs[:5]); assert not errs
    print("BUILDER JSON OK")
    b.close()
