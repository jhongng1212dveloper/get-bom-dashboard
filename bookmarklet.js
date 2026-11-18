/* DOAS BOM v0.22 — 2026-11-18. Dashboard HTML injected by tools/build.py.
 * Change log (preserved):
 * v0.22: Two-row mobile sticky procurement status legend with no horizontal scroll.
 * v0.21: Mobile Parts Explorer status dots mirrored next to Manufacturer Part No.
 * v0.20: PR progress metrics and responsive Modules table.
 * v0.19: Pinned module/manufacturer resets in side panes and sticky status bar.
 * v0.18: Persistent desktop filter panes; immediate mobile filter tabs.
 * v0.17: Sticky project-line label; v0.15: source BOM Clear filters pre-extraction.
 * v0.13: module-scoped merging and paired module/manufacturer filters.
 */
(async () => {
  'use strict';
  const EXPECTED = ['Module','Assy.','Supplier Part No.','Item Description','Manufacturer','Manufacturer Part No.','Unit Qty','Total Qty','Add. Qty','Status'];
  const norm = s => String(s ?? '').replace(/\s+/g, ' ').trim();
  const RESERVED = '__DOAS_BOM_PREVIEW_V012__';
  let previewTab = window[RESERVED] || null;
  try { delete window[RESERVED]; } catch (_) { window[RESERVED] = null; }

  function notify(msg, bad=false) {
    document.getElementById('doas-dashboard-toast')?.remove();
    const e = document.createElement('div');
    e.id='doas-dashboard-toast'; e.textContent=msg;
    Object.assign(e.style, {position:'fixed',right:'16px',top:'16px',zIndex:'2147483647',background:bad?'#991b1b':'#155e3b',color:'white',padding:'14px 18px',maxWidth:'480px',borderRadius:'8px',font:'14px Segoe UI,Arial',whiteSpace:'pre-wrap',boxShadow:'0 4px 18px #0005'});
    (document.body || document.documentElement).appendChild(e);
    setTimeout(() => e.remove(), bad?10000:6000);
  }
  function findBOMTable() {
    for (const table of document.querySelectorAll('table')) {
      const headers = [...table.querySelectorAll('thead tr th')].map(h => norm(h.textContent));
      const ids = EXPECTED.map(x => headers.indexOf(x));
      if (ids.every(i => i >= 0) && new Set(ids).size === EXPECTED.length) return {table, idx:ids};
    }
    return null;
  }
  function resultPanel(name, url, total, shown, hidden, opened, clearResult) {
    document.getElementById('doas-dashboard-result')?.remove();
    const panel=document.createElement('div');
    panel.id='doas-dashboard-result';
    Object.assign(panel.style,{position:'fixed',right:'16px',top:'16px',zIndex:'2147483647',width:'min(470px,calc(100vw - 32px))',background:'#fff',border:'1px solid #b8c2ce',borderRadius:'11px',padding:'14px 16px',color:'#101828',font:'13px/1.45 Segoe UI,Arial,sans-serif',boxShadow:'0 6px 24px #0003'});
    const heading=document.createElement('div');
    heading.textContent='DOAS dashboard generated';heading.style.fontWeight='750';heading.style.fontSize='15px';
    const summary=document.createElement('p');
    summary.style.margin='7px 0 11px';
    summary.textContent=`${total} loaded lines; ${shown} displayed by default; ${hidden} module 7000 lines hidden. Clear filters: ${clearResult}. ${opened ? 'Opening dashboard in a new tab.' : 'Automatic tab opening was blocked; use Open dashboard.'} Download requested: ${name}`;
    const row=document.createElement('div');row.style.display='flex';row.style.flexWrap='wrap';row.style.gap='8px';
    function addLink(label, download) {
      const link=document.createElement('a');link.textContent=label;link.href=url;
      if(download)link.download=name;else{link.target='_blank';link.rel='noopener noreferrer';}
      Object.assign(link.style,{display:'inline-block',padding:'7px 10px',borderRadius:'6px',border:'1px solid #2563eb',background:download?'#fff':'#2563eb',color:download?'#1d4ed8':'white',textDecoration:'none',fontWeight:'650'});
      row.append(link);
    }
    addLink('Open dashboard',false); addLink('Download again',true);
    const close=document.createElement('button');close.textContent='Dismiss';
    Object.assign(close.style,{padding:'7px 10px',border:'1px solid #cbd5e1',background:'white',borderRadius:'6px',cursor:'pointer'});
    close.addEventListener('click',()=>panel.remove());row.append(close);
    const warning=document.createElement('div');warning.textContent='Only BOM rows currently loaded in the DOAS webpage were processed. Clearing UI filters does not fetch unloaded/paginated BOM records. Check the DOAS total.';
    warning.style.color='#667085';warning.style.fontSize='11px';warning.style.marginTop='10px';
    panel.append(heading,summary,row,warning);
    (document.body||document.documentElement).append(panel);
  }

  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  function findClearFiltersButton() {
    // Exact visible text prevents accidentally clicking other dashboard/UI Clear buttons.
    return [...document.querySelectorAll('button')].find(b =>
      norm(b.innerText || b.textContent).toLowerCase() === 'clear filters' &&
      b.getClientRects().length > 0);
  }
  function bomSnapshot() {
    const found=findBOMTable();
    if(!found)return null;
    const trs=[...found.table.querySelectorAll('tbody tr')]
      .filter(tr=>tr.querySelectorAll(':scope > td').length>=EXPECTED.length);
    // Sample rows from each end AND the middle to detect asynchronous filter reset.
    const picked=[0,1,Math.floor(trs.length/2),trs.length-2,trs.length-1];
    const sig=trs.length+'|'+picked.filter(i=>i>=0&&i<trs.length)
      .map(i=>norm(trs[i].textContent)).join('|');
    const mods=new Set(trs.map(tr=>norm(tr.children[found.idx[0]]?.textContent)));
    return {sig, count:trs.length, modules:mods.size};
  }
  async function clearSourceFilters() {
    // This must execute even if BOM Import is already active and its table exists.
    // Fail closed if the control cannot be found: otherwise a filtered report can
    // silently be mistaken for the whole BOM.
    let btn=findClearFiltersButton();
    const findDeadline=Date.now()+6000;
    while(!btn && Date.now()<findDeadline){await pause(200);btn=findClearFiltersButton();}
    if(!btn)throw Error('The DOAS "Clear filters" button was not found. Dashboard generation stopped to avoid exporting a filtered BOM. Open BOM Import, confirm the control is visible, then run the bookmark again.');
    if(btn.disabled)return 'already disabled; no filter reset requested';
    const prior=bomSnapshot();
    notify('Clearing DOAS BOM filters before reading the table...');
    btn.click();
    const started=Date.now();
    const deadline=started+15000;
    let changed=false,lastChange=started,lastSig=prior?.sig??null;
    // If one module was visible, a server response might take longer: do not
    // read a cached filtered table immediately after the click.
    const noChangeWait=prior?.modules===1?8000:2400;
    let settled=null;
    while(Date.now()<deadline){
      await pause(180);
      const snap=bomSnapshot();
      if(!snap){lastChange=Date.now();continue;}
      if(snap.sig!==lastSig){changed=true;lastSig=snap.sig;lastChange=Date.now();}
      const idle=Date.now()-lastChange;
      if(changed && idle>=1000){settled=snap;break;}
      if(!changed && Date.now()-started>=noChangeWait){settled=snap;break;}
    }
    if(!settled)throw Error('Timed out waiting for the BOM table after clicking Clear filters. Dashboard was not generated.');
    if(!settled.count)throw Error('DOAS returned no loaded BOM rows after Clear filters. Dashboard was not generated.');
    if(!changed && prior?.modules===1 && !btn.disabled && findClearFiltersButton()) {
      // Do not claim a single-module filtered view was cleared if the displayed
      // table never changed. A truly one-module BOM can be reviewed manually.
      throw Error('Clear filters was clicked, but the single-module BOM table did not visibly update. Cannot verify an unfiltered BOM. Check DOAS filters and rerun.');
    }
    return changed ? 'clicked; updated BOM table detected' : 'clicked; no visible table change (confirm DOAS totals)';
  }

  try {
    if (typeof DecompressionStream === 'undefined') throw Error('Current Chrome, Edge or Opera is required (DecompressionStream not available).');
    let found=findBOMTable();
    // Standalone bookmarklets may still have an active click gesture; the hosted
    // launcher reserves a tab synchronously before downloading this script.
    if (found && !previewTab) {
      try { previewTab=window.open('about:blank','_blank'); } catch (_) { /* browser blocked popup */ }
    }
    if (!found) {
      const btn=[...document.querySelectorAll('button')].find(b => norm(b.querySelector('span')?.textContent)==='BOM Import'||norm(b.textContent)==='BOM Import');
      if(!btn)throw Error('DOAS BOM table and BOM Import button were not found. Open the DOAS BOM page.');
      if(btn.disabled)throw Error('BOM Import navigation button is disabled.');
      notify('Opening BOM Import and waiting for the BOM table...');
      btn.click();
      const deadline=Date.now()+15000;
      while(!found && Date.now()<deadline) {
        await pause(250);
        found=findBOMTable();
      }
      if(!found)throw Error('BOM Import was clicked but no BOM table loaded within 15 seconds. If DOAS navigated to a new page, click the bookmark again.');
    }
    const clearResult=await clearSourceFilters();
    found=findBOMTable();
    if(!found)throw Error('The DOAS BOM table disappeared after Clear filters. Run the bookmark again when it has loaded.');
    if(previewTab && !previewTab.closed) {
      try { previewTab.document.title='Generating DOAS dashboard'; previewTab.document.body.textContent='Generating DOAS dashboard…'; } catch (_) {}
    }
    const {table,idx}=found;
    const trs=[...table.querySelectorAll('tbody tr')].filter(tr=>tr.querySelectorAll(':scope > td').length>=EXPECTED.length);
    if(!trs.length)throw Error('No BOM rows are currently loaded on this page.');
    const raw=trs.map(tr=>{
      const cells=[...tr.children].filter(el=>el.tagName==='TD');
      return idx.map((i,k)=>{
        const cell=cells[i];if(!cell)return '';
        if(k===2) {
          const full=cell.querySelector('[title]');
          if(full?.getAttribute('title'))return norm(full.getAttribute('title'));
        }
        return norm(cell.innerText||cell.textContent);
      });
    });
    const normalizeMfg=s=>{const v=norm(s).toUpperCase();return v==='SINHONG'?'SIN HONG':v;};
    const numeric=s=>{const n=Number.parseFloat(norm(s).replace(/,/g,''));return Number.isFinite(n)?n:0;};
    const all=raw.filter(r=>norm(r[0])).map(r=>[norm(r[0]),norm(r[2]),norm(r[3]),normalizeMfg(r[4]),norm(r[5]),numeric(r[7]),norm(r[9]),/^T-/i.test(norm(r[5]))?'F':'S']);
    if(!all.length)throw Error('No valid BOM records found in the loaded DOAS table.');
    const excluded=all.filter(r=>r[0]==='7000'),keep=all.filter(r=>r[0]!=='7000');
    const pn=(keep[0]||all[0])[1].split('-');
    const meta={project:pn.length>1?pn[0]+'-'+pn[1]:'',line:pn[2]||'',assy:pn[4]||'',source:'DOAS live table (loaded DOM)',version:'0.22',generated:new Date().toISOString(),rows:keep.length,totalRows:all.length,excluded:['7000'],exclStats:{lines:excluded.length,std:excluded.filter(r=>r[7]==='S').length,fab:excluded.filter(r=>r[7]==='F').length,qty:excluded.reduce((a,r)=>a+r[5],0),po:excluded.filter(r=>r[6]==='PO issued').length}};
    const bytes=Uint8Array.from(atob('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'),c=>c.charCodeAt(0));
    const response=new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')));
    const template=await response.text();
    const safeJSON=v=>JSON.stringify(v).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
    const output=template.replace('__DATA__',()=>safeJSON(all)).replace('__META__',()=>safeJSON(meta));
    const name='DOAS_BOM_Dashboard_'+(meta.project||'Project').replace(/[^a-z0-9_-]/gi,'_')+'_v0.22.html';
    const url=URL.createObjectURL(new Blob([output],{type:'text/html;charset=utf-8'}));
    // The downloaded file is the durable offline copy. The new tab is a preview
    // of identical generated HTML; browsers cannot directly open the downloaded
    // file:// location or force a popup through blockers.
    let opened=false;
    try {
      if(previewTab && !previewTab.closed) {
        previewTab.location.replace(url);
        opened=true;
      } else {
        const tab=window.open(url,'_blank');
        opened=!!tab;
      }
    } catch (_) { opened=false; }
    const a=document.createElement('a');a.href=url;a.download=name;
    document.body.appendChild(a);a.click();a.remove();
    // Keep the blob URL available to the manual Open / Download buttons.
    window.addEventListener('pagehide',()=>URL.revokeObjectURL(url),{once:true});
    document.getElementById('doas-dashboard-toast')?.remove();
    resultPanel(name,url,all.length,keep.length,excluded.length,opened,clearResult);
  } catch(e) {
    if(previewTab && !previewTab.closed) {try{previewTab.close();}catch(_){}}
    notify('Cannot generate dashboard: '+e.message,true);
    console.error('DOAS dashboard:',e);
  }
})();
