const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOTS_DIR = '/home/user/my-code-project/screenshots';
const CHROMIUM_PATH = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function tryClick(page, text) {
  try {
    const loc = page.getByText(text, { exact: false });
    const count = await loc.count();
    if (count > 0) {
      await loc.first().click({ timeout: 3000 });
      return true;
    }
  } catch (e) {}
  return false;
}

async function getCanvasPixelData(page) {
  return page.evaluate(() => {
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

            if (a < 128) continue; // skip transparent pixels

            // Score for "most red": high R, low G, low B
            const redScore = (255 - r) + g + b;
            if (redScore < mostRed.score) {
              mostRed = { x, y, r, g, b, score: redScore };
            }

            // Score for "most white": Euclidean distance from (255,255,255)
            const whiteScore = Math.sqrt((255 - r) ** 2 + (255 - g) ** 2 + (255 - b) ** 2);
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
}

async function dumpPageInfo(page) {
  const allText = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    const texts = [];
    let node;
    while ((node = walker.nextNode())) {
      const t = node.textContent.trim();
      if (t.length > 1) texts.push(t);
    }
    return [...new Set(texts)].join(' | ');
  });
  console.log('Page text:', allText.substring(0, 3000));

  const menuItems = await page.evaluate(() => {
    const items = [];
    document.querySelectorAll('button, a, [role="button"], li, .menu-item, .nav-link, .tab').forEach(el => {
      const text = (el.innerText || el.value || el.title || '').trim();
      if (text && text.length < 100) {
        items.push({ tag: el.tagName, text, id: el.id, class: el.className.toString().substring(0, 60) });
      }
    });
    return [...new Map(items.map(i => [i.text, i])).values()].slice(0, 80);
  });
  console.log('\nInteractive elements:');
  menuItems.forEach((item, i) => console.log(`  [${i}] ${item.tag}#${item.id}: "${item.text}" class="${item.class}"`));
}

