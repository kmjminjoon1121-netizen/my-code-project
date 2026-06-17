import asyncio
from playwright.async_api import async_playwright

CHROME_PATH = '/opt/pw-browsers/chromium'

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, executable_path=CHROME_PATH)
        context = await browser.new_context(viewport={"width": 1400, "height": 900}, ignore_https_errors=True)
        page = await context.new_page()

        await page.goto("https://askmath.kosac.re.kr/ai/imageAnaly/imageAnalysis.do?menuPos=6")
        await asyncio.sleep(10)

        # Take initial screenshot
        await page.screenshot(path="/home/user/my-code-project/initial.png", full_page=True)

        # Print all text elements
        texts = await page.evaluate('''() => {
            const all = document.querySelectorAll('*');
            const texts = [];
            for (const el of all) {
                if (el.children.length === 0 && el.textContent.trim()) {
                    texts.push({tag: el.tagName, text: el.textContent.trim().substring(0, 80), cls: el.className, id: el.id});
                }
            }
            return texts;
        }''')
        for t in texts[:150]:
            print(t)

        # Save HTML
        html = await page.content()
        with open("/home/user/my-code-project/page.html", "w", encoding="utf-8") as f:
            f.write(html)
        print("\n--- HTML saved ---")
        print(f"HTML length: {len(html)}")

        await browser.close()

asyncio.run(main())
