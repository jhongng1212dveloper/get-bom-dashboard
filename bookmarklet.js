/* DOAS BOM v0.19; dashboard HTML is injected by tools/build.py. */
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
    const meta={project:pn.length>1?pn[0]+'-'+pn[1]:'',line:pn[2]||'',assy:pn[4]||'',source:'DOAS live table (loaded DOM)',version:'0.19',generated:new Date().toISOString(),rows:keep.length,totalRows:all.length,excluded:['7000'],exclStats:{lines:excluded.length,std:excluded.filter(r=>r[7]==='S').length,fab:excluded.filter(r=>r[7]==='F').length,qty:excluded.reduce((a,r)=>a+r[5],0),po:excluded.filter(r=>r[6]==='PO issued').length}};
    const bytes=Uint8Array.from(atob('H4sIAAAAAAAC/81923bbSJLge30FjPK4yDYJ8SZKIk3V+lKurmnfuuTunjk+PjZIABRaJEADoGQ1i+f007zvzpzdl9nX/YXd590/qS/ZiMgLMhMJkrJrzm51WySBvEZGxj0jH9179vrp239+84NzWSwX5988wg9n4SfziRsmLj4I/QA+lmHhO7NLP8vDYuKui6h96orHib8MJ+51HN6s0qxwnVmaFGECxW7ioLicBOF1PAvb9KPlxElcxP6inc/8RTjpYiNFXCzC82evH184T16/dH79+785b7J0ts7CJTTjXBR+sc6d19dhhn08OmLlv3mUF7f46Ti/20zTz+08/luczEfTNAvCrA1PtvAK59OapsHtZuln8zgZdcYrPwiwYAff0yv4hG/+7GqepeskGH0bDaLj6GQ8SxdpNvq22+me9k7HVCqCuY26g9Xno6537LT91WoRtvPbvAiXrSeLOLl66c8u6OdzKNlyL8J5Gjp/+slt/ZxO0yJtub8PF9dhEc9851W4Dt3W4wzA0cr9JG/nYRZHrJ/2TTi9ios29tfOl2laXOKY/QSBF/t5GGA5nIG3TJN0Q+UifxkvbkfuxXPnJTx0W+u4jW/zlT8LW0/TJE8Xft5y2VB4GVmAGrvJ/BWA6jNbLpjpsLP6PBawc/x1kUoA9nqrz05vCH8GAJDtN1D/6HdOW/7nIO6Emfrkd0fYSZGuNkGcrxb+7ShahJ/Hf13nRRzdtjnmjGg87WlY3IRhMoYJz5N2DDDNqXg7L/ysGM/91ahXjg5WvCjS5ah7uqKV96aZnwR6P1il24cqapMz6DHMGCj97GrDZj6AyY0vw3h+WbDvHK8yP4jX+ajbxUcKynS7gCQnY627ai+VmfLHWHyUpEk4Jky+9IP0BsDdRQDDv2w+9RvdYas3aA06La972pTDdfLrOR9yr1sOmb7nRZZehYDOUTSO4sWC9cCeigX2TsUDwN5wBgCiCakP/5rC2tNT2lFdhmyw3cJR98w7ho6wVJv33PV6xxJhxouwgPm1cUERZdrwEspTAzes/PCUNqKXr6cbvuGGw5PO6fFY6aZH3fBWYQGdjiNrObJefzDoHA/01jusHBKqKi6cWlGBVqONO2GEfyprRq9DBg2v8OcbjXQArBmqjHD1YMfFgfNtOAhPwpmBQ9i72Eu4iwinlEl3adJ8boOT48HwRJvb8XFnXJnSsB67YaiOdyWAdXbq96Z9vUEOLCjoLeLrcDSahlGahRsxc9cdM7QZlpg2rOyN484/6FujNz0Z+jpm4//6ErNPW93TfqvbGQJuHzflGG78LDGB64dT0R2fSBQG0emZgNP0eADIY8UB0eRvNK3o5KzTOaOWw8+zRbtI5/NFqFHiOLkEkl6MgZflMLgVbCTErwIoUw5sME1GZYMOTD1vqVOjJ2b7owg4Y96+jvN4Cr2l6wI3H+0Jjmtn/ekgCsb8TTuNIuDZox6nikpTHrzSwBvOoiDqG+D1AVizoQBvZ3gyHJzYWpJQrS59ZQ6XKTDzDZAkgMZomiHAkzDPG94ZUrYKH7laxVUmAg9zuaPnWRyM8U8bkB6eFCEOf71M8lEWrkK/aAxbyzgBxtbotLpR1mwyXtCrso8BBxS0/6Ubm5oVOxv5jdM9xj8DfJzylc9CGCZssjHCIlrArriMgyBMROc2LJWV/Sn0vy5CoK9RAWQWOCr85VPocGzu6yzq2s8a7bbf4ju/KTpyvIU/VWl6R6U7nBYX4eeiTXgLY1qO1qtVmM1ADDEJvNc5CZf67jvulD1d+wulpwovOOlYOMawXCOcpqwD84lBHmon6yVsstmo8KfrhZ/h79zgSN1yBElahOpku+VUOUVU+uqXuMBqlrzGQo+JzlSQd+ZnQRV78elvg16EWaf4Z1iPzNhdG8WxL5W7prDWCNPabdM3e3Iueyqc+4oYqUNt2KkiUReQaJ8oxRm40asHcnKxqeOibIltVcyVZWVgbQp9mXqgG5zYmLK6d0yc1tfv7OxMXUBYuhOr+LyKVwTzKvaspn6mr6SQVFEeJsG4foXycL6pUqEvFFyBqHJJsrODy6W4sMUtY3GM7At2J2QC+i12gKKkESwFIxXjH0Vxlhft2WW8gF2kA5cJh85ZOdsRKD32wlSM/nVEYQeQMKnij0HRxjeXAB1C2BCkahITDTrOSKZ8GC4W8SqP83JmDu5XG+bLcdezyUFTFPKCeLnh8B15vVP5PE02f2vHSQCKRb8qe6FWgTSnxX4O8CfTc5UG9AGg8kAv/RliTAUFa7Yo4rohUGsyRwSqto30Bf2wJ1/YROYTpHmKdtru0dITcVJVh3L3d4NBGJzqcwCxcKNtV86ulAIzQRmOpyfRrCKDm8UJKQBqqNJ1jZfTNezFZFOd7bQ3m+FsDY6gDdyAxVCBRY+hsbZZxruRuGNuWOtQOQpo4zqOzqKISi/Ceajo2PulMLQftKO4EMJY7wRGrghkZFHo8K27mG8O5AHmeguwIForXJGEpTY+MEhVFbB1Inov50OzAeY08qMZf+94QVpwxfysVCvOKmpFn++Pcn9h5WRpKLVfTHDKJjcqGMiSs1+O0k1gJhXkcGYtnsplAwZlaJncpoICMI2SlnJEFO2AQZiIzLtBEqfBv4OkpHypQpHvoP3i2jIN1oswd2AAiyrnpacelOEr2+2gUij1pYW/ysOR+DKm0m3AX9DFgGV9DslkINtwiktN7BbAOUjMPgUJqV6TR6FDATSuj8J4sCvntMREISEocqcPuqCNy5kT8LKW8jPwso25vkaNYCPGcSrod+0ouLAFGI320gVvdQnYvgiNZjMvS282VYJmFmHbFoehYY4fTdnONcsjGhmFGceqL2wIJ5Lxxgno4Q43Xjnf9o6H/XDKjFOzNAjvZMKVjyqrbojcVfubkItWi7ioWsQGNRYxKyvZtWlZJ1M/mIcmkptDViVhi9nljr15ub5aYdQrGemg3z+d+WrpyNTCTsJAlJ71Bt3OTJTOLLZkgkUtaUdgmkTaokyUMvRQsD7szollh9NFOrsS/SDNYWgTzQHJVrl9FXWZi+MZFK9q+nv1m+qCmEtmJxSsw1KzsnMRKrnK0sO4PUh9uw2y2BIIdRlMaqOwHQ68Yyv/tUDAXDedRbNO0Ka+UVZFa6dzfDYcnlU7U+qvZpu7b6zxTmO3MP2cWjitjdv5yToCmW+dAVFcxHlR1TWX+JhcQnym/bOeitckSAgRHAUuFLCcjq7nMGxAEn2ArKgZ6pw+tnmCf6RyS1TEgh+iy2OmUhuwP6nKfXukvKVkGHVy3pJR/Rr+QK9JCqm4Mkw7/pfrkxo6qIPaJ/7wncfHuDFE6P14WBHk9u9y1tcy2G2Au7uEaMHs4iZ1GEJZjG/pIr8bInrHx4iLGmYyVBxYjW4adpK7cis65rY/vY5NEi1uV6FDbLo6A3qsbqeSJXXqrYA5SCNcL7XZGpnMZ9gaOyq1x9KlHQlak9qzyk++3FaM0kDVUsc6ulYNx91DDMcD3XDcv4MggR0uDzYTdzlEgnVqtcoxZ3GFiZobvMZud1y2vlckuLq+i4G3Rmtm9LsqlQd+fhlKROH9WYxrJU5TCcXnyJwJ8vn1xlQov2inp+kCxSVLmAG9qO6Rs4PcvrXmUz+bXVosqHxjldJcj0cniGCK/qCjteHEyWpdVDVJmwPA6imotYpxm7LT7+6wCfVUwzgn2sKdSIECCneUnkh15MwVudHdhdz7WO/s7Z+0zs5avf5xy+s21TYxkKHGwcV0Y3T+AJBKykLfkGL/c6MNb5pc+CHFR+yMvhIHIRRleyhEj0WNFDbz3J2XQfPnW6FvEQJ0qduQVQQWxwn5tnbJyIYBS8ozMLdaccbw+gad4DgIRC27iGNU4SbMqq01IrXjjuO/i414l5VUd7b0mb5C2FjqojtspOUEDNttRx0hAXvlZzAFYzDGIirdDcy4GUViRqSVNv1hZQx8EUWJroUo4sBWeYUmQqE3IIzkzg+fVzBMmIeThGsY/sK5hFEQn8iAoDv5OgO9IMwd4KpOziLwaGY5/gIhGSiFR5FqzrPUSdICgwOTeegUl6GzUqL3pBMrzUQ7K59YtceG9G3Ih/KUXKJ8jXEtpG28Pw1mZzpJ6TELlhkZ1WHRI1qbkhGom1si7cmsOwuqQrTRgkawjfiIcHo6Y3U40L15trJPpAcT8ccVh5XJarr77Aa0GYw4sb4FGsOmOS6LE3iH30ZlTep+DKJONCiddXxCRKoH5XR56IBm7+vzdaPNZ9kcklSa1svdqlplihY6Fx6HPhNb1NJeugpNpDgNzs780yrCHVtAfNq0tqgAWxtDNxyGgQqwdsXrrLYFfzC6Vqpxp71ev2NKvpZKGO7W0p/NLsNri4ubtW865Ctiwpfrp6X80zsV8o9pFjyres2PO3Z1oVa5UF1hNVZEzYTDjYWmcbfOXMithf70MHshrYAt1K5UJywgPUw9maNQy7emGgCr+HW0maorL4Yi402VfSWhCtvqNNciAli/ErepxXIRshQIe9g46wThvEp/N/ksSxeLtqIwnXBEAHb09hJZQwxvgAdJZoEchrMJB9iqs04Yewk852m6BJAVDvNK506aLG4dH9DAzxg/8iMMLyis7V76wL9oOKDIAK2LQXqH2lNAW6ohgtgFbwLtaXZ1+4ZXL8VTcubwqCsegkWmCvgUTvfBWadCtFmgeZ27A/hIb2ZEAA9E8JgZAtxvstZUuR9tExgF1Jr5i1mjAXT7+sZpO91BB0hu86jXbFbjRQkVLSyAGreL2t0uytoUgRgvUADhBIDT8XZ4DU3kO9FrmLfK+vR7WwW3J4IcrcPoaEPgRc0x4G6wtAwMnX63QVL5azhjNgwkpRREdYQhzI6I3K8G6Fs2rmH6krtLOEizqh2APVFkWSlx1w2Wzj2YRgmTaNYPThFuWIPsYEVo8R8c23FCEPf2Z0Zm5G+JAuyMhKkIdzT5u8846ZjtQ6BlvBSecLCMTsjdtETD4w6pVfuWqFwBCzzUXai4/Lk405NLokr1ql53WhVdqEmF0x13LCJcvX/ePuV3yAgARcM8D4OJW2Tr0H1viCpcIhB6e09xnppCogz7YXXq+9VDigbH9SV3RCix+NI6VJ4tgFzzJe2wJT1oNS2BM4xomkd4aNkNV0nVHbB7VTmH+uMahuzAKoSgN4FW48eJw8mNMw3zOGCsI/wcw+SSudBynuIUBUSdH/zZJWNPvCFiWzF+uUk4LxszpgV/MuyowI7gRwyKU7gAKgUs69pfrMPczp0kcPMZcOk29fOlu4aGeoiWUCMbVtcJJOpwNq2sE+r2Q0WFPxmE/vCLVuoAaDjTjdVdvk/iOqDpEQALowECm2lFWD8HJ4NT8/TCbBoch10xnyCM/PWiOLRT0LsbsuemRecJpqDzkBT4n5ZhEPuNkkadoLO5yc6+mXLOnZ10yA7KP2yVHUcgiLp4PC5zP0umbllvwEzoF7rjuqoYrYTAcYY6MDlsR+NDh5PkfWxYgEhI2VWuqk3gqK3Moacq1srwtHZeUiASURGtqZ4CC63CEzzvVi3frytfLTqoK7qTxKire6yb1Dr7FlvfnCZMhV3rD2G4Ito4A9kflIJQ0FhcPkGLR0RZMxDkfecGiXJptYK5cVvV48JJ/Ay9kFP4A8UdAn3e4loB9BKL2K/MR0oMT/zEmQFirJC4kxooCDDp+HSCVB25wD/uGTIY1V4ZylC1Kl2Q46eMPoo1B0KJTN1+R4mtultsWlyocVoDYcquVVyCYTALj03rthG2BeDQe8gU1xHFWFW9R8KCUVZCUGDVpLhkNRso6TcrAV3SRV/fhDUSLAxA/z8xBuotQZetdMHiRNSYgy53BFaqkuGxYmpWhWKxVbCWt1wlXxMNZjn3wBWTGwBxe5qF/tWI/rbxgXFWhsl7NI4gnxlRqEZRWTJfr1aLGFbv/+3IracZjfE53orJMYYrVQ1pslcMUCRb5BvLASGzaL5eQqlbXcIF8WuwQ/ra5TionQgQwMzXtioJ+aJ8cWlGyPajk/E+C0TFiXXH4y6m7bYmOozG530qbpmd1BY4CsT/eQwkHZY8IKLMxQ8mKkdroNiqs4GTfCak584ASSAxA0GwEYTQ4eZLg5AVV7WBn7VTBFa32Oivs6W/KAk/eZz95PYGuE3IJ81zHjBuA/MBgYJm/Lvwsz8rflcatFTXTAumWlwC+0O3ZjJnHA9hxI+TsmU/CtLCIdLnS98PY3glpghwrTDA7Y6OOyV5AHKkvcii2m1P+Xn3qv2WufEOBmOZsYDH24rmKGfEiNBdPOKDRVzn/0S8DE7fiTl/PS2dymXotLJ5TAPdsGk5P6wbZpcg6les4Pq5SwvHqcaYqqTLBmLVPnxc5cwifAVEfNgakisNhJtG2Sx8rWvt2j0Znk+NKTIdI7K1hKRf8YL1+Zk4L0rTQqW5XcXPzh4oQr8hdHG//U47vM5EThj7w04da0ICI6SNCn5F/PaXL7DlsK7w60h9z1EUvm73tNT42PHpnWd1+saJaSbJs+A5e0UotuVZSardq/omSzMiZzXkh6OdvlQYDhhfzz4+TC5CkTxBnIEeiZZnVpFrFNwLHmag6GFMFD/xQS4HLRy28PMrZ+UnKO4/C/MrRC2goUhhs1BoHYzIxkuabkHOBGiHW4lIrHaAaEHzTL+A6XrOK6aBwJMwTISlh/suFjf+bd72r0HQIJoMlBmUE/86jRFUIrWOk06Bxq9pds70loIdGTNkw2XmITaxN/Co9S0lQ8Gvpg9DuiuG3JNBsjvOdciynsikKmORZQQxsmogssJ8vP+Isx9Oz2YnNqMsVzoUEybxh1NrQpRah8U/Ncgb0kZu5LSdHoy+2ZTRFZ0D/Rhl6zZfWas84HpqeDZOc+HogjXKw5UPamVI67TIHZgYoBK07yDoQeOMFxiQEZPiCWuMgk1OjF+P2qiu8IYvFM0VOI3zEAkFs8GWa4/LaimBGpGHQ2qjnMW/kvqp4pClILXMSyq92BahU8K8ewfHjccG0KZOD4pd2B3yKKQUzXd2psTM7dByO8FJ2LMOypmaR92lPbPX7w/sdRggZ4s0Dy0RZ7PuzA+OTQt21bZY48xQhnNSCTTiG/lESRd0Yreplst/QREwCiFhDwz+zsUuEeFBzIr1Rmgn9iByAtE1xSgqs7DQht3mYHnuFSlXvX5lzOcFUH9lNvhzUwZgnXJkUKwz0lrD3dnT8NK/jgFeiGhAwNX4Tz61jqVP7hEwuhZOrq9DbkXs5g4pWo2udh7jmINMGWfvxJbDqbIcqj+suiSmZd8SE8ex2FQPbWFA5LK463pqXik7hG3xj93oOPKr8Y98s9v7sPrm7F3WuPFUo5OvBp3oPhARktT3T8LB1rCHSp/TY+D9Rw551RyfGHDu+AWVAZrvpJFwJBHukmSBx3ryFhM7kOjyuAkpp0BFpmRTBAUDwpEqIFWZEE36XEw78AufkTsoMXGr4LGUpAJYlsmJUlZh5mIecCFEll5dPK62hoK2HBDLddbc3mlCdiTQWO7eidqxo+omuwuK2FGWWBDaMqZ1m0MtoYREILiqmsu+jpCe5Lv6oQK7whmG5WkQroDZrSx32KF7h7av1kZbAVvvjK2j0Gj2UL7RVZ+T2oQVavIlVQGvCBSohcKamYcAqoqiYTE1OlKFCUOT5pupPnBcplTh7nxhDFfg89yfKjCBX7rfxNBMlNRWaDqRispxp05cOAtBYAi1cNTOuDbjS9UX3TvuHw+ktQAJilynnpQOFTpChnsKqeh0On0lQajcNjuCiLIYKTeSknAkDTLZwiKFGVI3eX1LGb1pQriuRimsNx37KkjXkt4iqQ0DdsJIr8jURD04uD887g5Pt3WeOzxENE0xqLoRJ7PFmtTaP7z5ifJk5aQ9V8L2moxLpetCRlsw1VpqTWMnYFHowgeIZYhOgG4cz4T9VzjBSy9ZtwP406RuVVPJ6cmxYawoXxKuqia1Xl85tZWVkt92R4/c717CWVUHlE2iaQlV/+gdpnTWKe0vZFYvmMmAGckVK3qb25RBTEAdVQlx4ZYSHBFKF89//4zDtYpxca6gaEvDPem3VMbc6UjLzxe0hOZvxSPYbQqXKJqc7sVLjOj0k+K3ar8v2u/1j/8j2h+I9v9jhn8smqeV19u3RooARnVsKKtalWgjnIhTWieK5agjVUBY7waBrCWUQQpP7Q/RIrMViClJRroihhDy6CicDvrhZ1ckvt5cgsiKlhOU52FTOHHu4LQtGGnYJ5BG0kvVeqETPB6/QpOisZZD10btPESmwMiTYflcZZiHToNWHSPcwROV1RHBEM8XqU8yfwLq59xHhjkG0ifP36SSbB7Zz9vM07fpyjQDMrJFAcSg+7bC5LqR+1HYBv3Nb1PmEkbZmk2xsJS+qVNTlpVpcqucFNg7ajTO8UDXQo97NrfKt71hfzgw8yiQjaXKv1lRhX9r3BjD33Zw5KqeMBCpFQ1FoTdomkprJanNoQbSw1PtiePB1PJd7ZfWEGqMCq9YNjVTpmHmtFg2GTopWai7SrYr+m4etxwB6NAq8BSXyTiC6fXvmI2adS8jxe9qYhzXhJaXTVsMBjzVtxGISw+Vel+Yp5dHFOhUhG3ZWsLw6Iinwn90xNP1I32DjyC+dmJQY/ToK9cBFT+cuFk4hwV3HVJ5iNtP3AsqaXOq8/MWLibcf4RJEtWWWcyeC/TZz3PxVITy6T3wsiSf0GjOYfjQXNmu3giF27nnbyojUqrp8xQReHq/zxkXmdomh2OANqgtrqLqg1Di1FylJyVGz6V8DROXVedd63qkIyI1HZrTxGUhwlyqYvCFkdCs0KDDU5HxeT6awiDpH/Vw57GW4YFfMVTVP2YZsPL6zsOesaGVA7aN9Zwelo3xZXvkk4yKdUsmqy8/W6rSqedKxOHDMO3zLg69RBr2GqdCBFPMQYckb6oU2V1jTE/ZQwFUHoynCtb6qKm8iSH/579JAJRoS0dT+XDYaVWz7wv+FGjILLxMF0C8cFeg25PK/Pr3/2HQAnbolffOzEK5q2043fYhCAuF3BkTuUzLmajbrWYFmEHDnMLvw8UKcIC15YuRgcjDRUTDSyaw44jQA8mibdH0LkAC00f+GuVDfQXE+pnY4Z6/5NkDf/2v/0tB0hI7paBnIKfV73xnFFVa+TJElcOrw1N1nLXYaiMSd8JZw8dkRVmlk1rEVcmRjreaYe4AtFVauiPyyp5M3NWW/OsxWFUhbAhsWRQLGmvzJI5h4rIyZbSLAFgNQIAC6HLUU57S8PhzA3B+diVfoAhwPadjmE/SzxOXziwN4P8A9ZVfXDow05fdntPzTp1e1znxBtdnXu8FPkHhvu90h97wz/D4b+6RUqOPJRdnzsAbOmdt+IttdHtYF8sdQZ9yaGJxxTiVoV12z/GCop2XE0GZssJK8rj1lEQYknweTRnNwd8ucUfnf/9P5wWG84lXL7hgxF49zvNb+Qp/8FcPkmm+Gv/CPhShbPlzepNLuYouVSLjNballPpjcVsWWs2AY68sUFC/qssWFr51PfGWEbw8xD2/SIBoXKaFDtJd9Ajr4g0djnJZBENvfPDWn9uFFY7Hb6k8WgYofoLTbND+OmgcYNZGkGjiRDFCona/XpAWDRD74TOVoToj5/UrVWqxzJPzjj9rRMFW7lwTbAHdL9J1NgsF7JU1uchmck3u1uSPYRJibElgafUZPLc1W1Iy9sXYyhiDxeZI387tpdBwy0oJwwOe+rbQAJlxv8Sby55FsJcGDNhNPVlUnS4m7EdZEA/mYbirP1elAEpBQnSUMhr++i//WqoKtfiMKfX5LPDbeU0xmR+blWU/n+BPUsEmrqqk1bbC8mazJvj38z1rUUKZqwV3ArKQSzQo0u0Gss2n9KtEkp2g/xFZJewlKfpw8RApzIwvC8a4waLQGuBBR1wSnpembj1YHHLJUcs5gJZNVRXiCo8E0HmE4enqM0yg8hwD2WzPu50BvtjRYvesI6ra6nc7Sv1HR+YYHxVMG5ftF1n5g17zdXl0BF/hp5g5oB8ygFw8P78oAufIAc5OT4w2OAtaxp+V8sBtEREI5oZaVunrzWugj/kaKYfaOvzKyslpc3nEDtFwzHkC3xFxCmZ14OVxKXegc7rIa7DXylWqaM0QW8yUb3hDhqnH92hej+9WjH8ZZkBkrsJbZ+Ko4vqbVyoyW+QHic4LEjV57yR3nu9ns3cGCAqQSurIvfN6FmZAwQInytKlKd9DS2xbHzhFkZVSHZL6epqq283gaa5cS619s9y1MBEErwymWwG4LPmyUtL8eYdRwi7M4hlJDIcMNPKnBw4USu4ZaC3gg3XK2sAvFrkBXyFOXJjWrr0iQMl21JQuhzN32pWiau12DD/fhfvwKhdo53JVSxlyn7nCmTR9eK8EwLOEWXcb104PUVNmcTZDJgaPu12QbG/ZJyiuJ5pO0oMqnUW77x3jP1MN2aEdfzL0Ya7tsu2aei0nCPNZFq8oODzNKqqyHZt0m9y0EIYRJHtP4Nd5RRauqQGLDduYqvxAXx1/sahUlrIp5bXLK+KTdp+hnphTNRhXFxPbZELGXpEK1XTXqIp6xivQ3uWAaq8f1C4qYFcQVhO7yfiRDk9+ZskqKk+n9PsnHfNM41DfrNPz36NUhYeU4f8c1z1SBn8AFfSW9Dx8BROM5wnab1MSvqCmJqhRlUYezknuHvAIQZXmt5zQm3soFAXh+bDb6aCAA1+bnvNTQgYtYYBrsZSAJRfGoHaxDwFwTCSPMxqEYaNiAR+Eq4AmsGcR3+BJgoVNPjs9HztRSX6V3q7CVVFG1x/epvMQj3aI3YI9eA7j9DHB7PXz50hJeFoG9p4yVvHWOXjaQ1AY2xxAjoAqLtI8AcIXMG81xsCA+prMVTDj0fOUN/O23el0Tzon7U63jRBnzfbg4YfHonGcW01po2DGo2D8JcymCJfeo2km0eiCnyMlg5PzKvVgFBm6lRky/ZRgTGhmSFPYtwp/WuOWU20LEZBOslCrKF3glRgISYmHDAFVFOt3zgSKtXDktFwEKXzIkIVCVHcCX23yldFeFqI7DtOxvMUd5NOwc3ZqMs3oM12XmcVwuvSOEMh5/QoLAUZogJTyFgNcKX5BB4EqW+mIN3KQ/qE7spzI2zaQZzEPrk8tQz/JNaA3AKdxu95cxjN2FEmXeKn6m5/+6YcX5ez95Jbuj3bCRc7Ig7NaA9PAe6T1zetp46SrvdkOY8ctY6zQYH1c/PTq969f/SgG/Ou//BdHvnCUN01PJ7FIdtFkIiismheupIbTDqbVrNJwQcrrLaHkLNVNoD+mFM2Mj7mtqHzC/I52bs4aYW51bmzS7ZDdsz8fvzx2ur3FSfvEgf+pfJw5xmAwgl8pZlRGc86/maUJbIzHL158+Pn1Xy5At/jw4dnjt48/fPCW/qrhOxPA6M1ydFEg3Wj47zrvmx58XzZgVVfJyH/XfQ8MHz578LmM4Esfv9CrAXz7BJ/H8JnD5xA+C/g8eb/FyAzM7BoygxfZyCYOTpA954N59579vHj7+O2f2APY7k/hy2bbcp49/vkPb//pLf1i5V6+fvanFz+Igi+f/yi+vn2NxTpQ+e0z9uX54yfsy5T7a3mjq/QVPh9zyLz84e1jggp++fBh/A1//odXr/+CBd9hUMyR8xoZL7PyRWGWiT2H9A8TBQDsxty4hOg8zZE8yxIYlU04HmTpCnmWXzgZiKPxMkTU3VyNXNVIhbe8U6zhNYaNxGHgtoTMNhu5PKEPPMsvgfaN3BdYfJ0ohWGzXY2625ZoO0woCDIC6vLz8z+WrWn/YdNnA78/PS2bFjVFLWq4Ixt+fONTjKnzaY0JGtHX37I37J+cTiO/bFirGboto+E/ivaAos5CJHF1DfdPpyAZlQ1jzVCpZYBCazhNgGssxc9P6zjj/WDD0fSs159ZGoZaXhXGckKvV2gkpfMRQOj8OXK11SpLr/0F1KKWBye96bBs+fUKis5ZsV0tv3ymtmSBRTSdRkBTqkB++axcPaVhagywse0ox0FT5w0n3KwTAvIg6J+dKQ3zmmIYJr4Jc08NppUjZlfYKPhm1DTQ4lmYxEzz4jOqbTiMBvBf2TCrWdYxGn6DjDsFEgGInjszP5mFmMDT6IN2yMzv+1HZMFTQyvOGv3kvCUm0LICMJEhoXxHLbSRAYdMX6cxfhJzsumHS/tOF2xREaTXDOo0EyGkTKxbO9/DLOYIvv3NAEms6o5KCgXgJhXMsx5vLm14WkgrXOHr34NG5+/5oDrjHaL37wB25D/zlauy23Ef4fVHg13P8Osev37nfwVfcmWN3+272Hmk5kEBVpuSiZujAtgHxgqTPQhVbmcykSqqc9vFBX4W3b15Vh12kf8J8u08B/RrKJFhrOAm3jVD6BjNYSKHwlRAtFbGQiV5MvIqFrKn7Ppl0iaJDQ0oohgDaqohuqih0xM8s6fFLTBp5jtJMMXLeihglCi1rM/7Vfkfzef/m8c9vP/z8w5+xwpssTjMMJuM8zmnM8fQ2cGEsBXIHJpONcL6NW0C29AbeCHGzxQKt37yirjX1ATuSqxCkwJyQsRT+FSZRByoJzc5YiCv1QyGcbIVEIhjyzRcAAkDi8AYE92LhiWeIuID0G5nPBPg7bI2QQv2ucTYu3uvsbmHNonXCjpOLht+8eh6HiyBvrHACPmbqnF0xe/XEdZsOBsnyoUw4hqwS5/vvHXjJRRQdX8aywvUkZzfYNBi+iOdx/hOXiCfXIOlMJhP3res8eOBce4swmReX55PjsjRb3klZCXbhNYg/sPn4ePRR62Mr2yEt0mjGyxcxYPYAd/K7/D0WjiOnQUX5yHDpaHD0UAyw2+S/88s4KtRuQDRlbzCA0Zx48HkSBx7mw/oJI2VfRw33g1oABWko8flRB0YXBzAqKM7G2GnBc6UoYJ0s6bpqSXj6sEslsxB2SOJsuP6OrbegXgvxdJSDMLct8YGTkguJFg2/NW2xmo8BE/jXJwZSfJ5UEMkXtZqt2+pb0eYTdYQmlnt8NI3P/PhT65Z/YUHYv/yyowZN85Y+DiiN8LjFvweURbhBYfxo7gIe+uURfAxQfI4WAHuw56b4x/eW8GUphlAPDx+ThmHRVXJI4QCKBjRUQU4wgzeK4HxbjRKcEmgUc/6NUVH+49MI1p2pxSPYZDlQFWb2C4MRUqGLsEAFhdBJ+Z3Hc6jobBmHUO6mQLsxkLiHaCrUXPJOAwj5GgP9NXc+iwxoGtdbsJn8+Yef0UUD6oKHh7VxFQAWbtfruONvAhDjkdZ687D4YUHy/JPbn4IGd5EDcQg/F095kg1GUfFFg5qbCw97RUBo7mqZwjzMlqlBznt2VaZAEGtlZFhjuXoiCpfJMFDmLuORJFFtDXs+oLXqAGVrtZX0oGFzdu/M2bQqI3rvMW7eeJKmi9AHiU0hqvVjpdAZKzB9eLOrJoZlWCvmFMixqyqaOsyq6Bx6iJgKO0HSiiyMsjC/BHzzG4xAcC1cVdK/l7YCAYIMRbTMWzr3JtAwFnKRa4liJWPgzQTQYm0bk7KNsiK3tOzAAhGdQ5V4ymN9xvocXDPQBvmU+fD5c1dpLg+LxwVgFvwMG64aBQSUiG9DpZOmOhSy96PH1WOEo+GmESoJ99QK6tDRRlQd9MVleqNHFSVEsGqiidQpqbXI7rCjHg6kHp0otKu5E7of729Aq2nQAjOxpLlFiyF7LNdevPoIA7W92D0ODB4zhyF7BU19DQIHsLqMFCT/YeZ9ajl8VWSjAs4fn71+fEFhar/+/d8s4XX3N8ZKOLTUHsGzSYBmZlHuB2y6W+f6/gb21/ZjicZkYaI4uJHYCnyqSGCC8qHYFJPzzCtQ1APVT5RkZ3z96Y7Sz8vSzieQsWVJFSqTcwaTTrPFMx3YW8yxxVLvFi1vy2klKTHunXuTPFpNIcWqWO+ws27YiEf2WI974CYunQZ2x+X7OAH+9/u3L1/gkqErRUFqOXiygjNMy4lH5YB8LPqwIR4DtOGh0OpasjjAFZ4rCh7IDKDAgmZV3MpCANLmtqyzSqGKBJDnfHQech/jx+fxnPIn8fNGi1uAGGpSd9seziL1kWrKKErPYYFnAAFLvOC5uE0kFRGHqHkvPULELTPA3wHm7H3phJy434azKIj67lgrQJ5HOlEFJfxpGM2GeokZf9cZngwHJ2oX+h7+iP70Q0FRBlU2FAo3sq9/UwCuQudLkHE0IpA5/tyPEw44K+rWQYj5ad1xLYCYv1YrIODDvLDumI5bchMRXTUFgonneUKaJbigiZ6zzrzZJC1RWsrJQC228mcsRM14HGI5aA1XzaZIqZcAvjdYAV7lCqvcY63k6TJkbUAl4tFQlXq/Ykajq5ZqeWa2rythXG0yqsvN9mM+RC9KM7yUgLV78fQdNP1+AkoSFdZM+5Uak3P+XlTCnlSBAQ9GcfH5JYySXjF5gzdBUGPbAP0G6YSqIO1qgBjCDyXigt9LYZ3TyWY5guetZNRp5fAvgn+f8Hsx2mxbywj+bsesiZw10UqbY3akOPWShw/Hqffp4QQILnzJi3ewXu8nDfn1l186zYdd0WmjpPobKEKVlxEUXEZUSXzntba0pVMvgoKIqTR47giZIMqwcbGbGxrN9x5awxqkBQIT8JbegjSJp1w3Q21PB2U0n1gAaeNRErqTcwO20VzANpLARdgSaCOEbcSAywCaBnmptxFkoQEO2agK2lqIpqic554fBHJZOXye/yiBA03bgTP1krbvJVTh7eu3E4UWjS/ePpvUA4IXev74yQQqtqEwSXfc0zQBnNaxEfri7/hEtJ9sMjSMVfpqIt8pfBnLKCYYPIk94TjAB8PkMv7sXee9t9yCtPOvTvlML9/uYhGUzVwQityyccyVwfxeDogzIIm4khy7LQDkCEkvzLrZQuo2QkatMDy7DNLcEudazXIgwoW/QLnlY8sHmtI7HvaBlG5bSn88mJj1po+a98mZAcHBoQHQV+qFtXsy6/sAN61dPZaznAwsnzYZRB4hB9G4tQBXDAK7v1nNqF4LAQFS/3M85I7nev8BOT0Bi42D3fCmj+O5GWJSDgUwSgxFOu+hP3K3lx1Dqb0ds7vi9I4V/4roEBBOmzs2D8/05rvQPAECukAxWOmGu3C0bp6gkKF2UqK77sNhmK+8rXPEUEEuyTKpYgTIvqPVrROwRwSzwzrYlr/Z3LgXCWnR+53KCp1eaGryK+wixkAn5x8rkYBQXkYntNv+6P7myvO37rkWwu9P3XN8AV+2NRGF6AqkMvCFl1FfI5zYe/wmCtDfj8Ki4e5WwygMVlPDJmLH7Kv30qj3sWbTIHKxZVL3nb7nPu7sjEJgq4PEvbSvXs0gKxtMDFJuStqRu4eFsbIKUkw+PoptQX+MQrDsjvc3AJ4t5hOXgSSCaKHQiy8xYiU+tzcV+sennZloCiahN6XQHWwN37PWds9DCexVp1M+fouu48YeWPOgHAPcz6SJguvTDBO+Sn9CswmdUce2mP0Mkau0pqHSvjVNxKAtItFyqje9l54rLPLEzxp50WJ8rOVcao6qcI5GACHOKrI5iC0oyjKhGp/QXrZjxP0NSMlbsYq8pr6S9zdhPiMJf4srKcs0GPry3y0ao47ETb7i+v7nnoKPepy6cuqIx4ve31xu8UgKdAlT5RTFBk15f0ANKEFfBnVJJIzg5sha5KETUzp95TAW4OSyPrdYwHtJ8hEQaKDvtJwVPEfwJBQvxOVUsXIL9Eajk8Lj/lxUg6CyWiqIl2apBw+ce1gZjUbwmmxFrloHT/VMHFWfwbLf9qNegP49KI7qJK8i18HIYBDO72+g9S3CnfWFwWjY1dal8KJ2XmhYIReOY1GC+DM41e8954jGAuLuY+bBbR2GJYqNZWUilBpzfY5lZZQ9D0djKraKcrtWmx9Y+9r1NiCqstY5bpnqUh8G2CqAXOtRgiAt3NrdrceYGzWTJe4w2fyukq4Gb/XVyuXSHMd2Q5gzA9ytS8RVRH+nh6Y8oigNgCpwm/VLpRZT1ww61O1W6NFARHbL97qtUJ04HqEhysuC03/9+78zWGqD2v769/++A64zBlfGdQB62/J882FANVPNYKbArLLofJcTnv11vVxN3K57Tl4ADKYpD5faD0ZQNcpqAgChqnrykqpF0ApYOkhqByyjZFsWAnmBcd58w1yFtyx8ma6LYSHgREbwYIBxNbJibRdcwdstOmo5du5ABiYaEeAas0Lh6YrLiYoHsPENEh/NJ19Iq/VAYTvt0A+XEzWnQW3lCXWdMj14cE9ezQkjkQxm63JcqBIjpNCCWjfrCZCk+tF8W1IbsuxBG6QKJlstsU6VQuxdRJZhp+nJZD8TYJbK9JjogZLAS5kfpdEsnz4ROSfYw/UKoBpeaLmmGk2bLCdzTC+NrDy75RF1FIpY92lS76Yys980ma2pDFB6kd5UA5RYfFYuTThcVEwn56m31CuVBt1Pqt2OUV2OzGwUysvFgs67aRatMq7JL2YYrP94sTBNXA2+PMto/ssvaIuDDSKfNB88aGjLh0VyWYJT1malPxjNCwqTbyiNa3W+5x5FZWSAhEdc4hezaW4/jrTf2AVaIC+L5WKyax8qObUrW5ADcjLByBPBymtzZKlEXeZsxv0jJmmXfXCEDyd81Yl6pcKEqqxJmFdNjksYGeAEypm7F0ctceDySNKIylIwuXevoVcvG9cFWsQsVqd0BvMJKMuWeknp+025mfUgslkuF6NLMH8b8ZQrB+9Ngshdh0r9kTqsUlkEeitnIpx+5VwEQrJLk0WI50dOg62svsxwLsgqdb8XgQisB0jO3LLOUYkrwRzBvtMSTohk4O75q7SciURolPq+2+2D15Nvqco/9qd4vs1kdZM9jEHNa0dzqjyWPGOibVB72V2xG+Jki9pKs6bPT+swu70ghovBrVPDWiH2uL0ywzytH+TZ6vFhwcuJiduS8x24HJTqSR9b7dYlHIVxEMnMRzUojbHlZJhn+Ijjo3xBhJU5Cykp7SzC0SpTooxFUo453SmespsiPFePVaTUVAxkz6FB4rNLldEmMKHJ8pdfypUuuZvG6hC+eDXv9w6BeUQ1mdxAMU5MAfhzHN7kf2GR2/8I4jXjwCDKvhFZvPmlvCJXLR2RmaXLaZywc2so6z7U1wiPMLJNeBMnQXrDNsVfMGHHo0mXgvMBHUtJArNjNSiGkSQVXVApd6U1QdtuaUWRjg4TVsy0Z4fJKoQX+WSHr3VyzsqUHrwGfyB9gtzFZRGB0EnHShvOuXfd9208frYjMBaPq7WmeGaNO7o552y8w3OF76EV/PwCeSqa301cotUmplzyZBY1/FvJTLyHO4hNegzWyHx0N+FJXCdyZ/HJlrHzNxOi2Dq3Elzpw6QplJmwjiZP1a/ebyhUWVfwbiIRXwQmVeAsdkpFWMCuJ7KqQiD6enFodAdhiPW9FxP2i5eKcJk0v1RuuoPYpCPyfuFJzwC5T3Yqk+fuE52UNLuKFFM+3Ss4KUW/Rm5Smrmz2KTU3SU1aV53m+xkyTl52JpYBKj6Xfr/mwRF0CsFqKgqQUUVESqal6zta4SnPWKPFEkMqQcZzVR9B+hJb9VzYWZ1umSinFrArkidVPo/x+4p/sbogdf45Zd797AtQQP44wcP8OGDB0tNVAuDXfKbglt0w0M18Lu888FtGeNpHoabmF+1adua4gSM3Jtm+wTqgwmSHwQ/YKL6F3RNLXBIlzDQbYWMmaqx+RMQovwMWvQomW9eNFz7jWPvJall75s2lOVR8FgVpkl3aFABHP+u8xVV+bU6B0pq5LYMCfmgVllO4h2AaYCYUYPkB3XAVvZuzeORSmydtpCJqrY9ZGDunTdRpY/DdpGJi/XUYP8ekpeqiLN/h+4hPcv2YZuo0gNT044c4P5cPYSC83mYjXgGo4RnLClPzRNxjxPQIYH+M9QjNRFaqV7szE8os7tkGO1cfR7RRczqe2TE6DOB0WI76k00MxCapiG1wJJJ+A7mkqCrWYRmu87DaL2Q9zlTQkmPkAgn8Bc/5wPjwoHEIGZjVw3hd0GeupXFAE23vFRIEgneIr/6p4q9hP1j8dKyM0jMY0lnooY+s3sTtj1qGy8R0tmFrej+MmDGh72T3FaMZ781vYUOaqitYWKxkFsosY/YWjwbe6htCd7D2j2U3lqX7bAuDqO4NqSD9jmaV2vDHov/Frotc6+0NitMi3Yd0kH4bbNyDFXYAQ9wQuX7YmJkRt3KsUEtYHYfvaTcqrqPVTRAbgrTybqCJw6FYavRyYrzXhiNMNjm9RQPYHrQXxbDjDC0vSmNPM6Ujm6hnQdTkMBHU544d/r8Sj6H6/lXLef6PZXXnf1LzO4ndMsr4bm85p5L0gmNUCdF3S4ymaQ2vRGOV27sw5AQ9LvYQkIqrokybW1g6LR4FtzqBzgqlGS3gZIs99FUhu7g3ZrXyLXgU6ZY8KfrhZ/hb1KUU0+4abUGz43wg0VcGBm986kfzEOHN5JbVXJeJmJlonLwtjmcEwRZgBwiSAvD91vOGc7ZGJuamzSaswSNUB2RBhDpO9sK//r3f+PdficDWetbXWXpXA+nLTIYmv4I741y9YzLIv6Zxq6HV4tMYfyvFmozc8931NTSopejpvTHNjvFwR7xit9b15h3U5lovpfCiBzGFQpTxunW+up3tWpaRESTkuBUI6aX6g6N5mJ7Rvb9GSnbM6rEbLGHdBSU7R+usu+JxWLV9gVjsf2olrFvixN+IaFpMAtYI3SsBbnMFpmGJVxLRZkKHpTpmeuQoBK8q9gQANR5eQKkKM9NYNqjsBg5lpPdBTvZfeE2xUmAQjvnsL/qc7cpA+05hcaBEFLMTS6UF/zkGJ0a0k998RNCmEBJfEXuhHcpdjVHdoAyNStV4WVYml7szZLFy9dHG15dV+9SuL+ZewVDQdmzc8Tze8kbFrRa14LG4LBbfOLcjGkLQ7OH9dHh1b3DuyiANGIYNaa3OirTu9WOSz3CYWSbq5zxsGSNq5SxJIDbXcaay42qbCu3UuybvS3jWu3MLfNSE7XRuZI7j+BPSfxpHZaJM8Xh14e6yfOh8+ZVs3Zk2klS6yk2Ol46Of/Hi9evgDChyhpHtw08fNhCV4meXQkfrRL92ftms8mo1JdOUUs8KmdJeXMxy7T3pdN7vnd65lzgWXDQ7D5W3bgy/3gNteWXNOp+WhlJ/qnWAcvJSYVobuTxVU1mffBA5unQvVi8HW4tMuoCN2UVI7UmRhTtqlaGvwOFVSqKoF973U8UL9/IvFUCK+w6mKUE4K58X2pvUF+o995aOuFPWKJRdhh0q6RAma7jRUB3i+QN5C7qggC6mEeKiQFZjhSzCvMrKK/wL5RFPnx4/vjJhw8oj+DolXPG0LwHDKMxv4KB4w90ls9Br9lchbcj/IKusZHRnswZpmwU0XiLuDjWaNFIR5gIlV30Kmex1Tge8FHqek5d81dzj6a5WucwR/4MzV+YM49nJvZnWZrnQn0d8fDfRZ4ivNFfoXtigPJL0kXj8ZQxxAbUuBT0vfMV+5S3MXK+hpQpazX32LBxvWJcL/EA1yzGNWPHxTENLrXFcuLD9wBzV+FRk4QtBzvv7CSjjr4SMQowotU5tSoGUHifnIcIok9j/JGwY9/0QhFtlF9SulFmAK9hCOVuwR0H8+CP2Vrjo/LENN85GI6BKFI9Mc31dd8j6RJXb8q+fg9fCIX4QWSQlLTfI6ehVGKI3e7C427T2J4rEDsa2qakKGWM+376js1UZiHQji1p2piq1mlxz9TYtjfQb9YVz2VENDsPop8ppTjw6aDX756yOPDuaa/X70i/d81BLtYyO3LFTyFIgeSjPnemRYnklDaBXHKR0nnMLiLAMxUmYVPOb+TxnGW9KllCqyTzLY1wi1+fZAkkAO+5/PiLcsQDGlWofjwX5zzkA+Rv8XysPBS2d05mkXvznauOTV5Q8T2fXqkCzD2gPE1ZYCQKcN7Iy5SohkKONCn1mtaGuI13l8oqbg8x9eCP9zcKnnM1Uk0IRIcQWZbrKrtusvdsM3KbJbE9rZBRE9myUk2P0K0evakUVeJOytKftIIf6cQMf4PnZD7uVujFRSkmdBqsTQYc4UMXJ3NGbKZUguEWnq1x2ZKM9KjJ+ktXUJ9xqOYFXQMwEqF6mCteZvanXyJXqrv77Jm8jqTJvBevMFYIMIluH3kol4G4omp62GPzKFvVYWQ09+u//yu/HQIIgp7Pn7rh7yJYucy/EWc89qyOuC3F6JvxfrZ/KD0u2xn6TmUSC22WJguB4Be1+khjKf+YuIFlD2D5NSy61ceCITotj4R5V9tnxqms6nkoPAylXywtLxfX7olldFjgHJsBsU+lO0HXamfGL4NpGkfSFP0nXK7oJswpRhSxg2QUQ4L+xFzEleZoxX2b3bLAD9Qj6XINdvcOk6jKLMOeot0LNrifjllHatJYVcJFD6PEUgtOaLLlJ5JoCHJlEhCH52cjaZ4ytI3tZpyqqH2AHQfEVHYrDT/OBhRCTQsdi+tBMFXyHKRRoCY55bCgcCMZuZPyu8jolg3R8E+JuNcF721oUUu0JBh8ugiLEHugI3oixzSMnMRdfhmIqCAa5K0RMwc6hk3B4uIFIQWmbtb2+1HlFpQcprBEUVtcQsMGirJ2Q4qUMDUhUwr5Tcp8JMZVUsEaQinU5HmozHbU4FxxfN2pSS2LGYxJVnMpyazyU0s3e8eEs3tTzoJ4hVln4aOpTevp4zcVUjvowI4fai4ryqEtyuGPGkTPL9Mb3BURC1VjQBtxRUdKG9CpVmsJUt3P6Q1i8z2qCYowq8Kl5HOqIrUh1TuFdYF8oJsoXSDNmrjHSE6q92Nx91Qmbd1s+Ft+qtSn1Gtqt1s+fvWYKbkomHdCKlacOEoY8GVASz4eqk/yknSUOafzCSKekUl1zAsxNSUoySwX5mU2ImVl8HKfCZYV4OWy3CqpegRXSRunJKz2qzI4tOIIZIMox/Bo0ittCtinKKY+ewikHZXeRX7+KF8vl352y4ALgJUttXtbWnF5aRoMgZfV3FRJG1hy5uNgy+nJyU3Ov2BqZZoXPkrOJLYqNtLtmtqekIhH6E0DQB31nBBRvxFUeitha4qxAJHBjbpF7PISQOZuhZcv14sC+S8rIkfOPDeqM8/oJchnSi+0vXcVF6jZZoNTMbXBSOHO6p+QU7MIY9TEd3dVUPod7uVGowhTy/n6gR6qLYvaDtte5Wu50TgnZJjQtFJtzNDaLHMDHrZAGVufw+CcecFdYMyq7GleAWx2GFzJGoCZD/fAjlMmm+9lnq3ub0iKIWEdQ8o0T+G8Qiftlw9CO5W7UFXcnqPtToBi7mlB7vYazLNOfiDdMoJZiWiQeRG4W+4qMoo850UusMjObubsGnVspKqqsnQGOmPUeBIqV0xsoe5A53ApQc8nmS51/mnPPOd046XiA0UPqDaYlnO6p43ZZUgehOs5i2MD8b7nOiwlDftuu1oL3fsTlt0ACF2WXgFT5JlaKU2neNrmbfa8gXyE4Jn5KwwMWdPd2fJOrjNnuBg6wzb8k1dxmbfX1t/pjng0pduMlUub1Tup40K/GlZe+Vy9HbrX3XV3dL/TsV9KfVLzfMArHFVvwpY3TSOloVulVXOvuJRPXg6tXXjIL4MWyazYbX3mrd5cYi41duMePnb/i3HJnmu5Y/DXf/nP5v3TgKt86/6xuJVjrF4Kz14haTHuoi7vo0Z3H3wAk+PS3Fa7k9q4l9q8PLQmzQpz3v+MkZF0k6VQSsSNM6gnTHG7hNl3uYhI9ZPZZZqx47zXQlfETbBK8Yo9PdxjZ1C/YmZc8dx4Ir6T9fXPZkgKKANjNYhkXDFdYg2tjbdpA4N7RqKH1jS89OFbNnLjBF0Fhbu1xTGEGHdnBrIcEM1WG/DnhEJO5WFqaFuuxloWGRIoWB0mpRZZU9GxuTxP19nJoEro2zyw6kycSkTZsjx0sTz8uCo/zM4lSMq7QtHE8pxoXsb9+smtUG+1u4p08wFr9xWswZzpmBjRoN+ORNdLLuIp3UjRchJyB/nrIkUv+8yj4NFvDojyOXgt7EvhLdWVsC1ERP4kuRCRdurFmTh60BCFDIkliA5aA5qp3E/qNdW4fYTcsd/qUs6JLr2GOan2fxb8zoIJdB+I2DUXbD/ClKobVE9nVU1klpezVrKuKElUrJsYcARvk+L4xJub0smrW4xxCP3sCI+b0TeRZBtNJIzNlhSJtfUzzD7lt8aKScky8hA2ZhV34iVQ9llclK51zI/k7SMsHEQ19IXZdaLyIDfM4ypk+YpuLkE9lYvIrnfjjEmQX5p1jqExrCVgMMtV5Qg5vw956X+Ol+ul02D3mso2xMia3q7gcZ7w7uC9M7XvnTyci60zbeoYNpU7Ji/2hYLLhGwHj2dhH89CDmdhDGdxh+FUEkQdDqY9cfV58Z4N8KvApec+2hl8vmHR+7rTRqcEutvmgI613Bp36J6xqXv8pKc9WwOTWPaPQT2kepchRHOjf/3g2P7ulWR0h6AFpfyvoMQ7mZAN0EHY/3W6z+nPT0mRIstobEqKky9TYM7QC921AL+heUF/eDa2Xd2KhG5K17sQAm3+u1mx5D8HbxOyXNk28DtpX3xfeoLxJ/JBxXCKx33wsSIeQRkLjxHcnA7ZsM4v7aRDauBCFLisigLI7S/1Om6z5VyRY0IMZa77PjWvBoZ6GI9BBgqLEN6M2dIZr3GmLHJjbrsFCA0OQoI4xDtYv0QN8qNsNDO2zKZGP23g3blXVNfg3o7VzBTcRSAb1s5/P14sGu633GfBluC96niX69DUsl28Zq4m+Ma9kVc13sgrcQjdiCgQbXwvYwuadLSZfffp4jzHIuXsBJH0Wh5IS+7t3NW0pUuktSsLiswqxTk6oyciM2RextpRfxKZXWTRQ/S33cLgVpxBLeJgB8A+7TomptAZBMfbeBmCmN2AFmlt4BOnHhbihY7zn1TCQNOzYnzL6Q47YsC241fsPqEc9OvZ5aGqpbx/7KCNol96rl4CZrkhCR1BFT1RXLNmoIg41F+J3rwns2LTVS7iurWIyf5qyYY6HPSoGTe7SQrIEFFPI8CiehhKKeSeVlNErCp3zNliUmi0PItn9doZPauKdRvsUF4Ot08QclQSgKPkwlyas2JvBmt7Mkolcg3khPpcHqL1p0wTNLKB7MsBIvpTM4BY2A8PGHNbOBZs6glaM0HvebqIocWfgV6DJDNNQQBePqI9U3/mkck74syjPu3quccDj07ua8ZYoWiR+hRh/2OKahYeF7Nd0DlP36arJ3vvFKRibrNy9vlHfM4NY0pTu+BrKOTOudNjNOgbtYF9pMOq2XZaTkW03O48nSpWSp1Oy6nAVptsBdRT6MgArrG1v34TVo+aj795dMRsx+ewPR8dMdvqoyPMmHP+zf8FXUZWnkwAAQA='),c=>c.charCodeAt(0));
    const response=new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')));
    const template=await response.text();
    const safeJSON=v=>JSON.stringify(v).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
    const output=template.replace('__DATA__',()=>safeJSON(all)).replace('__META__',()=>safeJSON(meta));
    const name='DOAS_BOM_Dashboard_'+(meta.project||'Project').replace(/[^a-z0-9_-]/gi,'_')+'_v0.19.html';
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
