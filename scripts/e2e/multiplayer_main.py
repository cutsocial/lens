"""End-to-end test of the multiplayer screen: two participants play each other,
then one participant plays the computer. Uses the local dev game server
(in-memory) and the Lens dev server; submissions are intercepted."""
import json, sys, time, re
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000/#/demo-multiplayer/en"
OUT = sys.argv[1] if len(sys.argv) > 1 else "."

def intercept(page, store):
    def handle(route):
        if route.request.method == "POST":
            store.append(json.loads(route.request.post_data))
        route.fulfill(status=200, content_type="application/json",
                      body=json.dumps({"submissionCode": "TEST1234", "submissionId": "x"}))
    page.route(re.compile(r"http://localhost:8091/.*"), handle)

def click(page, name, timeout=15000):
    page.get_by_role("button", name=name, exact=True).click(timeout=timeout)

def place_all(page, me, other, use_drag_for_one=True):
    """Give `other` tokens to the other person and `me` to self, with + buttons (one by drag)."""
    if use_drag_for_one and other > 0:
        coin = page.locator('[data-pile="pot"] .l2-coin').first
        target = page.locator('[data-pile="other"]')
        coin.drag_to(target)
        other -= 1
    for _ in range(other):
        page.get_by_role("button", name="Give Other person a token").click()
    for _ in range(me):
        page.get_by_role("button", name="Give You a token").click()

def text(page):
    return page.locator(".l2").inner_text()

