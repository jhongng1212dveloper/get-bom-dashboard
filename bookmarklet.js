/* DOAS BOM v0.15; dashboard HTML is injected by tools/build.py. */
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
    const meta={project:pn.length>1?pn[0]+'-'+pn[1]:'',line:pn[2]||'',assy:pn[4]||'',source:'DOAS live table (loaded DOM)',version:'0.15',generated:new Date().toISOString(),rows:keep.length,totalRows:all.length,excluded:['7000'],exclStats:{lines:excluded.length,std:excluded.filter(r=>r[7]==='S').length,fab:excluded.filter(r=>r[7]==='F').length,qty:excluded.reduce((a,r)=>a+r[5],0),po:excluded.filter(r=>r[6]==='PO issued').length}};
    const bytes=Uint8Array.from(atob('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'),c=>c.charCodeAt(0));
    const response=new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')));
    const template=await response.text();
    const safeJSON=v=>JSON.stringify(v).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
    const output=template.replace('__DATA__',()=>safeJSON(all)).replace('__META__',()=>safeJSON(meta));
    const name='DOAS_BOM_Dashboard_'+(meta.project||'Project').replace(/[^a-z0-9_-]/gi,'_')+'_v0.15.html';
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
