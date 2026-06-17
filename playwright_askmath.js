const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOTS_DIR = '/home/user/my-code-project/screenshots';
const CHROMIUM_PATH = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--ignore-certificate-errors', '--ignore-ssl-errors']
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    ignoreHTTPSErrors: true
  });
  const page = await context.newPage();

  // Handle any dialogs
  page.on('dialog', async dialog => {
    console.log('Dialog:', dialog.type(), dialog.message());
    await dialog.accept();
  });

  console.log('=== Step 1: Opening page ===');
  await page.goto('https://askmath.kosac.re.kr/ai/imageAnaly/imageAnalysis.do?menuPos=6', {
    waitUntil: 'networkidle',
    timeout: 60000
  });
  await sleep(2000);

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'initial_page.png'), fullPage: false });
  console.log('Screenshot saved: initial_page.png');

  // Log page title and any visible text
  const title = await page.title();
  console.log('Page title:', title);

  // Check for any login form
  const loginForm = await page.$('input[type="password"]');
  if (loginForm) {
    console.log('Login form detected - page may require authentication');
  }

  // Check current URL
  console.log('Current URL:', page.url());

  // Take a full page screenshot to understand layout
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'initial_full.png'), fullPage: true });
  console.log('Screenshot saved: initial_full.png');

  // Look for page content
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
  console.log('Page text preview:', bodyText);

  console.log('\n=== Step 2: Looking for template images ===');

  // Look for template menu images - try various selectors
  const possibleTemplateSelectors = [
    'img[src*="template"]',
    'img[src*="sample"]',
    '.template',
    '[class*="template"]',
    '[class*="sample"]',
    'ul li img',
    '.thumb img',
    '[class*="thumb"] img',
    'img[onclick]',
    '.menu-item img',
  ];

  let templateImages = [];
  for (const sel of possibleTemplateSelectors) {
    const imgs = await page.$$(sel);
    if (imgs.length > 0) {
      console.log(`Found ${imgs.length} elements with selector: ${sel}`);
      templateImages = imgs;
      break;
    }
  }

  if (templateImages.length === 0) {
    // Try to find all images on the page
    const allImgs = await page.$$('img');
    console.log(`Total images on page: ${allImgs.length}`);
    for (let i = 0; i < Math.min(allImgs.length, 10); i++) {
      const src = await allImgs[i].getAttribute('src');
      const cls = await allImgs[i].getAttribute('class');
      const id = await allImgs[i].getAttribute('id');
      console.log(`  img[${i}]: src=${src}, class=${cls}, id=${id}`);
    }
    templateImages = allImgs;
  }

  // Try clicking first non-logo/icon image
  let clickedTemplate = false;
  const allImgs = await page.$$('img');
  for (let i = 0; i < allImgs.length; i++) {
    const src = await allImgs[i].getAttribute('src');
    const box = await allImgs[i].boundingBox();
    if (box && box.width > 30 && box.height > 30 && src) {
      console.log(`Clicking image: ${src} at (${box.x}, ${box.y}) size ${box.width}x${box.height}`);
      try {
        await allImgs[i].click({ timeout: 5000 });
        await sleep(2000);
        clickedTemplate = true;
        break;
      } catch (e) {
        console.log(`  Could not click: ${e.message}`);
      }
    }
  }

  // Also look for clickable list items or buttons that might load templates
  if (!clickedTemplate) {
    const clickables = await page.$$('li[onclick], [data-image], [data-src], .item, .list-item');
    console.log(`Found ${clickables.length} clickable items`);
    if (clickables.length > 0) {
      await clickables[0].click();
      await sleep(2000);
      clickedTemplate = true;
    }
  }

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'after_template_click.png') });
  console.log('Screenshot saved: after_template_click.png');

  console.log('\n=== Step 3: Looking for Matrix View button (행렬 보기) ===');

  // Look for the button by text
  const matrixBtn = await page.getByText('행렬 보기').first().catch(() => null)
    || await page.getByText('행렬보기').first().catch(() => null)
    || await page.$('[class*="matrix"]')
    || await page.$('button:has-text("행렬")');

  // Try multiple approaches
  const matrixBtnLocator = page.getByText(/행렬\s*보기/);
  const matrixCount = await matrixBtnLocator.count();
  console.log(`Found ${matrixCount} elements matching "행렬 보기"`);

  if (matrixCount > 0) {
    await matrixBtnLocator.first().click();
    await sleep(2000);
    console.log('Clicked 행렬 보기 button');
  } else {
    // Try by partial text
    const allButtons = await page.$$('button, a, [role="button"], .btn, input[type="button"]');
    console.log(`Total buttons/links: ${allButtons.length}`);
    for (let i = 0; i < allButtons.length; i++) {
      const text = await allButtons[i].innerText().catch(() => '');
      const val = await allButtons[i].getAttribute('value').catch(() => '');
      if (text || val) console.log(`  btn[${i}]: "${text || val}"`);
    }
  }

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'exp1_matrix_view.png') });
  console.log('Screenshot saved: exp1_matrix_view.png');

  console.log('\n=== Step 4: Using eyedropper/스포이트 tool ===');

  // Look for eyedropper/스포이트 tool
  const eyedropperLocator = page.getByText(/스포이트/);
  const eyedropCount = await eyedropperLocator.count();
  console.log(`Found ${eyedropCount} elements matching "스포이트"`);

  // Get canvas element to sample pixels
  const canvas = await page.$('canvas');
  if (canvas) {
    console.log('Found canvas element');
    const canvasBox = await canvas.boundingBox();
    console.log(`Canvas: ${JSON.stringify(canvasBox)}`);

    // Get pixel data from canvas via JavaScript
    const pixelData = await page.evaluate(() => {
      const canvases = document.querySelectorAll('canvas');
      const results = [];
      for (const c of canvases) {
        try {
          const ctx = c.getContext('2d');
          if (!ctx) continue;
          const w = c.width;
          const h = c.height;
          if (w === 0 || h === 0) continue;
          const imageData = ctx.getImageData(0, 0, w, h);
          const data = imageData.data;

          let mostRed = { x: 0, y: 0, r: 0, g: 255, b: 255, score: 999999 };
          let mostWhite = { x: 0, y: 0, r: 0, g: 0, b: 0, score: 999999 };

          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const idx = (y * w + x) * 4;
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];
              const a = data[idx + 3];

              if (a < 128) continue; // skip transparent

              // Score for "most red": high R, low G, low B
              const redScore = (255 - r) + g + b;
              if (redScore < mostRed.score) {
                mostRed = { x, y, r, g, b, score: redScore };
              }

              // Score for "most white": distance from (255,255,255)
              const whiteScore = Math.sqrt((255-r)**2 + (255-g)**2 + (255-b)**2);
              if (whiteScore < mostWhite.score) {
                mostWhite = { x, y, r, g, b, score: whiteScore };
              }
            }
          }

          results.push({
            canvasId: c.id,
            canvasClass: c.className,
            width: w,
            height: h,
            mostRed,
            mostWhite
          });
        } catch (e) {
          results.push({ error: e.message });
        }
      }
      return results;
    });

    console.log('\nPixel analysis results:');
    for (const result of pixelData) {
      if (result.error) {
        console.log('Canvas error:', result.error);
        continue;
      }
      console.log(`Canvas ${result.canvasId || '(no id)'} [${result.width}x${result.height}]:`);
      console.log(`  Most RED pixel: coords=(${result.mostRed.x}, ${result.mostRed.y}), RGB=(${result.mostRed.r}, ${result.mostRed.g}, ${result.mostRed.b})`);
      console.log(`  Most WHITE pixel: coords=(${result.mostWhite.x}, ${result.mostWhite.y}), RGB=(${result.mostWhite.r}, ${result.mostWhite.g}, ${result.mostWhite.b})`);
    }
  } else {
    console.log('No canvas found - looking for image element');
    const mainImg = await page.$('#mainImage, #canvas, .main-image, img.preview');
    if (mainImg) {
      console.log('Found image element');
    }
  }

  console.log('\n=== Step 5: Channel Separation ===');

  // Look for channel separation controls
  const channelSelectors = [
    page.getByText(/채널/),
    page.getByText(/R채널/),
    page.getByText(/G채널/),
    page.getByText(/B채널/),
    page.getByText(/분리/),
  ];

  for (const loc of channelSelectors) {
    const count = await loc.count();
    if (count > 0) {
      const text = await loc.first().innerText().catch(() => '');
      console.log(`Found channel element: "${text}"`);
    }
  }

  // Look for tab or menu items
  const allTabs = await page.$$('[role="tab"], .tab, .nav-tab, .nav-item');
  console.log(`Total tabs/nav items: ${allTabs.length}`);
  for (let i = 0; i < allTabs.length; i++) {
    const text = await allTabs[i].innerText().catch(() => '');
    console.log(`  tab[${i}]: "${text}"`);
  }

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'exp2_channels_before.png') });

  // Try to find and click R, G, B channel buttons
  const rBtn = await page.getByText('R').first().catch(() => null);
  const gBtn = await page.getByText('G').first().catch(() => null);
  const bBtn = await page.getByText('B').first().catch(() => null);

  // Try channel separation - look for radio buttons or checkboxes
  const channelBtns = await page.$$('input[type="radio"], input[type="checkbox"]');
  console.log(`Found ${channelBtns.length} radio/checkbox inputs`);

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'exp2_channels.png') });
  console.log('Screenshot saved: exp2_channels.png');

  console.log('\n=== Step 6: 변환 menu operations ===');

  // Look for 변환 (transform) menu
  const transformMenu = page.getByText(/변환/);
  const transformCount = await transformMenu.count();
  console.log(`Found ${transformCount} elements matching "변환"`);

  if (transformCount > 0) {
    const texts = [];
    for (let i = 0; i < transformCount; i++) {
      const t = await transformMenu.nth(i).innerText().catch(() => '');
      const tag = await transformMenu.nth(i).evaluate(el => el.tagName);
      texts.push({ text: t, tag });
    }
    console.log('변환 elements:', JSON.stringify(texts));

    // Click first 변환 menu
    await transformMenu.first().click();
    await sleep(1000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'exp3_transform_menu.png') });
    console.log('Screenshot saved: exp3_transform_menu.png');
  }

  // Look for +, -, ÷ operation buttons
  const opBtns = await page.$$('button, .btn, [role="button"]');
  for (const btn of opBtns) {
    const text = await btn.innerText().catch(() => '');
    if (['+', '-', '÷', '×', '*', '/'].some(op => text.includes(op))) {
      console.log(`Found operation button: "${text}"`);
    }
  }

  console.log('\n=== Step 7: 필터 menu - Sepia filter ===');

  // Look for 필터 (filter) menu
  const filterMenu = page.getByText(/필터/);
  const filterCount = await filterMenu.count();
  console.log(`Found ${filterCount} elements matching "필터"`);

  if (filterCount > 0) {
    await filterMenu.first().click();
    await sleep(1000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'filter_menu_open.png') });
    console.log('Screenshot saved: filter_menu_open.png');

    // Look for sepia option
    const sepiaOption = page.getByText(/세피아|sepia/i);
    const sepiaCount = await sepiaOption.count();
    console.log(`Found ${sepiaCount} elements matching "세피아/sepia"`);

    if (sepiaCount > 0) {
      await sepiaOption.first().click();
      await sleep(2000);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'exp4_sepia.png') });
      console.log('Screenshot saved: exp4_sepia.png');
    }
  }

  console.log('\n=== Collecting all page structure info ===');

  // Dump all visible text on the page for analysis
  const allText = await page.evaluate(() => {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );
    const texts = [];
    let node;
    while ((node = walker.nextNode())) {
      const t = node.textContent.trim();
      if (t.length > 1) texts.push(t);
    }
    return [...new Set(texts)].join(' | ');
  });
  console.log('\nAll page text (unique):', allText.substring(0, 2000));

  // List all menus/buttons
  const menuItems = await page.evaluate(() => {
    const items = [];
    const selectors = ['button', 'a[href]', '[role="button"]', 'li[onclick]', '.menu-item', '.nav-link'];
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach(el => {
        const text = el.innerText?.trim() || el.value?.trim() || el.title?.trim() || '';
        if (text) items.push({ tag: el.tagName, text, class: el.className?.substring(0, 50) });
      });
    }
    return items.slice(0, 50);
  });
  console.log('\nMenu/button items:');
  menuItems.forEach((item, i) => console.log(`  [${i}] ${item.tag}: "${item.text}" class="${item.class}"`));

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'final_state.png') });
  console.log('\nScreenshot saved: final_state.png');

  await browser.close();
  console.log('\n=== Done ===');
  console.log('All screenshots in:', SCREENSHOTS_DIR);
  console.log('Files:', fs.readdirSync(SCREENSHOTS_DIR).join(', '));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
