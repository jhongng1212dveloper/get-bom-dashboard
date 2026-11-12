/* DOAS BOM v0.16; dashboard HTML is injected by tools/build.py. */
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
    const meta={project:pn.length>1?pn[0]+'-'+pn[1]:'',line:pn[2]||'',assy:pn[4]||'',source:'DOAS live table (loaded DOM)',version:'0.16',generated:new Date().toISOString(),rows:keep.length,totalRows:all.length,excluded:['7000'],exclStats:{lines:excluded.length,std:excluded.filter(r=>r[7]==='S').length,fab:excluded.filter(r=>r[7]==='F').length,qty:excluded.reduce((a,r)=>a+r[5],0),po:excluded.filter(r=>r[6]==='PO issued').length}};
    const bytes=Uint8Array.from(atob('H4sIAAAAAAAC/81923bbSJLge30FjPK4yDYJ8SZKIk3V+lKurunypUvu7pnj42ODBEChRQIUAEpWs3hOP8377szZfZl93V/Yfd79k/qSjYi8IDORIClXzdntmbJAIDMyMzIybhkZ+eTBizfP3/3z2++cy2K5OP/qCf5xFn4yn7hh4uKL0A/gzzIsfGd26Wd5WEzcdRG1T13xOvGX4cS9icPbVZoVrjNLkyJMoNhtHBSXkyC8iWdhm360nDiJi9hftPOZvwgnXQRSxMUiPH/x5umF8+zNK+eXv/+b8zZLZ+ssXAIY56Lwi3XuvLkJM2zjyREr/9WTvLjDv47zu800/dzO47/FyXw0TbMgzNrwZgufcDytaRrcbZZ+No+TUWe88oMAC3bwO32Cv/Dkz67mWbpOgtHX0SA6jk7Gs3SRZqOvu53uae90TKUiGNuoO1h9Pup6x07bX60WYTu/y4tw2Xq2iJOrV/7sgn6+hJIt9yKcp6Hzpx/c1k/pNC3Slvv7cHETFvHMd16H69BtPc0AHa3cT/J2HmZxxNpp34bTq7hoY3vtfJmmxSX22U8QebGfhwGWwxF4yzRJN1Qu8pfx4m7kXrx0XsFLt7WO2/g1X/mzsPU8TfJ04ectl3WFl5EFCNht5q8AVZ/ZdMFIh53V57HAneOvi1QisNdbfXZ6Q/hnAAjZfgX1j37ntOX/HKSdMFPf/O4IGynS1SaI89XCvxtFi/Dz+K/rvIijuzannBH1pz0Ni9swTMYw4HnSjgGnORVv54WfFeO5vxr1yt7BjBdFuhx1T1c0894085NAbwerdPtQRQU5gxbDjKHSz642bOQDGNz4MoznlwV75nSV+UG8zkfdLr5SSKbbBSI5GWvNVVupjJS/xuKjJE3CMVHypR+kt4DuLiIY/svmU7/RHbZ6g9ag0/K6p03ZXSe/mfMu97pll+k5L7L0KgRyjqJxFC8WrAX2VkywdypeAPWGM0AQDUh9+dcU5p7e0orqMmKD5RaOumfeMTSEpdq85a7XO5YEM16EBYyvjROKJNOGj1CeANyy8sNTWohevp5u+IIbDk86p8djpZkeNcOhwgQ6HUfWcmS9/mDQOR7o0DusHDKqKi2cWkmBZqONK2GE/1TmjD6HDBte4c83GusAXDNSGeHswYqLA+frcBCehDODhrB1sZZwFRFNKYPu0qD52AYnx4PhiTa24+POuDKkYT11Q1cd70og6+zU7037OkCOLCjoLeKbcDSahlGahRsxctcdM7IZlpQ2rKyN484/6EujNz0Z+jpl4//1JWWftrqn/Va3MwTaPm7KPtz6WWIi1w+nojk+kCgMotMzgafp8QCIx0oDAuRvNKzo5KzTOSPI4efZol2k8/ki1DhxnFwCSy/GIMty6NwKFhLSVwGcKQcxmCajEqADQ89b6tDojQl/FIFkzNs3cR5PobV0XeDiozXBae2sPx1EwZh/aadRBDJ71ONcUQHlwScNveEsCqK+gV4fkDUbCvR2hifDwYkNksRqdeorY7hMQZhvgCUBNkbTDBGehHne8M6Qs1XkyNUqrgoReJnLFT3P4mCM/7SB6OFNEWL318skH2XhKvSLxrC1jBMQbI1OqxtlzSaTBb2q+BhwRAH8L13YBFasbJQ3TvcY/xng65TPfBZCN2GRjREX0QJWxWUcBGEiGrdRqazsT6H9dRECf40KYLMgUeFfPoQOp+a+LqJu/KzRbvstvvKboiHHW/hTlad3VL7DeXERfi7aRLfQp+VovVqF2QzUEJPBe52TcKmvvuNO2dKNv1BaqsiCk45FYgzLOcJhyjownhj0oXayXsIim40Kf7pe+Bn+zg2J1C17kKRFqA62Ww6Vc0SlrX5JC6xmKWss/Jj4TIV4Z34WVKkX3/425EWUdYr/DOuJGZtrozr2pXrXFOYacVq7bPpmS85lT8VzX1EjdawNO1Ui6gIR7VOluAA3WvVATy42dVKUTbGtijmzrAzMTaFPUw9sgxObUFbXjknT+vydnZ2pEwhTd2JVn1fxinBepZ7V1M/0mRSaKurDpBjXz1AezjdVLvSFiiswVa5JdnZIuRQntrhjIo6xfSHuhE5Av8UKUIw0wqUQpKL/oyjO8qI9u4wXsIp05DLl0DkrRzsCo8demIrRfx1R2AEiTKr0Y3C08e0lYIcINgStmtREg48zlilfhotFvMrjvByZg+vVRvmy3/VictAUhbwgXm44fkde71S+T5PN39pxEoBh0a/qXmhVIM9psZ8D/MnsXAWA3gE0HuijP0OKqZBgzRJFWjcUak3niMDUtrG+oB/25AebynyCPE+xTts9mnpiTqrpUK7+bjAIg1N9DKAWbrTlysWVUmAmOMPx9CSaVXRwszgRBWANTbqu8XG6hrWYbKqjnfZmMxytIRG0jhu4GCq46DEy1hbLeDcRd8wFa+0qJwGtX8fRWRRR6UU4DxUbe78Whv6DdhQXQhnrnUDPFYWMPAodvnQX882BMsCcb4EWJGtFKpKy1MYXBquqIrZORe/lvGs2xJxGfjTj3x0vSAtumJ+VZsVZxazo8/VRri+snCwNo/aLGU4JcqOigTw5+/Uo3QVmckGOZwbxVE4bCCjDyuQ+FVSAqZc0lSPiaAd0wiRk3gyyOA3/HWQl5UcVi3wF7VfXlmmwXoS5Ax1YVCUvvfWgDJ/ZbgeNQmkvLfxVHo7Ew5hKt4F+wRYDkfU5JJeBhOEUl5raLZBzkJp9ChpSvSWPSoeCaJwfRfBgU85pSYlCQ1D0Th9sQZuUMwfgZS3lZ+BlG3N+jRrBRvTjVPDv2l5wZQsoGv2lCw51CdS+CA2wmZelt5sqQzOLsGWL3dAox4+mbOWa5ZGMjMJMYtUXNpQTKXjjBOxwhzuvnK97x8N+OGXOqVkahPdy4cpXlVk3VO6q/03oRatFXFQ9YoMaj5hVlOxatKyRqR/MQ5PIzS6rmrDF7XLP1rxcn60w6pWCdNDvn858tXRkWmEnYSBKz3qDbmcmSmcWXzLhopa1IzJNJm0xJkodeihEHzbnxLLB6SKdXYl2kOcwsonmQGSr3D6Lus7F6QyKVy39vfZNdULMKbMzCtZgaVnZpQiVXGXpYdIetL7dDlmEBEpdBoPaKGKHI+/YKn8tGDDnTRfRrBH0qW+UWdHgdI7PhsOzamNK/dVsc/+FNd7p7Baun1OLpLVJOz9ZR6DzrTNgios4L6q25hJf05YQH2n/rKfSNSkSQgVHhQsVLKej2zmMGpBFH6Arao46p48wT/AfadwSF7HQh2jymJnUBu5PqnrfHi1vKQVGnZ63ZFy/Rj7QZ9JCKlsZph//y+1JjRzUTu1Tf/jK433cGCr0fjqsKHL7VzlraxnsdsDdX0O0UHZxmzqMoCzOt3SR348QveNjpEWNMhkpDqxON406abtyKxrmvj+9jk0TLe5WoUNiujoCeq0up1Ikdeq9gDloI9wutfkamc5n+Bo7KrfH0qUfCaBJ61mVJ1/uK0ZtoOqpYw3dqI7j7iGO44HuOO7fQ5HABpcHu4m7HCPBOrV65dhmcUWImgu8xm93XELfqxJc3dzHwVtjNTP+XdXKAz+/DCWh8PYszrWSpqmEsufINhPk+5uNaVB+0UpP0wWqS5YwA/pQXSNnB2371rpP/Wx2afGg8oVVanM9Hp0ggin6g44Gw4mT1bqoWpK2DQDrTkGtV4z7lJ1+d4dPqKc6xjnTFtuJFCigSEe5E6n2nG1FbvTtQr77WL/Z2z9pnZ21ev3jltdtqjAxkKFmg4vZxrj5A0gqOQs9Icf+50YbvjS58kOGj1gZfSUOQhjK9lCIHosaKWzuuXtPg7afb8W+RQnQtW5DVxFUHCe0t7VLRzYcWFKfgbHVqjPGrm/QCY6DQNSyqzhGFe7CrPpaIzI77tn/+/iId3lJ9c2WPrNXiBpLW3SHj7QcgOG77ag9JGSv/AyGYHTGmESluYEZN6NozEi00qc/rPSBT6Io0bUwRezYKq/wRCj0FpSR3Pnu8wq6CeNwknAN3V84l9ALkhMZMHQnX2dgF4S5A1LVyVkEHo0sx1+gJAOn8ChSzXmROklaYHBgMg+d4jJ0Vkr0ntzESjMBZ+WTqPZYl74OeVee05Yon2OcC+kb70+D2ZnOUnrMg2VGRnVY9IgGUwoCdXFLoj2ZdWdBVYk2IGgM24iPCKenM1aHI92bZyv7QHowEH9c2bAyRU13n9+AFoMRJ9a3YGPYNPtl2QTesW+jiiZ1PQZRJxqUm3V8QMSqB+VweeiA5u/r83mjxWdZHJJVmt7L3aZaZYgWPhcehz5TW9TSXroKTaI4Dc7O/NMqwR1bUHzatEJUkK31oRsOw0BFWLuy66zCgn8wulaacae9Xr9jar6WShju1tLfzS7DG8sWN4NvbshX1IQvt09L/ad3KvQf0y14Vt01P+7YzYVa40LdCqvxImouHO4sNJ27de5C7i30p4f5C2kGbKF2pTlhQelh5skclVq+NNUAWGVfRxupOvOiKzLeVFlXEquwrE5zLSKAtStpmyCWk5ClwNjDxlknCOdV/rvJZ1m6WLQVg+mEEwKIo3eXKBpi+AIySAoLlDBcTDggVp11wsRL4DnP0yWgrHDYrnTupMnizvGBDPyMySM/wvCCwgr30gf5Rd0BQwZ4XQzaO9SeAtlSDRHELmQTWE+zq7u3vHqpntJmDo+64iFY5KqAv2LTfXDWqTBtFmhet90BcqQ3MyKAByJ4zAwB7jcZNFXvR98ERgG1Zv5i1mgA3765ddpOd9ABlts86jWb1XhRIkWLCCDgdlW720VdmyIQ4wUqIJwBcD7eDm8ARL6TvIZ5q6xPv7dVdHsiyNHajY7WBV7U7AOuBgtkEOj0uw2ayl/DGfNhICulIKojDGF2ROR+NUDfsnAN15dcXWKDNKv6AdgbRZeVGnddZ+ncg+mUMJlmfecU5YYBZAcrQsv+wbGdJgRzb39mbEb+liTAzkiYhnBH07/7TJKO2ToEXsZL4QkHS++E3k1TNDzukFm1b4rKGbDgQ12FypY/V2d6ckpUrV61606rqguBVCTdcceiwtXvz9uH/B4FAZBomOdhMHGLbB26HwxVhWsEwm7vKZunppIow35Ynfp29ZCiwXF9yR0RSiy+tI6UZwtg13xKO2xKD5pNS+AMY5rmER6admOrpLodsHtWcQD/aRkGsd8op/YE9+iam4pkUCCdrWQo/nb3WhYLj0S1sOL+EIYrEkYzkHQgAkNhNyH9OJzRjRwgizADseU70LFQsdHWy4RbZk8LJ/Ez9LlP4R8o7tAY8haXgdBKLCIdMh+aRLHpJ84MKHMFo3FI6cm5MCSNls5Lqd0WWOV+UGNa9nIMQ7GoNEFuznKvPdbcZSWH6fY7SiTB/SIx4kKNShgIx02tmA6GwSw8Nn05RpACoENvIVMcpRRRUPWVCn29rISowKpJcclqNlCuNSvhC3JDqh6ENe4BDLledGJ01FuC5lZpgu2KqjtsXe72rlQlM7viWFFFQFcYAlDLW66SXxP7YIny5WL4FlDcnmahfzWif9v4wogMZ9yN+hHkMyPmyigqS+ZgdSximL3/tz23nt0x+ud4KybEjY0DdQPfXjEAAyZe5BtLOLxZNF8vodSdzs9BRA928PRdbrLagQADzHxtqZJIE+WLSzMerB+djPfp2xWX7T2Du01PRU0sBPXPuy7umFfAFiYFzP9lDCwdpjwgpsw3IsckDqI1cGzVtcZZPvzy4yR3BsgCSRgIho0ohAY3Xxpyp2zMGPRZO0SQb4uN/jlb+ouS8dP+ip/c3YK0Cfmg+QlfJm1gPKBh0Ih/F34GS+93pfmmOiJbMNTiEsQfOvGTOZN4iCN+eIpN+1GQFg6xPl96OpnAKylFoGuF4Rz3dFMrR2VRIu0lFtVLccpPd1a9FcxpfTAay/O5PLpMgKMT0iMid/GKdxZpnf8ndodx+E7M5etpuYVSBgoqi8c0R4dNy2k53Q2xXC+Kis9HP2VkkTjViCqVddlQrHpDjquSWWzWhssVLA0plQbCKaksFj7XtV6cngxGJWDO1GCytYykX/H59vkJEC9K00LluV1lV4m9GJTkYihdfJdqp9dJFyInTPxho471+K0RwEEFf0W04pdPsOVomvBiSjXdUfT0bveUFHXiC+yw4M7I9L5xPnDLKlKoiL0iFNvyM/jV5rmZwIDQoXo5qiE/Cuj0uRZ0UP969v7hUXratw7iLJyRn4VVZF3jJsUrCmoGxpdfOSsf7EQnv0xvE8VV9oqHPXNRzg2EHLd5nDQivxg3Kt6gapBfQcMtBzgR1Me4gGmK+yQY2ZKDHXwFMixNl04EfDguxk4KOgKwrwUUBsBhmOQMFm0WQX8cMEPA7kCvYQxW5+LOQXMgDIhzw3oSrJ5bMzkaPMDFhZeOxWy/BUCtr+nUPz6azjrplxtylx2p7biChux4v8weMBbH6ZEYqaOag8SK7vH+s3x+OD2bndi8D9zeUGx1Eg2n1pP/tZ65f2qQ26+NgshpOz3ofbMptxE7BzrsSug2p3CrPMl1arjwTnPh0b1NnTxc+WBRstkFMoKBgWEA8B1EPRib8QJ3HmOyOdNpjjpNTuSgb09WZ3jDJ4rGCkLGeYw8gjkbyrnHabWUQGPIwy61UcXij2R5qjRkKUiQeUmlFdskdEqcd+/hofRYB9rU6EGbdLtje4SCojmJz5TgkB0Gbic4CXvWTjlT80ynUAxPev3+wF6HIXK2SPPQElox68784Nh01VTjE2q8dkp3Tio76nwhnyh5MU6sbh5l+i9oq1dhJOyFIdq5xiW2MklOsdaI7MQaRCEgmqZgHGUUFt6w20MlD3gh56o3rYzx/BjnhTIa/LkpIw1OOTEojhnpqOH7NtPw0r+JAV9IaGBpqIFOfGgdS5vcRWg0Lby5v464FY2be15pNrpa4PExR5nSz96JLVlJZTpUx291SkxXoyX4g1OxaRna9rvJo33f+dTcr3YM2wJ9utFx5FcDffhit7dhdULbm6zxV6v+Jl/dXe2eDEJ/aPTntO+fhIP6/hB/QRt1WjdytYSysYM4rmqk+xpCYsl3tUMFdm3KDMuYVq5Y263ne6B/b9f21dpoM2BrnfFs1AjMFsovukp7UnvsVk0hoRpWFWmB1gXMmRnKWDUADE+Y0ZAqKQwLiVH7uD78TR4M55sSwsmp4OelP1VwAr90f7ihdioJOtAkllrocadOFpyFIA1CLaimM649t15hR1/3jvvHA2kFoi4q56knRb+ia5JDljaGOp1OX0lzJpfNjq3QDMYKhilgJxxJQztbWESsoVIBsopGqYA1TQzX1Sg1saZjnwW5ZaBDJJ1wwOKk9YrMBtBDnPrD4+7wVN0BKvcauh2YrSbFKKgG51mnNPnMrse5MtaWNggyMVv3raVFWNy7tuZlIArr9XvCGCUvZMHcjcynqDgd29wFt/CnqNdPQ2aLgeLOkM3MOb9wXv7+BVfe79Uzuc2j4LvTkYbyF0BCb6GygdJtih0ktNAfxEsM9/CT4reC3xfwe/3j/wj4AwH/P6b7xwI8zbwO37ofCquhJPsaS5wo7ESEcJ8o1nZHqs0w3w1CWUso0BS70h+iFWv4WVYZ5njRGqtjzzs4tTI4sfX6cpH6yM+cBDTeuY9sfOwkqYxtTaUr+sgeyzpP36Ur0/PAQj0oOAfU7VaY3DRyPwrboDL6bToVzKJBmk2BF0qN0Kkpy8o0uSNACJQeej7lmjke6Irvcc/mxP26N+wPB+YZRTLrqlKFFVWkiiYjMCBjh5zg1GkGNlk8HL1B09STKwfGD/XJHJ7GRhy9Icj3dZlYw5Mw4qriTNG8J4ZnxeJMYeSkZHjsKpkk6Nk8yjAC1KEh8hynyTje4PXvmemRNS+jsO7r1RjXhG2VoC02Ck+jaQS50Eul3hfmwOP7lzoXYUu2ljE8OeJpZp8c8VS4yGThTxDfODEo13qAh+uAzRxO3Cycw4S7DiniJCwn7gWVtG3h8VhGF5PZPsEERCpkFqLmOjMwXHLxVkSu6S3wsg4zftxz6DwAK6HqICgGxT1/W+mPUk0fpQj/0Vt9yRI6TW1Dwz4ADILFzSa9ExQJ5CptPGcv8PTjxGVV3HN6+eSI/cS5IJhPfNI+sG7J//W+mZ5vV46Kd8P0VkGHp+fliNhnaPmc1rIYg9Y7Aap0c7lGn56zl4TwifucR6WoKpPeayovPjPicM//z3+TCChxSicSeHfYIQWz7Qv+Fsh7Fl6mC1hXOGWgvLIyv/z9fxhkys468NYZKeWuRg26sShonmJPjIFcpuVIVFqomQFmAZpD+H24WAENMFi+6BlIY55KzPAZC+o4IvLAFWubNL0JUA70nr9BX68+A2L+TOpwz8XuyS//9X8pRFpSp9RBDOJUT99/OYkqUL6MUGX36uhU7WcttaqFvohmDY+rlWSVRmoJVylj0K3myTiAbBVI9yRe2ZJJu9qU/3oKVrVbGwFbJsVCxto4nyFIk5aVIaPDCtBqIAJUe5eTnvKWusffG4jzsyv5AeXTzZx2GZ+lnycuhaoO4P8B6yu/uHRgpK+6PafnnTq9rnPiDW7OvN6P+Ab1zr7THXrDP8Prv7lHSo0+llycOQNv6Jy14V+E0e1hXSx3BG3KronJFf1UunbZPce89Dtz0kOZssJKyrj1lOQrCeUnU8Zz8DdS0/Tc+d//0/kR41rEJ/xRfnqa53fyE/7gnx4l03w1/pn9UfSF5U/pbS6FPuXSJ28fwlJK/bG4KwutZiDtVxYsqI/qtIWFb51PTC6NOaPd84sEmMZlWugo3cWPsC4mZnaUHMGMvPHFO3/OKVt3aAo6fkflndvLkHYTOc8Gw6SD28pxMlusgzCAB22jejFbL8jAA4x995nKUJ2R8+Z1SffWcXLZ8WeNKdjKnWtaF5D7RbrOZqHAvTInF9lMzsn9QH4fJiHutAYWqC/gvQ1sycnYg7GUMRiBjZGezu2lcK+flRI2MbqiLDxAJlot6eayZ9E6pW0Nq6kni6rDxTytqAuCmkhxX/5c1QJYMAHyUUpk88u//Gupx9bSM2ZS5aPAp/OaYjItIivLfj7Dn2QdTFzVfqiFwtIlMhD8+XzPXJRY5onp7oVkoZdoWKSkthLmc/pVEslO1H+PohLWklR9uHqIHGbGpwUDNGBSaA7iIqcp4ceR6+aDBeSVErUcAxiAVFVhrvBKIJ2H2oCpDQOovMewDtv7bmeAH3ZA7J51RFVb/W5Hqf/kyOzjk4IZihJ+kZU/6DOflydH8Ag/xciB/FAA5OL9+UUROEcOSHZ6Y8DgImgZf1bKg7RFQiCca3qQpa23b4A/5mvkHCp0+JWVg9PG8oRFk3PKeQbPSDgFM4h5eZzKHeScLvIa6rVKlSpZM8IWI+UL3tBh6uk9mtfTu5XiX4UZMJmr8M6ZOKq6/va1SswW/UGS84JUTd466Z3n+8XsvRGCCqSSMWjvuF6EGXCwwImydGnq95lwIBw4RJGMSO2S+nmaqsvNkGmunEsNvlnuRrgIgteG0K0gXJZ8VSlp/rxHL2EVZvGMNIZDOhr50wM7CiX3dLQW8cE6ZTDwwaI34CekiQvTFbNXBSjFjrrPdLhwp1UpqtYux/DzfaQPr3IxS1cgYp8uFjJXK0ifuSKZNHt4rwbAk0NYVxu3Tg8xU2ZxNkMhBq+7XdBs79hfMFxPNJukB1U6i3bfO8b/TDNkh3V8bdjD3NplyzX1WhiVOcviFVIoJtswTWU7Nek+uWkhHCPI9p7Br/OKLlxTAyYbljFV+Y4eHX+xqFSWuimlM8kr6pN2jY2ej0n1ZlYnE2EyJWOvSoVmumtURTvjNVjvskO1t85o+WnZzTPVfB5yw73Dc15YkknJMO1+/6RjHu4Z6ot1ev571KrwtB78P6d1j4zB78AEvSM7j4Jo8zyeY+AsaGCofEFNTVGjKo08nJPePcDQXqE28xItJ/TmHipFQXg+7HY6qODAY9NzfkjIoSUccC2WCaaUwhjiKdYhII6p5HFGnTB8VLR5nhKtApnAmkV6CzBOGAqbcnZ6Pnaikv0qrV2Fq6KMNT0cpvPYeVGuFmzBc5ikjwlnb16+RE4ShJG/XhTsOyUq4NA5etpDMBjbHEGOwCpO0jwBxhegTZrQMU4wX5O5imY8g5lyMO/anU73pHPS7nTbiHEGtgcvPz4VwHFsNaWNghnbjs/9JYymCJfek2kmyeiCH6gih5PzOvWgFxnueDJi+gFMcKInTSPAtlX80xy3nCosJMDFrX+XE1TULjATMmJS0iEjQJXE+p0zQWIt7DlNF2EKXzJioTD1nchXQb424GUh7hSlCc4hdpG6nbOY8jSjvxjmLhJK4HDpGxGQ8+Y1FgKK0BAp9S2GuFL9ggYCVbfSCW+EYe60U1YO5F0b2LMYB7enlqGf5BrSG0DTuFxvL2Pg+jjLusZL1d/+8E/f/ViO3k/u6NpAJ1zkjD04qzUIDbw+UF+8ntZPutGRrTB27ijGCg3WxsUPr3//5vX3osO//Mt/ceQHR/nS9HQWi2wXXSaCw6rpQEpuOO1gNqUqDxesvN4TSvt4ugv0+xT5IHomha+ofMM2xezSnAFhO77c2aT7Ibtnfz5+dex0e4uT9okD/6fKcRJy59AZIa8UNyrjOedfzdIEFsbTH3/8+NObv1yAbfHx44un755+/Ogt/VXDdyZA0Zvl6KJAvtHw33c+ND14XjZgVlfJyH/f/QACH/724O8ygoc+PtCnATxdw99j+JvD3yH8LeDvyYctBg1gQq+QObzIRzZxcIDsPe/M+w/s58W7p+/+xF7Acn8OD5tty3nx9Kc/vPund/SLlXv15sWffvxOFHz18nvx+O4NFutA5Xcv2MPLp8/Yw5RvJnKgq/Q1vh9zzLz67t1Twgo+fPw4/oq//8PrN3/Bgu8xXuPIeYOCl3n5ojDLxJpD/ocnZgF3Y+5cQnKe5sieZYnAL3yi8SBLVyiz/MLJQB2NlyGS7uZq5KpOKrzckxKd3WBEQxwGbkvobLOR+/VsGhyHXXiXXwLvG7k/YvF1ohSGxXY16m5bAnaYYAfpjMxPL/9YQtP+h6DPBn5/elqCFjVFLQLckYCf3voUlOdcrzEvD25Dt+yA/ZPTaeSXgLWaodsyAP9RwAOOOguRxdUB7p9OQTMqAWPNUKlloEIDnCYgNZbi5/U6zng7CDianvX6MwtgqOVVcSwH9GaFTlL09iKj8+co1VarLL3xF1CLIA9OetNhCfnNCorOWbFdkF+9UCFZcBFNpxHwlCqSX70oZ08BTMCAGtuOf+PHC3KNAc96yxk3a4SQPAj6Z2cKYF5TdMOkN+HuqaG0sscsc7lCb0ZNgyxehEnMLC8+olrAYTSA/5WAWc2yjgH4LQruFFgEEHruzPxkFmLeJqMNWiEzv+9HJWCooJXngL/6IBlJtCyAjSTIaF+TyG0kwGHTH1O8lpizXTdM2n+6cJuCKa1mWKeRADttYsXC+RZ+OUfw8DsHNLGmMyo5GKiXUDjHchxc3vSykEy4xtH7R0/O3Q9Hc6A9xuvdR+7IfeQvV2O35T7B50WBj+f4OMfHb9xv4BFX5tjdvp99QF4OLFDVKbmqGTqwbEC9IO2zUNVWpjOpmirnfbzTV+Hd29fVbhfpnzDN2nMgv4YyCAYNB+G2EUtf4VFuqRS+FqqlohYy1YupV7HQNfW9T6ZdourQkBqKoYC2KqqbqgodMUXzSA+tYdrIS9RmipHzToTPUNRTm8mv9nsaz4e3T3969/Gn7/6MFd5mcZphnBOXcU5jjscXQQpjKdA7MIdYhONt3AGxpbfwRaibLRZC+/Y1Na2ZD9iQnIUgBeGEgqXAc5Mr5JIAdhayY+vYDkUXshkSGRFob74AFAARh7eguBcLT7xDwgWi38iD/SDfYWmEFIV2g6Nx8To/dwtzFq0TCpmTgN++fhmHiyBvrHAAPiZoml0xf/XEdZsOBnryrkw4hawS59tvHfjIVRSdXsayws0kZ4nLG4xexPs4/4FrxJMb0HQmk4n7znUePXJuvEWYzIvL88lxWZpN76SsBKvwBtQfWHy8P3qv9b6VcMiKNMB4+SIGyh7gSn6ff8DCceQ0qCjvGU4ddY5eig52m/x3fhlHhdoMqKbsC8bWmQMPPk/iwMPEMD9gEOebqOF+VAugIg0lPj/pQO/iAHoFxVkfOy14rxQFqpMlXVctCW8fd6lkFsIKSZwNt98RegvqtZBORzkoc9uSHjgruZBk0fBb0xar+RQogT8+M4ji86RCSL6o1WzdVb8KmM/UHppU7vHeND7z8yKtO/7QJCPj55931KBh3tGfA0ojPu7w3wPKIt6gMP5p7kIe7ssj+hii+BgtCPZgzU3xH99bwsNSdKEeHz5mz8Giq+SQwgEUDairgp1g4kZUwfmyGiU4JLAo5vyJcVH+43oE887M4hEsshy4CnP7hcEIudBFWKCBQuSk/M7jOVR0tkxCVO+Hf4yuQm1L3mkAI18n6LtRt/NZZEDTyGrMRvLn737CLRowFzw8uoizALhwu17HHX8VgBqPvNabh8V3C9Lnn939EDT4Fjkwh/Bz8ZyFBHOOih8aBG4udtgrCkJzF2QK8zAhE0Aue3ZU1iM/TSD3aVOyvfpKFHRi7Shd+LqjJsWkWGv68GVXTYx3sFbMKUJiV1X0IZhVcdflMZIAkJhchFkYZWF+CRPpN9jK4+atav1+K41wj2kKjQx1n8xbOg8mABgLuSgORLGS43IwAUCshTEpYZQVuQtjx0SKsBeqxJPy6SPWx+CaESwoAMyXL1+6Crg8LJ4WQBzwM2y4angNLHFO30ojTbUr5EjHrUyPrciGm0aofT9QK6hdR+dLtdMXl+mtHq6TECeoCdNRh6TWIoN+Rz3sSD05UcxUcyd2Pz3cgLnQoAlm8r65RVccey3nXnz6BB21fdjdD4zKMrshWwUTeA2SHGRIRpaH/zjzrlsOnxUJVOD504s3Ty8o/uuXv/+bJW7t4caYCYem2iN8NgnRzN/IN9ia7ta5ebiB9bX9VJIxuW4owGwklgIfKoqNoHwpFsXkPPMK1KHAphIl2WlDf7qj9MuytHMNyqssqWJlcs5w0mkykKvUDjFHiKVBKyBvy2HRNd971iZtFTWFeqhSvcMOQiEQjxydHt/amrh0LtEdl9/jBATL79+9+hGnDPcoFKKWnSf3MqO0nBhyDsTHwvoa4jVgG14Kc6kliwNe4b1iOYEwBssQTJbiThYClDa3ZZ1VClUkgjznk/OYb959ehnPKU0HP2OyuAOMoYlyv+XhLFIfuaYMT/QcFtEFGLAE4p2L7MypCOVDk3bpESFumWf7Hjhn38vdvYn7dTiLgqjvjrUCtKVHp2ighD8No9lQLzHj3zrDk+HgRG1CX8OfcKP6UFSU0YoNhcON7PPfFIir8PkSZZyMCGWOP/fjhCPOSrp1GGIboO64FkFsI1QrIPDDtjfdMR2x474XSt0/cd57nifURMIL+r656MybTTK/pAuaPL9iKX/GQgTG4xjLQR2/ajZF0qYE6L3BCvAqV1jlAYOSp8uQwYBKJKOhKrV+xbwxVy3VpcucSlfCa9lkXJf7w8e8i16UZt/5s0sG9+L5ewD9YQLWBxXWfOaVGpNz/l1UwpZUheEOWAPXS19BL+kT0zc4CMIaWwbokE8nVAV5VwPUEH4QDSf8QQrznE42yxG8byWjTiuH/yL47xqfi9Fm21pG8O92zEDkDEQrbY7ZGdPUSx4/Hqfe9eMJMFx4yIv3MF8fJg35+PPPnebjrmi0UXL9DRShyssICi4jqiSeea0tLenUi6AgUip1nu8wTJBkWL9u/MUaZr35wUM3U4PMKxAC3tJbkIr+nBs9aEbpqIzmEwsibTJKYndybuA2mgvcRhK5iFtCbYS4jRhyGULTIC8NIsIsAOCYjaqorcVoilZv7vlBIKeV4+fl9xI5ANqOnKmXtH0voQrv3rybKLxofPHuxaQeEbzQy6fPJlCxDYVJu+NbOBOgaZ0aoS3+jQ9E+8kGQ91Ypa8n8psil7GM4tvA07cTTgO8M0wv4+/edz54yy1oO//qlO/08u0uFkHdzAWlyC2B/+HtD3xDyQF1BjQRV7JjtwWIHCHrhVE3W8jdRiioFYFn10GaW5Jcq1kOTLjwF6i3fGr5wFPYrb/utqW0x6N0WWt6r3mbXBgQHhzqAD1SKwzuyazvA940uHqQZDkYmD5tMEg8Qg+ifmuRoxhd9XCzmlG9FiICtP6XeLAZz3L+A0p6QhbrB7sxQ+/HSzN2o+wKUJToitwVh/ZoH7tsGErtbZjdvaE3rGxciAaB4LSxI3h4p4PvAnhCBDSBarDSDN8b0Zp5hkqG2khJ7vrmCKN85WvdDgcV5Jos0ypGQOw7oG6dgL0inB3WwLb8zcbGt2eQF33YaazQsYCmpr/CKmICdHL+qRJiB+Xltn+77Y8ebq48f+uea7Hx/tQ9xw/wsK0J1cM9NioDD7yM+hnxxL7jkyhA/35qcv+ru9sMo/hSzQybiBWzr94ro96nmkWDxMWmSV13+pr7tLMxii2tdhLX0r56NZ2sLDDRSbkoaUXu7hYGoSpEMfn0JLZF0zEOwZKIPdwAeraYsVZGaAimhUovfsRQkPjcDir0j087MwEKBqGDUvgOQsPvDNrucSgRs+pwytfvcE+2sQfXPNrFQPcL6aLg9jSjhF9lP6HbJMegWITF/GdIXKU3DY32rel7BWsRmZZTvTmz3BLCIs/8rJEXLSbHWs6ltgMUztEJINRZRTcHtQVVWaZU4xtay3aKeLgBLXkrZpHX1Gfy4SbMZ6Thb3EmZZkGI1/+u0V91Im4yWdcX//cBf9JDwBXjvPwQMyHm8stnvWAJmGonKPYsCkzVNegEuxlMJdEkgDujqwlHjqKpPNXjmOBTq7rc48FfJcsHxGBnu9Oy1nBe0RPQoE4XE8VM7fAbV70/nt8oxTNIKislgripVnq0SPnAVZGpxF8Jl+Rq9bB4zITR7VnsOzX/agX4MYZFEdzkleR82CkBgjnDzcAfYt4Z21hlBc2tXUpbqedFxpVyInjVJQg/QxO9XskOaGxSLOHmANtW0dhieJjWZkEpQYzn2NZGb7O47yYia2S3K7Z5ifBfu18GxhVRescl0x1qg9DbBVBrjVGP0gLt3Z168HbRs1kiStMgt9V0tXwrX5auVyb49RuKHNm5Lh1iriJ6Ge7/H/l2T/pAFSR26yfKrWYOmfQoO63wh0NJGS3/K77CtWB49kU4rws6vuXv/87w6XWqe0vf//vO/A6Y3hlUgewty0PDh+GVDPBCOY2zCqTzlc50dlf18vVxO2657QLgFEq5alN+4kDqkbpQgAhVFXPClL1CFoRSyc07YhlnGzLYgsvMICaL5ir8I7FBdOFBCy2mt+G6ufGVXOWu0+93aqjllnlHmxgojEBbjErHD6cFWEwUekAFr7B4qP55At5tR6Ba+cd+qlt4ubUqa08+q1zpkePHogi2BMpYLYup4UqM0IOLbh1s54BSa4fzbcltyHPHsAgUzAh43cHE987iSx1TROpDVVEdNk9UIfHVA/UBF7JxCONZvn2mUjmwF6uV4DV8ELLL9Ro2nQ5StSLoVZLI93Nbn1E7YWi1l1P6repzLQyTeZrKiN/fsSU8GbkDwt8yqULh6uK6eQ89ZZ6pdKhe6367RjX5cTMeqF8XCzoIJnm0SoDhvxihlHwTxcL08XV4NOzjOY//4y+OFgg8k3z0aOGNn1YJJclOGdtVtqD3vxI8ecNBbhW51u+o6j0DIjwiGv8YjTN7aeR9hubQA/kZbFcTHatQ8pGAkiauNUlyBE5mWBIhxDlTJVRjtTZJKzMHovrRwzSrvtgDx9P+KwT90qFC1WZkzCvuhyX0DOgCdQzd0+OWuLA6ZGsEY2lYPLgQUOvXgLXFVqkLFan3AzmA1CmLfWScu835W7Wg9hmOV2ML8H4bcxTzhx8Nxki3zpU6o/UbpXGIvBbORKx6VeORRCkk1IqDR47+YnzYKuoL3MtC7ZKze8lIELrAZoz96xzUuJGMCewb7RMDiItsXv+Oi1HIgkatb5vdu/B61mtVOMf2zuwLiX80c3+WjojhIKgo/Wdj2rwjxHG5EVmyMPZoKwxhMKcxT+UTgGxKygTY4xFagbc/sPXpEN5rh6xRgmKGBm9BIAkFJaqVEhgQJPlzz8j30BUqKxY48vIW/Cmwm8dLOqMqCYTchSQw7TVP8fhbf4XFr/7j6ALMnEBetdbcbEhv6NQJNOkgxKzdDmNE3Z6CRWzx3qKLjzIxijmNk6C9JbN4F8wbcOTSZdCtPOwKMUe5khqUCQbiVVdqpYkZE3TtVu0KqL8MMlqJr86TLASXeSTHRuDk3NWptxuavAXcgOL78dY5DXuKLHSxk7S++6HNh5C2hEeiYeWWlM8ucR3ZTmbb7zH02UfAAr+/QLhH83vJ9tptkmClAKExY7+VgKet3APGa8HDI3MV/eT9EQ6XyLr9QQhv7HEZ/PcSnCmDxP9KOCxjib862fvN9QArDN4P/nNJ4GJQBzFThGOBexGDasqpPevl92je0hu1vZeStivCymaUNL8UiF/DxmvE/J+Sa/nAbyXoNcT++lyvp6Y/n8T9CSeSjkfVQV9VJH00bzkwL9Gxu+RzlJyGsIZ+eFU/QZLir6qh1jM6pTrHIdm1nzwAD/x7uDjo0dfoDIodEKp16uBsWXKdXFiAoH8hNnZHz0yOtU8jPAw02PTFr8rYvHdFo/fNeETHg9eFH4QfIfZnPEnhsA3XCIvtxUyhq4GM09AkPsZQPQorWheNDiLfG9wyA9yubPvTRs9imvIoSoMkzLYUwHs/65Q9qoOVR0DpVdxW4aWdhBUlh11B2IaIOpqKPigBtjM3g88Hu5C6LQ+DAoT60P/VL92DCpnFwXgVFcqH758qlRev8j3Lyd5mYFlNZmdbB5osB2+niot6Kd+mL+uxqlGFzLsc6yx7H5N/PoMnZfQKPB4KPRTOCtAPWbpY550OOIJ5oPJxECF2IIwqYGK8+T5h+CZyuNSQZisHp65l/c/ltc34ozkPE0Hj2YaQ/PTGCwzdvYesJOkUyDWHC84xrsbCV6V6DI2mRVqOidePBa1dALaX2m7i/NVDP/fmvVBAzWMz7C4LZwPSuzjexav7B7GVyL9MLiHsj6rnDysicOYn9GA4H585qu1mRPBbZlrs7VZYa6km5BOx253gQB9Jv5byHqwYVNY4T21usOmhsxLlufs4odbuQ2g7xhsq/03vRc8N9oBGwD5vngEmSa0cmRLC1bcx28pYaS+vyUAkIvY3OBawRuHQmDVyFBl41T4QDDQ4c0Uz8p50F4Ww4gwrLgpfRbOlI7NoNsC8yrAn6Y8Ruv0m9w64mbrVcu5+UDl9Y3WJaYsE6bSldg1uuG7RmTiGGEmivVYZDLzZnorNr247wq349HnbduOr7iFy1ycgWGi4QFXqw/2qFAyeAZKBtAnUxk2se9CeAScemKLTAN4bmz9LuLCSFOc083uDgeSWy1MXiZiZaKy87YxnBMGWXASEkgLQ6dbzhmO2eibmnAxmrOsc1AdiQYI6RvbDP/y93/jzX4jgwjroa6ydK6HMhYZdE1/hfe0uHoaWRF7Sn3XQ1tF+iP+rxbmMHPPd9TUcj2Xvaacrjaz++DdyMqeox4jvJvLRPO9HEYkZq1wmDJGsnafdBdU08AXICXDqUarLtUVGs3F8ozs6zNSlmdUiZdhL+kYHls/3LTfEwfDqu0LhGHrUS1jXxYn/LJw0/8TMCB0pABF3BaFhiVURiWZCh2UOWfriKASOKlqxeltXkbfF2XMOuZyCYuRYzlVW7BTtRduU0RhF1qM+f6qL92mDHLmHBo7QkQxN6VQXvBTO3RiQz9xw09nYFYY8YjSqek8drraJmKAV1+zUhVZhqXpw97UP7x8faTX1U01QfzDzdwrGAnKlp0jnrRIpo3Xat0IHoPdbvGBc6+cLQTIHlJFBwf3du+iANaIIayYs+eozFlV2y81fN5IoVWJr7ekwqqUsWS12l3GmqCKqmwrqfb3jd6WRqp25JZxqdmnKKb/3j34UxJfr8MyG6A4ePhY3/Z67Lx93aztmXaKz3qCiI72Tc7/8eLNa2BMaE3H0V0DD3610POvp4zBV6tEf/eh2WwyLvWlQ9SyKcpRUjJQTJ3rfenwXu4dnjkWeBccNLpP1V1JmVS5htvyS9H0bUcZxXtdu5/I2UmFaW7k0UFNZ330SOZI0DdlOBzuXTLqgjRlFSO1JkZz7KpWhh4Dh1UqioBLe91rilVuZN4qgRl2HcwQAXhXnpfaF7QX6jcjLY3wNyx7IjuIt1XST0zX8SKgCxPyBkoXdUKAXMzjnCSALMc5WYX5FZRX5BfqIh8/vnz67ONH1Eew98oZTwDvgcBozK+g4/gD937nYNdsrsK7ET7gTs/IgCcTISkLRQBvkRTHGi3q6QizO7KLFeUotprEAzlKTc+paf5p7tEwV+scxli6lF5jIjCebtUHgz3Phfk64qGXizxFfOO+hn6lEXB+ybqoP57Sh9jAGteCvnV+xTrlMEbOr2FlylzNPdZtnK8Y50u8wDmLcc7YUV3M7UmwWKJveA4wIQ+G+SdsOthZUycZdfSZiFGBEVDnBFV0oPCunceIousx/kjYkVv6oKg2yi+p3SgjgM/QhXK14IqDcfDXbK7xVXlala8cjC5AEqmeVuX2uu+RdomzN2WP38IDkRA/BAqakvZ75DSUSoyw21143W0ay3MFakdDW5QUIYoxt8/fs5HKE+DakRHNGlPNOi3mlIBtewP9JkvxXkajslh8/TwfxeBOB71+95TF4HZPe71+R27j1hyiYZDZcRceAS4Vkk/62JkVJTLu2RRyKUXKqAeWXR3j2U3GpsTO5zGu+/eqSGiVbL6lMW7x61qWQAbwgeuPPyvh9QBU4frxXLrVxAuUb/F8rLwUvnvOZlF685Wr9k1m3f+WD680AeYecJ6mLDASBbhs5GVKUkMlR7qUek0rIO7S22WyiisRTDv408ONQufcjFSTsdABMJa6tyqum+w7W4zc50piTytk1ESxrFTToyOrxx4qRZUwirL0tVbwE51W4F/wjMKn3Qa9uP3BxE6DwWTIEXvt4lTEiI2USjDawnMNLpsS+HjYTRJozzhU84Jym49E5BkmwJbpyumXSADp7j73I+9YaLINmNcY+gKURFcqPJbTQFJRdT3s8XmUUHUcGeB++fd/5SnvgSHoScqpGf4tgpnL/FsRX79ndsQVEEbbTPaz9UM5P9nK0Fcq01hosTRZqAS/fdJHHku5n8S1EnsQy++W0L0+FgrReXkk3LvaOjNOxFTPouBBFHlhJr4oL/PVLr9kfFjQHBsBiU+lOcHXakfGb7hoGseBFPsnXK7oer8pBsiwQzwUa4J7dbkIk8zRi/suu2MBImhH0o0B7EIRplGVqVM9xboXYnA/H7P21OSxqoaLW4iSSi00oemW16TREObKBAwOz41F2jxlxxrb3ThVVfsAPw6oqeyqDX6UCDiEmus2FnceYP7XOWijwE1yyh9AIV8ywiflFyzR1QEC8A+JuKwCk9G3CBJNCcZSLsIixBboeJRInAs9J3WX33AgKgiAHBoJc+BjCAomF289KDAfrbbejypXO+QwhCWq2uJmDdZR1LUbUqWEoQmdUuhvUucjNa6S39JQSqEmzwFkwlFjTcXRYacmXyamZSVdzaXMmcpPLYfmPbNo7s2jCeoVptKEP01tWM+fvq2w2kEHVvxQ27KixMCiHP6oIfT8Mr3FVUHlv+VIG3FDR2ob0KhWawla3U/pLVLzA6oJhjCrwrXkc6oirSF1dwrrAvvAbaJ0gTxr4h4jO6le+sO3pzLp62bd3/ITfT6lvVKb3fL+q0f8aIuC7U5Iw4ozR4kDPg3oyccDzUleso4ykW4+QcLjytmzNAXGJk5gCDMlKNksV+ZlJhhlZvDGkgmWFejlutwqqe4IrpI2Dkl47VdlrGNlI5B1ouzDk0mv9Clgm6KY+u4xsHY0ehf5+ZN8vVz62R1DLiBWQmr3tjTj8iYo6AIvq21TJW0QyZmPnS2HJwc3Of+CoZUpNngvuZDYqtRIVwZqa0ISHpE3dQBt1HMiRP2aQ7lbCUtT9AWYDC7ULVKXlwAxdyuyfLleFCh/WRHZc7Zzo27mGa0E+UxphZb3ruKCNNuscyqlNhgr3Fn9GiU1C5hFS3x3UwWlPuG73OgUYWY5nz+wQ7VpUeGw5VV+lguNS0JGCU0r18bsmM0yL9thE5Sx+TkMz5kX3AfHrMoe8Apis8PwSt4AzDq3B3ecM9n2XubZ6uGGtBhS1jFGTdspnFf4pP1GNYBTueBRpe05+u4EKuaeFrNtr8F21mkfSPeMYEYY6mReBO6WbxUZRV7yIhdYZGczc3Y3NAKpmqrsKLkuGDWZhMYVU1uoObA5XEqOci1TVc6v94xzTtf4KXuguAOqdablnO6BMbsMaQfhZu7QNj2o9z3XYelA2LPtviDc3p+wk+XA6LL0CoQiz5JJKRLF2zaH2fMG8hWiZ+avMDBkTRcCy4uGzpzhYugM2/CfvF/IvJKz/qJqpKMpXdGq3ESrXrQbF/p9l/Ie2+qVt73urgtx+52O/abdk5r3A17hqHq9r7w+FzkNXZWrunvFTWPyxlvtFjd+w61IJMSuIDOvKuYac2mxG5eLsUstjJvDXMvFab/8y382L9UFWuVL94/Fnexj9aZr9glZi3HBbnnJLm73wR8Qclyb22oX7RqX7Vrvbq/Ge7DN+58wspOu5xNGibhGA+2EKS6XMPsmF+fv/GR2mWbsKOWNsBVxEaxSvDdMD/fYGfyvuBlXPC/ZhAfOsbb+2QxJAWNgrAaRjCuuS6yhwXiXNjC4ZyRaaE3DSx+espEbJ7hVULhbWxxDiEF/ZiDLAdFstQGLTij0VB6mhr7laqxokSGDgtlhWmqRNRUbm+vzdEeXDAqFts3zl87EqUSULcvDGcvDT1/yg8Rcg6ScF9MUF5U49pjj3LEDmn5yJ8xb7QIW3X3A4L6GOZgzGxMjGvQrX+jOvEU8pTT7LSeh7SB/XaS4yz7zKPj1qwOifA6eC/tUeEt1JmwTEdF+kpyISDsd40wcPWiIQobEFEQHzQGNVK4n9e5dXD5C79jvdSnHRDf5wphU/z+L8mbBBPoeiFg1F2w9wpCqC1RPJVRNIpWXo1YyXigJLKyLGGgEr8jh9MTBYSqepX+HMQ6hnx1hXg16EgmO0UXCxGzJkRisn2D0Kb8KUwxKlpFnijGjsxMvgbPP4qLcWsfcNN4+xsJRVMNfmF8nKs8lwziuQpYr5vYSzFM5iezOKi6YBPulUecYGsMggYBZrionovklr0v/c7xcL50Gu6xRwhA9a3q7gt95srGD187UvnbycC6WzrSpU9hUrpi82BfKLpNhHdyfhb0/C9mdhdGdxT26U0nOczia9pwLyIsPrIO/Cl163pmdwfM8dF3ftNE5gb5ts7NhJQvWITihXOMVfLyXmaAAF8L5rTM9vvh+SIoU+WVjUy63fJmCZIJWKMk7/AbwYvHxNFC7mhWZpJSmd2GDjpDslEOS+R5MI+S2sVHve+lc+1Bug+JPFAKK1xATQeNrRTeAMhYGK0QZHShgjV/a1400P4UcvKzKQRR1l3odt9lyrsgrL7oy1zf+NJc+xjkYr0EBCIsQvozZ1BmfcaQsbGFuu34ErW0hPg/ZGqufogZtImw0H65M40Q/bejduVbUfbG9DatZBrh/XAK+XofZ3QUlyEqzp4tFw/2aO+zZFHxQd53lPDS1zAVv2D4LPPGtuKuarbgr5tmubKcLGN/KjfUmnf9lzz5dheVYRPxOFMktuwN5yYOdq5qWdEm0dk1ZUdikLkMnnkVYgkwIV9vra5GlQxY9xHjZrQltxVnOIg52IOx61xkvhc8gOt7FyxB0zAZApLmBvzj0sBAfdJq/VhkDDc9K8S2nO+yIDtvOHrGLTHIwLmeXh9pV8uKjgxaKfo2xevuQ5WoW3AWpGEnifieDRMTJ90ro4gOZjpfukBD3PEVM8VVLNtTu4HaScaWU5ICMEPWz9iykhZGUwu5pNkW4pnK5lS0gg3rL0wdW77vQM2RYl8EOzf1w45yIo5J5GHUWtp83K/amzrVnwVPCtkBPqD9XK6Czg7VKvAzBm+y7gY3XdjkrxHcW8cOjpdwW9mXv4V3yPhx4YFEf9hccWjwMjDFD0SL1KbxcXpduvXKPblx/tvcyM3Yxu3rXKOvU9/iee4UUULvwa1ijzrnTYzzoKxXAPtZhNevwSnJTtdwedLRUHU7LqeBWG2wF1VNoyECusbR//SK0HSB9ciSuov8K76cnx+KTI8x+cv7V/wVtxtGpFfIAAA=='),c=>c.charCodeAt(0));
    const response=new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')));
    const template=await response.text();
    const safeJSON=v=>JSON.stringify(v).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
    const output=template.replace('__DATA__',()=>safeJSON(all)).replace('__META__',()=>safeJSON(meta));
    const name='DOAS_BOM_Dashboard_'+(meta.project||'Project').replace(/[^a-z0-9_-]/gi,'_')+'_v0.16.html';
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
