import asyncio
from playwright.async_api import async_playwright

CHROME_PATH = '/opt/pw-browsers/chromium'

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, executable_path=CHROME_PATH)
        context = await browser.new_context(viewport={"width": 1400, "height": 900}, ignore_https_errors=True)
        page = await context.new_page()

        await page.goto("https://askmath.kosac.re.kr/ai/imageAnaly/imageAnalysis.do?menuPos=6")
        await page.wait_for_load_state("networkidle")
        await asyncio.sleep(3)

        # Take initial screenshot
        await page.screenshot(path="/home/user/my-code-project/initial.png", full_page=True)
        print("Initial screenshot taken")

        # Print page content for analysis
        content = await page.content()
        with open("/home/user/my-code-project/page_content.html", "w") as f:
            f.write(content)
        print("Page content saved")

        # Look for buttons/menus
        buttons = await page.query_selector_all("button, .btn, [class*='menu'], [class*='template'], li, a")
        for b in buttons[:50]:
            text = await b.text_content()
            tag = await b.evaluate("el => el.tagName")
            cls = await b.get_attribute("class") or ""
            iid = await b.get_attribute("id") or ""
            if text and text.strip():
                print(f"Element: {tag}, id: {iid[:30]}, class: {cls[:60]}, text: {text.strip()[:60]}")

        await browser.close()

asyncio.run(main())
