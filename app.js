(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const pretty = value => {
    const normalized = String(value ?? 'Unknown').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
    return normalized === 'Accepted' ? 'Visually accepted' : normalized;
  };
  let data;
  const colors = {accepted:'#76b900', needs_review:'#d8742f', error:'#b64031'};

  function metric(label, value, caption) { return `<article class="metric"><span class="metric-label">${esc(label)}</span><span class="metric-value">${esc(value)}</span><span class="metric-caption">${esc(caption)}</span></article>`; }
  function unique(field) { return [...new Set(data.cases.map(row => row[field]).filter(Boolean))].sort(); }
  function option(value) { return `<option value="${esc(value)}">${esc(value)}</option>`; }
  function badge(text, kind='') { return `<span class="badge ${esc(kind)}">${esc(text)}</span>`; }

  function renderHeader() {
    const count = name => data.counts.outcomes[name] || 0;
    $('hero-total').textContent = data.total;
    $('accepted-meter').style.width = `${count('accepted') / data.total * 100}%`;
    $('accepted-summary').textContent = `${count('accepted')} visually accepted · ${count('needs_review') + count('error')} held`;
    $('metrics').innerHTML = [
      metric('Generated candidates', data.total, 'Public records; source prompts withheld'),
      metric('Visually accepted', count('accepted'), 'Not safety or scientific approval'),
      metric('Needs review', count('needs_review'), 'Revision limit reached'),
      metric('Errors', count('error'), 'Terminal generation issue'),
      metric('Rendered pages', data.counts.pages, 'Across all candidates')
    ].join('');
  }

  function renderOverview() {
    const total = data.total;
    $('outcome-bar').innerHTML = ['accepted','needs_review','error'].map(name => `<span class="bar-${name}" style="width:${(data.counts.outcomes[name]||0)/total*100}%"></span>`).join('');
    $('outcome-legend').innerHTML = ['accepted','needs_review','error'].map(name => `<span><i style="background:${colors[name]}"></i><strong>${data.counts.outcomes[name]||0}</strong> ${pretty(name)}</span>`).join('');
    const domains = unique('domain'), severities = unique('severity');
    $('matrix').innerHTML = `<table><thead><tr><th>Domain</th>${severities.map(x=>`<th>${esc(x)}</th>`).join('')}<th>Total</th></tr></thead><tbody>${domains.map(domain => { const rows=data.cases.filter(x=>x.domain===domain); return `<tr><th>${esc(domain)}</th>${severities.map(severity=>`<td><strong>${rows.filter(x=>x.severity===severity).length}</strong></td>`).join('')}<td><strong>${rows.length}</strong></td></tr>`; }).join('')}</tbody></table>`;
    const formats = Object.entries(data.counts.formats).sort((a,b)=>b[1]-a[1]), max=Math.max(...formats.map(x=>x[1]),1);
    $('formats').innerHTML = formats.map(([name,value])=>`<div class="rank"><div><span>${esc(pretty(name))}</span><div class="rank-track"><i style="width:${value/max*100}%"></i></div></div><strong>${value}</strong></div>`).join('');
  }

  function thumb(row) { return row.images.length ? `<img loading="lazy" src="${esc(row.images[0])}" alt="Generated ${esc(pretty(row.format))} preview">` : '<span class="empty">No retained image</span>'; }
  function card(row) { return `<button class="card" data-id="${esc(row.display_id)}"><div class="thumb">${thumb(row)}</div><div class="card-body"><div class="badges">${badge(pretty(row.pipeline_outcome),row.pipeline_outcome)}${badge(row.severity)}${badge(row.domain)}</div><h3>${esc(row.display_id)} · ${esc(pretty(row.format))}</h3><p>${esc(row.latest_visual_summary)}</p><footer><span>${row.page_count} public page${row.page_count===1?'':'s'}</span><span>Sanitized preview</span></footer></div></button>`; }
  function wireCards(root) { root.querySelectorAll('.card').forEach(node => node.addEventListener('click', () => openDetail(data.cases.find(row => row.display_id === node.dataset.id)))); }

  function filtered() {
    const query=$('search').value.trim().toLowerCase(), domain=$('domain-filter').value, severity=$('severity-filter').value, outcome=$('outcome-filter').value;
    return data.cases.filter(row => (!domain||row.domain===domain)&&(!severity||row.severity===severity)&&(!outcome||row.pipeline_outcome===outcome)&&(!query||[row.display_id,row.prompt,row.format,row.template,row.variant,row.domain,row.severity].some(value=>String(value??'').toLowerCase().includes(query))));
  }
  function renderCards() { const rows=filtered(); $('result-count').textContent=`Showing ${rows.length} of ${data.total} candidates`; $('cards').innerHTML=rows.map(card).join(''); wireCards($('cards')); }
  function renderReview() { const rank={error:0,needs_review:1}; const rows=data.cases.filter(x=>x.pipeline_outcome!=='accepted').sort((a,b)=>rank[a.pipeline_outcome]-rank[b.pipeline_outcome]); $('review-cards').innerHTML=rows.map(card).join(''); wireCards($('review-cards')); }

  function openDetail(row) {
    $('detail-body').innerHTML=`<article class="detail"><div class="badges">${badge(pretty(row.pipeline_outcome),row.pipeline_outcome)}${badge(row.severity)}${badge(row.domain)}</div><h2>${esc(row.display_id)} · ${esc(pretty(row.format))}</h2><p>${esc(row.latest_visual_summary)}</p><div class="detail-grid"><div><div class="carousel">${row.images.map((src,index)=>`<img src="${esc(src)}" alt="${esc(row.display_id)} page ${index+1}">`).join('')||'<p>Image withheld from the unrestricted public preview.</p>'}</div><h3>Source question</h3><div class="prompt">${esc(row.prompt)}</div></div><aside class="provenance"><h3>Public-review scope</h3><dl><dt>Pipeline outcome</dt><dd>${esc(pretty(row.pipeline_outcome))}</dd><dt>Latest visual decision</dt><dd>${esc(pretty(row.latest_visual_decision))}</dd><dt>Review status</dt><dd>Human/SME review pending</dd><dt>Scientific fidelity</dt><dd>Not independently verified</dd><dt>Safety approval</dt><dd>Not represented</dd></dl></aside></div></article>`;
    $('detail').showModal();
  }

  function setView(name) { document.querySelectorAll('.view').forEach(node=>node.hidden=node.id!==name); document.querySelectorAll('.tabs button').forEach(node=>node.classList.toggle('active',node.dataset.view===name)); if(name==='samples')renderCards(); }
  function init() {
    renderHeader(); renderOverview(); renderReview();
    unique('domain').forEach(x=>$('domain-filter').insertAdjacentHTML('beforeend',option(x)));
    unique('severity').forEach(x=>$('severity-filter').insertAdjacentHTML('beforeend',option(x)));
    ['accepted','needs_review','error'].forEach(x=>$('outcome-filter').insertAdjacentHTML('beforeend',option(x)));
    document.querySelectorAll('.tabs button').forEach(node=>node.addEventListener('click',()=>setView(node.dataset.view)));
    ['search','domain-filter','severity-filter','outcome-filter'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',renderCards));
    $('clear').addEventListener('click',()=>{['search','domain-filter','severity-filter','outcome-filter'].forEach(id=>$(id).value='');renderCards();});
    $('close').addEventListener('click',()=>$('detail').close());
    $('loading').hidden=true; $('content').hidden=false;
  }
  fetch('data.json',{cache:'no-store'}).then(response=>{if(!response.ok)throw new Error('snapshot');return response.json();}).then(value=>{data=value;init();}).catch(()=>{$('loading').hidden=true;$('error').hidden=false;});
})();