async function main() {
  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--ignore-certificate-errors',
      '--ignore-ssl-errors'
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    ignoreHTTPSErrors: true
  });
  const page = await context.newPage();

  page.on('dialog', async dialog => {
    console.log('Dialog:', dialog.type(), dialog.message());
    await dialog.accept();
  });

  console.log('=== Step 1: Opening page ===');
  try {
    await page.goto('https://askmath.kosac.re.kr/ai/imageAnaly/imageAnalysis.do?menuPos=6', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
  } catch (e) {
    console.log('Navigation error:', e.message);
    // Try waiting for partial load
    await sleep(3000);
  }

  const pageBodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 200) || '').catch(() => '');
  if (pageBodyText.includes('allowlist') || pageBodyText.includes('not in')) {
    console.error('\nNETWORK BLOCKED: The host askmath.kosac.re.kr is not in the network egress allowlist.');
    console.error('This sandbox environment restricts outbound connections to unlisted hosts.');
    console.error('To run this script, you need to either:');
    console.error('  1. Add askmath.kosac.re.kr to the network egress settings, OR');
    console.error('  2. Run this script outside the sandbox environment.');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'blocked_page.png') });
    await browser.close();
    return;
  }

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'initial_page.png') });
  console.log('Saved: initial_page.png');
  console.log('Page title:', await page.title());
  console.log('URL:', page.url());

  await dumpPageInfo(page);

  console.log('\n=== Step 2: Click template image ===');
  // Try multiple strategies to find template images
  const strategies = [
    async () => {
      // Strategy 1: images in a sidebar/list panel
      const imgs = await page.$$('.sidebar img, .panel img, .list img, ul.thumb li img, .template-list img');
      console.log(`Strategy 1: ${imgs.length} sidebar/panel images`);
      if (imgs.length > 0) { await imgs[0].click(); return true; }
    },
    async () => {
      // Strategy 2: any img with reasonable size
      const allImgs = await page.$$('img');
      console.log(`Strategy 2: ${allImgs.length} total images`);
      for (const img of allImgs) {
        const box = await img.boundingBox();
        const src = await img.getAttribute('src').catch(() => '');
        if (box && box.width > 40 && box.height > 40 && src && !src.includes('logo') && !src.includes('icon')) {
          console.log(`Clicking img: ${src} size ${box.width}x${box.height}`);
          await img.click({ timeout: 3000 });
          return true;
        }
      }
    },
    async () => {
      // Strategy 3: li items that might be templates
      const items = await page.$$('li');
      console.log(`Strategy 3: ${items.length} list items`);
      for (const item of items) {
        const box = await item.boundingBox();
        if (box && box.width > 50 && box.height > 50) {
          await item.click({ timeout: 3000 });
          return true;
        }
      }
    }
  ];

  let templateClicked = false;
  for (const strategy of strategies) {
    try {
      if (await strategy()) {
        templateClicked = true;
        await sleep(2000);
        break;
      }
    } catch (e) {
      console.log('Strategy error:', e.message);
    }
  }
  console.log('Template clicked:', templateClicked);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'after_template.png') });
  console.log('Saved: after_template.png');

  console.log('\n=== Step 3: 행렬 보기 (Matrix View) ===');
  const matrixTexts = ['행렬 보기', '행렬보기', '행렬', 'Matrix'];
  let matrixClicked = false;
  for (const t of matrixTexts) {
    if (await tryClick(page, t)) {
      console.log(`Clicked: "${t}"`);
      matrixClicked = true;
      await sleep(1500);
      break;
    }
  }
  console.log('Matrix view clicked:', matrixClicked);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'exp1_matrix_view.png') });
  console.log('Saved: exp1_matrix_view.png');

  // Also try to read matrix values from the page
  const matrixValues = await page.evaluate(() => {
    const tables = document.querySelectorAll('table');
    const results = [];
    tables.forEach(t => {
      const rows = Array.from(t.querySelectorAll('tr')).map(tr =>
        Array.from(tr.querySelectorAll('td,th')).map(td => td.innerText.trim())
      );
      if (rows.length > 0) results.push(rows.slice(0, 5));
    });
    return results;
  });
  if (matrixValues.length > 0) {
    console.log('Matrix table values (first 5 rows):');
    matrixValues[0].forEach(row => console.log(' ', row.join('\t')));
  }

  console.log('\n=== Step 4: Eyedropper / Pixel Analysis ===');
  const eyedropTexts = ['스포이트', '아이드로퍼', 'eyedropper', '색상 추출'];
  for (const t of eyedropTexts) {
    if (await tryClick(page, t)) {
      console.log(`Clicked eyedropper: "${t}"`);
      await sleep(1000);
      break;
    }
  }

  const pixelData = await getCanvasPixelData(page);
  console.log(`\nCanvas pixel analysis (${pixelData.length} canvas elements found):`);
  for (const result of pixelData) {
    if (result.error) { console.log('  Error:', result.error); continue; }
    console.log(`\nCanvas id="${result.canvasId}" class="${result.canvasClass}" size=${result.width}x${result.height}`);
    console.log(`  MOST RED  pixel: x=${result.mostRed.x}, y=${result.mostRed.y} → RGB(${result.mostRed.r}, ${result.mostRed.g}, ${result.mostRed.b})`);
    console.log(`  MOST WHITE pixel: x=${result.mostWhite.x}, y=${result.mostWhite.y} → RGB(${result.mostWhite.r}, ${result.mostWhite.g}, ${result.mostWhite.b})`);
  }

  if (pixelData.length === 0) {
    console.log('No canvas elements with pixel data found. The image may be in an <img> tag.');
    // Try to get pixel info via alternate means (e.g., hover over image and read displayed RGB)
    const colorDisplay = await page.$('[class*="color"], [id*="color"], [class*="rgb"], [id*="rgb"]');
    if (colorDisplay) {
      const text = await colorDisplay.innerText().catch(() => '');
      console.log('Color display element:', text);
    }
  }

  console.log('\n=== Step 5: Channel Separation ===');
  // Look for channel separation options
  const channelTexts = ['R채널', 'G채널', 'B채널', 'R 채널', 'G 채널', 'B 채널', '채널분리', '채널 분리'];
  for (const t of channelTexts) {
    const loc = page.getByText(t, { exact: false });
    const count = await loc.count();
    if (count > 0) console.log(`Found channel option: "${t}" (${count} elements)`);
  }

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'exp2_channels.png') });
  console.log('Saved: exp2_channels.png');

  // Try to click each channel button and screenshot
  for (const ch of ['R', 'G', 'B']) {
    const chLoc = page.getByText(ch, { exact: true });
    const count = await chLoc.count();
    if (count > 0) {
      await chLoc.first().click({ timeout: 2000 }).catch(() => {});
      await sleep(1000);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `exp2_channel_${ch}.png`) });
      console.log(`Saved: exp2_channel_${ch}.png`);
    }
  }

  console.log('\n=== Step 6: 변환 menu (+, -, ÷) ===');
  const transformTexts = ['[변환]', '변환', 'Transform'];
  for (const t of transformTexts) {
    if (await tryClick(page, t)) {
      console.log(`Clicked transform menu: "${t}"`);
      await sleep(1000);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'exp3_transform_menu.png') });
      console.log('Saved: exp3_transform_menu.png');
      break;
    }
  }

  // Look for operation buttons
  const opTexts = ['+', '-', '÷', '×', '나누기', '더하기', '빼기', '곱하기'];
  for (const op of opTexts) {
    const loc = page.getByText(op, { exact: false });
    const count = await loc.count();
    if (count > 0) {
      console.log(`Found operation "${op}" (${count} elements)`);
    }
  }

  // Try clicking + operation
  for (const op of ['+', '더하기']) {
    if (await tryClick(page, op)) {
      console.log(`Clicked operation: "${op}"`);
      await sleep(1000);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'exp3_transform_add.png') });
      console.log('Saved: exp3_transform_add.png');
      break;
    }
  }

  console.log('\n=== Step 7: 필터 menu - Sepia ===');
  const filterTexts = ['[필터]', '필터', 'Filter'];
  for (const t of filterTexts) {
    if (await tryClick(page, t)) {
      console.log(`Clicked filter menu: "${t}"`);
      await sleep(1000);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'filter_menu_open.png') });
      console.log('Saved: filter_menu_open.png');
      break;
    }
  }

  const sepiaTexts = ['세피아', 'sepia', 'Sepia'];
  for (const t of sepiaTexts) {
    if (await tryClick(page, t)) {
      console.log(`Clicked sepia: "${t}"`);
      await sleep(2000);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'exp4_sepia.png') });
      console.log('Saved: exp4_sepia.png');
      break;
    }
  }

  console.log('\n=== Final state screenshot ===');
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'final_state.png'), fullPage: true });
  console.log('Saved: final_state.png');

  await browser.close();
  console.log('\n=== COMPLETE ===');
  console.log('Screenshots directory:', SCREENSHOTS_DIR);
  const files = fs.readdirSync(SCREENSHOTS_DIR);
  console.log('Files:', files.join(', '));
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
