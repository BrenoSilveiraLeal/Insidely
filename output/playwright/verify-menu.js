async page => {
 await page.goto('http://localhost:3000');
 await page.setViewportSize({width:844,height:390});
 await page.waitForTimeout(1500);
 await page.getByRole('button',{name:/Abrir navega/}).click();
 const drawer=page.locator('.mobile-drawer');
 await drawer.locator('a').last().scrollIntoViewIfNeeded();
 const result=await drawer.evaluate(e=>({bottom:e.getBoundingClientRect().bottom,viewport:innerHeight,scrollable:e.scrollHeight>e.clientHeight,lastLinkBottom:e.lastElementChild.getBoundingClientRect().bottom}));
 if(result.bottom>result.viewport||result.lastLinkBottom>result.viewport||!result.scrollable)throw new Error(JSON.stringify(result));
 await page.screenshot({path:'output/playwright/menu-landscape.png'});
 return result;
}
