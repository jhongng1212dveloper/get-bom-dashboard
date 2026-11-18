/* DOAS BOM v0.20; dashboard HTML is injected by tools/build.py. */
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
    const meta={project:pn.length>1?pn[0]+'-'+pn[1]:'',line:pn[2]||'',assy:pn[4]||'',source:'DOAS live table (loaded DOM)',version:'0.20',generated:new Date().toISOString(),rows:keep.length,totalRows:all.length,excluded:['7000'],exclStats:{lines:excluded.length,std:excluded.filter(r=>r[7]==='S').length,fab:excluded.filter(r=>r[7]==='F').length,qty:excluded.reduce((a,r)=>a+r[5],0),po:excluded.filter(r=>r[6]==='PO issued').length}};
    const bytes=Uint8Array.from(atob('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'),c=>c.charCodeAt(0));
    const response=new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')));
    const template=await response.text();
    const safeJSON=v=>JSON.stringify(v).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
    const output=template.replace('__DATA__',()=>safeJSON(all)).replace('__META__',()=>safeJSON(meta));
    const name='DOAS_BOM_Dashboard_'+(meta.project||'Project').replace(/[^a-z0-9_-]/gi,'_')+'_v0.20.html';
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
