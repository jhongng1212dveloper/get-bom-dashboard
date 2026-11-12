/* DOAS BOM v0.17; dashboard HTML is injected by tools/build.py. */
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
    const meta={project:pn.length>1?pn[0]+'-'+pn[1]:'',line:pn[2]||'',assy:pn[4]||'',source:'DOAS live table (loaded DOM)',version:'0.17',generated:new Date().toISOString(),rows:keep.length,totalRows:all.length,excluded:['7000'],exclStats:{lines:excluded.length,std:excluded.filter(r=>r[7]==='S').length,fab:excluded.filter(r=>r[7]==='F').length,qty:excluded.reduce((a,r)=>a+r[5],0),po:excluded.filter(r=>r[6]==='PO issued').length}};
    const bytes=Uint8Array.from(atob('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'),c=>c.charCodeAt(0));
    const response=new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')));
    const template=await response.text();
    const safeJSON=v=>JSON.stringify(v).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
    const output=template.replace('__DATA__',()=>safeJSON(all)).replace('__META__',()=>safeJSON(meta));
    const name='DOAS_BOM_Dashboard_'+(meta.project||'Project').replace(/[^a-z0-9_-]/gi,'_')+'_v0.17.html';
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
