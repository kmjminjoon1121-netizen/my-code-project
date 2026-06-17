import asyncio
from playwright.async_api import async_playwright
from PIL import Image
import numpy as np

URL = "https://askmath.kosac.re.kr/ai/imageAnaly/imageAnalysis.do?menuPos=6"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(viewport={"width": 1400, "height": 900})
        page = await context.new_page()

        print("Loading page...")
        await page.goto(URL)
        await asyncio.sleep(10)
        await page.screenshot(path="initial.png")
        print("Initial screenshot saved: initial.png")

        texts = await page.evaluate('''
            () => {
                const all = document.querySelectorAll('*');
                const texts = [];
                for (const el of all) {
                    if (el.children.length === 0 && el.textContent.trim()) {
                        texts.push({tag: el.tagName, text: el.textContent.trim().substring(0, 80), cls: el.className, id: el.id});
                    }
                }
                return texts;
            }
        ''')
        print("=== Page text elements ===")
        for t in texts:
            print(t)

        template_items = await page.query_selector_all("[class*='template'], [class*='menu'] li, .item")
        print(f"\nFound {len(template_items)} template-like items")
        for item in template_items[:10]:
            text = await item.text_content()
            print(f"  Template item: {text[:50] if text else 'N/A'}")

        if template_items:
            await template_items[0].click()
            await asyncio.sleep(3)
            await page.screenshot(path="after_template.png")
            print("After template click: after_template.png")

        matrix_view = await page.query_selector("text=행렬 보기")
        if not matrix_view:
            matrix_view = await page.query_selector("text=행렬보기")
        if matrix_view:
            await matrix_view.click()
            await asyncio.sleep(3)
            await page.screenshot(path="matrix_view.png")
            print("Matrix view screenshot saved: matrix_view.png")
        else:
            print("Could not find matrix view button")
            await page.screenshot(path="matrix_view.png")

        canvas = await page.query_selector("canvas")
        if canvas:
            box = await canvas.bounding_box()
            print(f"Canvas found at: {box}")
            await canvas.screenshot(path="canvas.png")

            img = Image.open("canvas.png")
            img_array = np.array(img)

            r = img_array[:,:,0].astype(float)
            g = img_array[:,:,1].astype(float)
            b = img_array[:,:,2].astype(float)

            red_score = r - g - b
            red_idx = np.unravel_index(np.argmax(red_score), red_score.shape)
            red_y, red_x = red_idx
            red_r, red_g, red_b = img_array[red_y, red_x, :3]
            print(f"\nMost pure red pixel:")
            print(f"  Coords: ({red_x}, {red_y})")
            print(f"  R={red_r}, G={red_g}, B={red_b}")

            white_score = r + g + b
            white_idx = np.unravel_index(np.argmax(white_score), white_score.shape)
            white_y, white_x = white_idx
            white_r, white_g, white_b = img_array[white_y, white_x, :3]
            print(f"\nMost white pixel:")
            print(f"  Coords: ({white_x}, {white_y})")
            print(f"  R={white_r}, G={white_g}, B={white_b}")

            height, width = img_array.shape[:2]
            rgb_img = Image.new('RGB', (width * 3 + 20, height + 30), (200, 200, 200))

            red_only = np.zeros_like(img_array[:,:,:3])
            red_only[:,:,0] = img_array[:,:,0]
            rgb_img.paste(Image.fromarray(red_only), (0, 30))

            green_only = np.zeros_like(img_array[:,:,:3])
            green_only[:,:,1] = img_array[:,:,1]
            rgb_img.paste(Image.fromarray(green_only), (width + 10, 30))

            blue_only = np.zeros_like(img_array[:,:,:3])
            blue_only[:,:,2] = img_array[:,:,2]
            rgb_img.paste(Image.fromarray(blue_only), (width * 2 + 20, 30))

            rgb_img.save("rgb_channels.png")
            print("RGB channels image saved: rgb_channels.png")

        sepia_btn = await page.query_selector("text=세피아")
        if not sepia_btn:
            sepia_btn = await page.query_selector("text=Sepia")
        if sepia_btn:
            await sepia_btn.click()
            await asyncio.sleep(3)
            await page.screenshot(path="sepia_filter.png")
            print("Sepia filter screenshot saved: sepia_filter.png")
        else:
            print("Could not find Sepia button")
            await page.screenshot(path="sepia_filter.png")

        await browser.close()

asyncio.run(main())
