/* DOAS BOM v0.18; dashboard HTML is injected by tools/build.py. */
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
    const meta={project:pn.length>1?pn[0]+'-'+pn[1]:'',line:pn[2]||'',assy:pn[4]||'',source:'DOAS live table (loaded DOM)',version:'0.18',generated:new Date().toISOString(),rows:keep.length,totalRows:all.length,excluded:['7000'],exclStats:{lines:excluded.length,std:excluded.filter(r=>r[7]==='S').length,fab:excluded.filter(r=>r[7]==='F').length,qty:excluded.reduce((a,r)=>a+r[5],0),po:excluded.filter(r=>r[6]==='PO issued').length}};
    const bytes=Uint8Array.from(atob('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'),c=>c.charCodeAt(0));
    const response=new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')));
    const template=await response.text();
    const safeJSON=v=>JSON.stringify(v).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
    const output=template.replace('__DATA__',()=>safeJSON(all)).replace('__META__',()=>safeJSON(meta));
    const name='DOAS_BOM_Dashboard_'+(meta.project||'Project').replace(/[^a-z0-9_-]/gi,'_')+'_v0.18.html';
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
