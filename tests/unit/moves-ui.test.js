import { it, expect, jest } from '@jest/globals';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
const tick = () => new Promise(resolve => setTimeout(resolve,0));
it('automatically saves row order and restores the last saved order on failure', async () => {
 const dom = new JSDOM('<p data-move-order-status></p><table><tbody data-move-order><tr draggable="true" data-id="a"><td><button data-down>Down</button></td></tr><tr draggable="true" data-id="b"><td><button data-down>Down</button></td></tr></tbody></table>', {runScripts:'outside-only'});
 const w=dom.window;
 w.fetch=jest.fn().mockResolvedValueOnce({ok:true,json:async()=>({saved:true})}).mockRejectedValueOnce(new Error('offline'));
 w.eval(fs.readFileSync('public/js/admin.js','utf8')); await tick();
 w.document.querySelector('[data-id=a] button').click(); await tick();
 expect(JSON.parse(w.fetch.mock.calls[0][1].body)).toEqual({ids:['b','a']});
 w.document.querySelector('[data-id=b] button').click(); await tick();
 expect([...w.document.querySelector('[data-move-order]').children].map(r=>r.dataset.id)).toEqual(['b','a']);
 expect(w.document.querySelector('[role=status], [data-move-order-status]').textContent).toContain('Order restored'); dom.window.close();
});
it('reorders and removes media while preserving captions and URLs', async () => {
 const dom=new JSDOM('<form data-move-form><input name="media"><div data-move-media></div><p data-media-status></p><button type="button" data-add-media>Add</button><input type="file" data-upload-media></form>', {runScripts:'outside-only'});
 const w=dom.window,input=w.document.querySelector('[name=media]');
 const media=[{type:'image',url:'/uploads/a.png',caption:'A'},{type:'video',url:'/uploads/b.mp4',caption:'B'}]; input.value=JSON.stringify(media);
 w.eval(fs.readFileSync('public/js/admin.js','utf8')); await tick();
 w.document.querySelector('[data-down]').click(); expect(JSON.parse(input.value)).toEqual([...media].reverse());
 w.document.querySelector('[data-remove]').click(); expect(JSON.parse(input.value)).toEqual([media[0]]); dom.window.close();
});
it('opens the type dropdown, updates selected labels, and closes with Escape', async () => {
 const dom=new JSDOM('<div data-move-types><button type="button" class="dropdown-trigger" aria-expanded="false"><span class="dropdown-display">Select move types...</span></button><div class="dropdown-panel"><input type="checkbox" value="Straight Offense"><input type="checkbox" value="Offensive Defense"></div></div>',{runScripts:'outside-only'});
 const w=dom.window;
 w.eval(fs.readFileSync('public/js/admin.js','utf8')); await tick();
 const trigger=w.document.querySelector('button'), panel=w.document.querySelector('.dropdown-panel');
 trigger.click(); expect(trigger.getAttribute('aria-expanded')).toBe('true'); expect(panel.classList.contains('open')).toBe(true);
 w.document.querySelectorAll('input').forEach(input=>input.click());
 expect(w.document.querySelector('.dropdown-display').textContent).toBe('Straight Offense, Offensive Defense');
 panel.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 expect(trigger.getAttribute('aria-expanded')).toBe('false'); expect(w.document.activeElement).toBe(trigger);
 trigger.click(); w.document.body.click(); expect(panel.classList.contains('open')).toBe(false);
 dom.window.close();
});
