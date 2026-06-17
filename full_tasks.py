import asyncio
import json
from playwright.async_api import async_playwright
from PIL import Image
import numpy as np

CHROME_PATH = '/opt/pw-browsers/chromium'
URL = "https://askmath.kosac.re.kr/ai/imageAnaly/imageAnalysis.do?menuPos=6"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, executable_path=CHROME_PATH)
        context = await browser.new_context(viewport={"width": 1400, "height": 900}, ignore_https_errors=True)
        page = await context.new_page()

        print("Loading page...")
        await page.goto(URL)
        await asyncio.sleep(10)
        await page.screenshot(path="/home/user/my-code-project/initial.png")
        print("Initial screenshot saved")

        # Explore page structure
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
        print("=== Page text elements ===")
        for t in texts:
            print(t)

        html = await page.content()
        with open("/home/user/my-code-project/page.html", "w", encoding="utf-8") as f:
            f.write(html)

        # Find and click template menu - look for Korean text
        # Try to find 행렬 보기 (Matrix View) button
        matrix_btn = await page.query_selector("text=행렬 보기")
        if not matrix_btn:
            matrix_btn = await page.query_selector("text=행렬보기")
        
        # First, try to load a template image
        # Look for template menu items
        template_items = await page.query_selector_all("[class*='template'], [class*='menu'] li, .item")
        print(f"\nFound {len(template_items)} template-like items")
        for item in template_items[:10]:
            text = await item.text_content()
            print(f"  Template item: {text[:50] if text else 'N/A'}")

        # Try clicking the first template to load an image
        if template_items:
            await template_items[0].click()
            await asyncio.sleep(3)
            await page.screenshot(path="/home/user/my-code-project/after_template.png")
            print("After template click screenshot saved")

        # Click 행렬 보기 (Matrix View)
        matrix_view = await page.query_selector("text=행렬 보기")
        if not matrix_view:
            matrix_view = await page.query_selector("text=행렬보기")
        if matrix_view:
            await matrix_view.click()
            await asyncio.sleep(3)
            await page.screenshot(path="/home/user/my-code-project/matrix_view.png")
            print("Matrix view screenshot saved")
        else:
            print("Could not find 행렬 보기 button")
            await page.screenshot(path="/home/user/my-code-project/matrix_view.png")

        # Use eyedropper/스포이트 tool
        # First take a screenshot and analyze the current canvas/image
        canvas = await page.query_selector("canvas")
        if canvas:
            box = await canvas.bounding_box()
            print(f"Canvas found at: {box}")
            # Take canvas screenshot
            await canvas.screenshot(path="/home/user/my-code-project/canvas.png")
            
            # Analyze for most red and most white pixels
            img = Image.open("/home/user/my-code-project/canvas.png")
            img_array = np.array(img)
            
            # Most pure red: maximize R, minimize G and B
            # Score = R - G - B
            r = img_array[:,:,0].astype(float)
            g = img_array[:,:,1].astype(float)
            b = img_array[:,:,2].astype(float)
            
            red_score = r - g - b
            red_idx = np.unravel_index(np.argmax(red_score), red_score.shape)
            red_y, red_x = red_idx
            red_r, red_g, red_b = img_array[red_y, red_x, :3]
            print(f"\nMost pure red pixel:")
            print(f"  Canvas coords: ({red_x}, {red_y})")
            print(f"  Page coords: ({int(box['x']) + red_x}, {int(box['y']) + red_y})")
            print(f"  R={red_r}, G={red_g}, B={red_b}")
            
            # Most white: maximize R+G+B
            white_score = r + g + b
            white_idx = np.unravel_index(np.argmax(white_score), white_score.shape)
            white_y, white_x = white_idx
            white_r, white_g, white_b = img_array[white_y, white_x, :3]
            print(f"\nMost white pixel:")
            print(f"  Canvas coords: ({white_x}, {white_y})")
            print(f"  Page coords: ({int(box['x']) + white_x}, {int(box['y']) + white_y})")
            print(f"  R={white_r}, G={white_g}, B={white_b}")
            
            # Create RGB channel separation image
            height, width = img_array.shape[:2]
            rgb_img = Image.new('RGB', (width * 3 + 20, height + 30), (200, 200, 200))
            
            # Red channel
            red_only = np.zeros_like(img_array[:,:,:3])
            red_only[:,:,0] = img_array[:,:,0]
            rgb_img.paste(Image.fromarray(red_only), (0, 30))
            
            # Green channel
            green_only = np.zeros_like(img_array[:,:,:3])
            green_only[:,:,1] = img_array[:,:,1]
            rgb_img.paste(Image.fromarray(green_only), (width + 10, 30))
            
            # Blue channel
            blue_only = np.zeros_like(img_array[:,:,:3])
            blue_only[:,:,2] = img_array[:,:,2]
            rgb_img.paste(Image.fromarray(blue_only), (width * 2 + 20, 30))
            
            rgb_img.save("/home/user/my-code-project/rgb_channels.png")
            print("\nRGB channels image saved")
        
        # Apply Sepia filter
        sepia_btn = await page.query_selector("text=세피아")
        if not sepia_btn:
            sepia_btn = await page.query_selector("text=Sepia")
        if sepia_btn:
            await sepia_btn.click()
            await asyncio.sleep(3)
            await page.screenshot(path="/home/user/my-code-project/sepia_filter.png")
            print("Sepia filter screenshot saved")
        else:
            print("Could not find Sepia button")
            await page.screenshot(path="/home/user/my-code-project/sepia_filter.png")

        await browser.close()

asyncio.run(main())