with sync_playwright() as p:
    browser = p.chromium.launch()
    # ---------- two people ----------
    ctxA, ctxB = browser.new_context(viewport={"width": 390, "height": 844}), browser.new_context(viewport={"width": 390, "height": 844})
    A, B = ctxA.new_page(), ctxB.new_page()
    subsA, subsB = [], []
    intercept(A, subsA); intercept(B, subsB)
    errors = []
    for pg in (A, B):
        pg.on("pageerror", lambda e: errors.append(str(e)))
    A.goto(BASE + "?PROLIFIC_PID=PID_A&STUDY_ID=S1&SESSION_ID=SA")
    click(A, "Start")
    A.get_by_text("Finding another participant").wait_for(timeout=10000)
    A.screenshot(path=f"{OUT}/1-finding.png")
    B.goto(BASE + "?PROLIFIC_PID=PID_B&STUDY_ID=S1&SESSION_ID=SB")
    click(B, "Start")

    def proposer_now():
        deadline = time.time() + 15
        while time.time() < deadline:
            for pg in (A, B):
                if pg.get_by_text("split 10 tokens").is_visible():
                    return pg
            A.wait_for_timeout(200)
        raise AssertionError("nobody is proposing")

    plan = [(6, 4, "Accept"), (9, 1, "Reject"), (5, 5, "Accept")]
    earned = {"A": 0, "B": 0}
    proposers = []
    for rnd, (keep, give, answer) in enumerate(plan):
        P = proposer_now(); R = B if P is A else A
        proposers.append("A" if P is A else "B")
        R.get_by_text("is splitting the tokens").wait_for(timeout=10000)
        place_all(P, keep, give, use_drag_for_one=(rnd != 1))
        # the responder watches the split take shape before it is sent
        deadline = time.time() + 20
        while time.time() < deadline:
            other = R.locator('[data-pile="other"] .l2-count').inner_text()
            mine = R.locator('[data-pile="me"] .l2-count').inner_text()
            if (other, mine) == (str(keep), str(give)):
                break
            R.wait_for_timeout(100)
        assert (other, mine) == (str(keep), str(give)), ("live split", other, mine)
        assert R.get_by_role("button", name="Accept", exact=True).is_disabled(), "Accept must wait for the offer"
        if rnd == 0: R.screenshot(path=f"{OUT}/2b-watching.png")
        if rnd == 0: P.screenshot(path=f"{OUT}/2-propose.png")
        click(P, "Send offer")
        R.get_by_text("offers you").wait_for(timeout=10000)
        if rnd == 0: R.screenshot(path=f"{OUT}/3-respond.png")
        assert f"offers you {give} and keeps {keep}" in text(R).replace("\n", " "), text(R)
        time.sleep(0.3)
        click(R, answer)
        label = "Accepted" if answer == "Accept" else "Rejected"
        for pg in (A, B):
            pg.get_by_text(label, exact=True).wait_for(timeout=10000)
        if rnd == 0: A.screenshot(path=f"{OUT}/4-result.png")
        if answer == "Accept":
            earned[proposers[-1]] += keep; earned["B" if proposers[-1] == "A" else "A"] += give
        if rnd < 2:
            click(A, "Next round"); click(B, "Next round")
    print("proposers by round:", proposers, "expected totals:", earned)
    for pg in (A, B):
        click(pg, "Continue")
        pg.get_by_text("another participant in this study").wait_for(timeout=10000)
    A.screenshot(path=f"{OUT}/5-debrief-human.png")
    for pg in (A, B):
        click(pg, "Continue")
    deadline = time.time() + 15
    while (not subsA or not subsB) and time.time() < deadline:
        A.wait_for_timeout(300)
    assert subsA and subsB, "no submission"
    ra = subsA[0]["responses"][0]["response"]; rb = subsB[0]["responses"][0]["response"]
    json.dump({"A": subsA[0], "B": subsB[0]}, open(f"{OUT}/human-submissions.json", "w"), indent=1)
    print("A:", {k: ra[k] for k in ("matched", "partnerKind", "totalTokens", "roundsPlayed", "completed", "debriefShown", "endReason")})
    print("B:", {k: rb[k] for k in ("matched", "partnerKind", "totalTokens", "roundsPlayed", "completed", "debriefShown", "endReason")})
    assert (ra["totalTokens"], rb["totalTokens"]) == (earned["A"], earned["B"]), (ra["totalTokens"], rb["totalTokens"])
    assert ra["partnerKind"] == "human" and ra["debriefShown"] is True
    assert [r["role"] for r in ra["rounds"]] == ["proposer" if x == "A" else "responder" for x in proposers]
    assert all(r["myDecisionMs"] and r["myDecisionMs"] > 0 for r in ra["rounds"]), ra["rounds"]
    assert ra["waitMs"] is not None and ra["waitMs"] > 0

    # ---------- alone: the computer joins after the timeout ----------
    ctxC = browser.new_context()
    C = ctxC.new_page(); subsC = []; intercept(C, subsC)
    C.on("pageerror", lambda e: errors.append(str(e)))
    C.goto(BASE + "?PROLIFIC_PID=PID_C")
    t0 = time.time()
    click(C, "Start")
    C.locator("text=/split 10 tokens|is splitting the tokens/").first.wait_for(timeout=40000)  # rng decides who proposes; handle both
    waited = time.time() - t0
    print(f"computer partner after {waited:.1f}s")
    assert 19 < waited < 30, waited
    for rnd in range(3):
        if C.get_by_text("You propose").is_visible():
            place_all(C, 7, 3, use_drag_for_one=False)
            click(C, "Send offer")
        else:
            C.get_by_text("is splitting the tokens").wait_for(timeout=15000)
            seen, t_start = 0, time.time()
            while time.time() - t_start < 15:
                seen = int(C.locator('[data-pile="other"] .l2-count').inner_text()) + int(C.locator('[data-pile="me"] .l2-count').inner_text())
                if 0 < seen < 10:
                    break
                C.wait_for_timeout(100)
            accept_off = C.get_by_role("button", name="Accept", exact=True).is_disabled()
            t_offer = time.time()
            C.get_by_text("offers you").wait_for(timeout=15000)
            print(f"  computer's tokens moving one by one: {seen} placed, Accept off: {accept_off}; offer usable {time.time() - t_offer:.1f}s later")
            assert accept_off
            assert 0 < seen, "the computer's tokens should move before its offer lands"
            click(C, "Accept")
        C.locator(".l2-mp-result").wait_for(timeout=15000)
        click(C, "Continue" if rnd == 2 else "Next round")
        if rnd < 2:
            C.locator("text=/You propose|is splitting the tokens/").first.wait_for(timeout=15000)
    C.get_by_text("computer program").wait_for(timeout=10000)
    C.screenshot(path=f"{OUT}/6-debrief-bot.png")
    click(C, "Continue")
    deadline = time.time() + 15
    while not subsC and time.time() < deadline:
        C.wait_for_timeout(300)
    rc = subsC[0]["responses"][0]["response"]
    print("C:", {k: rc[k] for k in ("partnerKind", "partnerStrategy", "totalTokens", "completed", "debriefShown")},
          [(r["role"], r["myShare"], r["partnerShare"], r["response"]) for r in rc["rounds"]])
    assert rc["partnerKind"] == "bot" and rc["partnerStrategy"] == "fair"
    # fair bot rejects 3-of-10 offers and proposes 5/5
    for r in rc["rounds"]:
        if r["role"] == "proposer":
            assert r["response"] == "reject", r
        else:
            assert (r["myShare"], r["partnerShare"]) == (5, 5), r
    print("page errors:", errors)
    assert not errors
    browser.close()
print("E2E OK")
