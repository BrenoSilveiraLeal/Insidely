async page => {
  const results = [];
  for (const route of ['/', '/buscar', '/empresas', '/profissoes', '/entrar', '/cadastro', '/sobre', '/suporte']) {
    await page.goto('http://localhost:3000' + route);
    await page.waitForTimeout(900);
    for (const width of [320, 375, 768, 1024, 1366, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(200);
      results.push(await page.evaluate(() => ({
        route: location.pathname, width: innerWidth, overflow: document.documentElement.scrollWidth,
        bad: [...document.querySelectorAll('main h1,main h2,main form,main input,main select,header,main .button')].filter(e => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && (r.right > innerWidth + 2 || r.left < -2 || e.scrollWidth > e.clientWidth + 3);
        }).map(e => ({tag: e.tagName, cls: e.className, text: e.textContent.slice(0,55), width: e.clientWidth, scroll: e.scrollWidth}))
      })));
    }
  }
  return results;
}


