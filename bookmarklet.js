/* DOAS BOM v0.21 — 2026-11-18. Dashboard HTML injected by tools/build.py.
 * Change log (preserved):
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
    const meta={project:pn.length>1?pn[0]+'-'+pn[1]:'',line:pn[2]||'',assy:pn[4]||'',source:'DOAS live table (loaded DOM)',version:'0.21',generated:new Date().toISOString(),rows:keep.length,totalRows:all.length,excluded:['7000'],exclStats:{lines:excluded.length,std:excluded.filter(r=>r[7]==='S').length,fab:excluded.filter(r=>r[7]==='F').length,qty:excluded.reduce((a,r)=>a+r[5],0),po:excluded.filter(r=>r[6]==='PO issued').length}};
    const bytes=Uint8Array.from(atob('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'),c=>c.charCodeAt(0));
    const response=new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')));
    const template=await response.text();
    const safeJSON=v=>JSON.stringify(v).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
    const output=template.replace('__DATA__',()=>safeJSON(all)).replace('__META__',()=>safeJSON(meta));
    const name='DOAS_BOM_Dashboard_'+(meta.project||'Project').replace(/[^a-z0-9_-]/gi,'_')+'_v0.21.html';
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
