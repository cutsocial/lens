"""Browser test: practice round in Persian (right to left), a partner who closes
the tab, and a partner who stops responding (turnTimeout). See README.md."""
import json, time, sys
from playwright.sync_api import sync_playwright
OUT=sys.argv[1] if len(sys.argv) > 1 else "."
URL="http://localhost:3000/#/test-multiplayer/{lang}?PROLIFIC_PID={pid}"
def mk(b, pid, lang="en", subs=None):
    pg=b.new_context(viewport={"width":390,"height":844}).new_page()
    def h(r):
        if subs is not None and r.request.method=="POST": subs.append(json.loads(r.request.post_data))
        r.fulfill(status=200, content_type="application/json", body='{"submissionCode":"T","submissionId":"x"}')
    pg.route("http://localhost:8091/**", h)
    pg.goto(URL.format(lang=lang,pid=pid)); return pg
def btn(pg,name): pg.get_by_role("button",name=name,exact=True).click(timeout=15000)
def practice_en(pg):
    btn(pg,"Start")
    pg.get_by_text("Practice round").wait_for(timeout=10000)
    for _ in range(6): pg.locator('[data-pile="me"] .l2-step').nth(1).click()
    btn(pg,"Send offer"); pg.locator(".l2-mp-result").wait_for(timeout=10000); btn(pg,"Continue")
    pg.get_by_text("That was the practice").wait_for(timeout=10000)
    btn(pg,"Start")
with sync_playwright() as p:
    b=p.chromium.launch()
    # 1) practice, then a partner who closes the tab mid-game (Persian, right to left)
    sa=[]; A=mk(b,"PA","fa",sa)
    btn(A,"شروع")
    A.get_by_text("دور تمرینی").wait_for(timeout=10000)
    A.screenshot(path=f"{OUT}/fa-practice.png")
    for _ in range(6): A.locator("[data-pile=\"me\"] .l2-step").nth(1).click()
    btn(A,"ارسال پیشنهاد")
    A.get_by_text("سکه‌ها تقسیم شد").wait_for(timeout=10000)
    btn(A,"ادامه")
    A.get_by_text("دور تمرینی تمام شد").wait_for(timeout=10000)
    btn(A,"شروع")
    A.get_by_text("در حال پیدا کردن").wait_for(timeout=10000)
    B=mk(b,"PB")
    practice_en(B)
    A.locator(".l2-token-area").wait_for(timeout=10000)
    B.get_by_text("deciding how to split").wait_for(timeout=10000)
    B.close()   # partner closes the tab
    A.get_by_text("فرد دیگر بازی را ترک کرد").wait_for(timeout=10000)
    A.screenshot(path=f"{OUT}/fa-partner-left.png")
    btn(A,"ادامه")
    deadline=time.time()+10
    while not sa and time.time()<deadline: A.wait_for_timeout(200)
    r=sa[0]["responses"][0]["response"]
    print("left:", r["partnerKind"], r["completed"], r["abandonedBy"], r["endReason"], "practice rounds:", r["practice"]["roundsPlayed"], "debrief:", r["debriefShown"])
    assert r["abandonedBy"]=="partner" and r["endReason"]=="left" and r["practice"]["practice"] is True and r["debriefShown"]

    # 2) a partner who goes silent: the match ends after turnTimeout (10 s)
    sc=[]; C=mk(b,"PC","en",sc)
    practice_en(C)
    C.get_by_text("Finding another participant").wait_for(timeout=10000)
    D=mk(b,"PD"); practice_en(D)
    D.get_by_text("deciding how to split").wait_for(timeout=10000)
    # C proposes, D (responder) never responds; D's tab stays open but idle
    for _ in range(3): C.locator("[data-pile=\"me\"] .l2-step").nth(1).click()
    for _ in range(3): C.locator("[data-pile=\"other\"] .l2-step").nth(1).click()
    btn(C,"Send offer")
    t0=time.time()
    C.get_by_text("left the game").wait_for(timeout=25000)
    print(f"silent partner ended after {time.time()-t0:.1f}s")
    D.get_by_text("no response came from you").wait_for(timeout=10000)   # the silent one is told why
    btn(C,"Continue")
    deadline=time.time()+10
    while not sc and time.time()<deadline: C.wait_for_timeout(200)
    r=sc[0]["responses"][0]["response"]
    print("timeout:", r["endReason"], r["abandonedBy"], r["roundsPlayed"])
    assert r["endReason"]=="timeout" and r["abandonedBy"]=="partner"
    b.close()
print("EDGE OK")
