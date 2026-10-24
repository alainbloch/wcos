import {it,expect} from '@jest/globals';
import fs from 'node:fs';
import nunjucks from 'nunjucks';
import {load} from 'cheerio';
import {JSDOM} from 'jsdom';
import {originalPages} from '../../src/services/referenceSiteService.js';
it('retains the original accordion CSS targets, header typography and definition padding',()=>{
 const html=nunjucks.renderString(fs.readFileSync('docs/cms/glossary.html','utf8'),{glossary:[{id:'test',letter:'A',name:'Advanced Blocks',definition:'<p>Definition</p>'}]});
 const $=load(html);
 expect($('.glossary-entry > summary.card-header > .card-header-button > .title').text()).toBe('Advanced Blocks');
 expect($('.glossary-entry > .card-expand > .card-body > p').text()).toBe('Definition');
 expect($('.right-icon-group .normal-icon .jki-plus-line').length).toBe(1);
 expect($('.right-icon-group .active-icon .jki-minus-line').length).toBe(1);
 const page=originalPages.find(page=>page.slug==='glossary');
 const css=page.styles.map(path=>fs.readFileSync('public'+path,'utf8')).join('\n')+'\n'+fs.readFileSync('public/css/reference.css','utf8');
 // JSDOM cannot parse every Elementor stylesheet. Exercise the actual relevant
 // source rules in isolation, retaining their selectors rather than recreating styles.
 const rules=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([,selector,body]) =>
   (selector.trim()==='.jeg-elementor-kit.jkit-accordion .card-wrapper .card-header .card-header-button') ||
   (selector.trim()==='.jeg-elementor-kit.jkit-accordion .card-expand .card-body' && body.includes('30px 85px')) ||
   (selector.includes('elementor-element-e84c2fc') && body.includes('font-family: Anton')) ||
   (selector.includes('jkit-accordion') && selector.includes('icon-group') && /display: (none|block)/.test(body))
 ).map(match=>match[0]).join('\n');
 const dom=new JSDOM(`<style>${rules}</style>${html}`);const w=dom.window;
 const button=w.document.querySelector('.glossary-entry .card-header-button');
 expect(w.getComputedStyle(button).fontFamily).toContain('Anton');
 expect(w.getComputedStyle(button).padding).toBe('14px 30px');
 expect(w.getComputedStyle(w.document.querySelector('.glossary-entry .card-body')).padding).toBe('30px 85px 30px 65px');
 const details=w.document.querySelector('details');details.open=true;
 expect(w.getComputedStyle(w.document.querySelector('.normal-icon')).display).toBe('none');
 expect(w.getComputedStyle(w.document.querySelector('.active-icon')).display).toBe('block');
 details.open=false;
 expect(w.getComputedStyle(w.document.querySelector('.normal-icon')).display).toBe('block');
 expect(w.getComputedStyle(w.document.querySelector('.active-icon')).display).toBe('none');
 dom.window.close();
});
