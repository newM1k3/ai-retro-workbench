const fn = require('./execute-card.cjs');
const handler = fn.default;
const enc = JSON.stringify;
(async () => {
  // 1) GET -> 405
  const r405 = await handler(new Request('http://x/api/execute-card', { method: 'GET' }));
  console.log('GET:', r405.status, await r405.text());
  // 2) OPTIONS -> 204
  const rOpt = await handler(new Request('http://x/api/execute-card', { method: 'OPTIONS' }));
  console.log('OPTIONS:', rOpt.status, rOpt.headers.get('access-control-allow-origin'));
  // 3) empty prompt -> 400 envelope
  const rEmpty = await handler(new Request('http://x/api/execute-card', { method: 'POST', headers: {'content-type':'application/json'}, body: enc({prompt:'   ', target_model:'claude'}) }));
  console.log('EMPTY:', rEmpty.status, await rEmpty.text());
  // 4) bad model -> 400
  const rBad = await handler(new Request('http://x/api/execute-card', { method: 'POST', headers: {'content-type':'application/json'}, body: enc({prompt:'hi', target_model:'groq'}) }));
  console.log('BADMODEL:', rBad.status, await rBad.text());
  // 5) bad json -> 400
  const rBadJson = await handler(new Request('http://x/api/execute-card', { method: 'POST', headers: {'content-type':'application/json'}, body: '{{{' }));
  console.log('BADJSON:', rBadJson.status, await rBadJson.text());
  // 6) happy mock path
  const r = await handler(new Request('http://x/api/execute-card', { method: 'POST', headers: {'content-type':'application/json'}, body: enc({prompt:'Analyze the 1984 sales memo', target_model:'glm', stream:true}) }));
  console.log('MOCK STATUS:', r.status, '| CT:', r.headers.get('content-type'));
  const reader = r.body.getReader(); const dec = new TextDecoder(); let buf=''; let events=[]; let doneEvt=null; let metaEvt=null; let deltaCount=0; let deltaChars=0;
  while (true) { const {done, value} = await reader.read(); if (done) break; buf += dec.decode(value, {stream:true});
    let idx = buf.indexOf('\n\n');
    while (idx >= 0) { const block = buf.slice(0, idx); buf = buf.slice(idx+2);
      const evt = (block.match(/^event: (.+)$/m) || [])[1] || 'message';
      const data = block.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5)).join('\n');
      if (evt==='meta') metaEvt = JSON.parse(data);
      else if (evt==='delta') { deltaCount++; deltaChars += JSON.parse(data).length; }
      else if (evt==='done') doneEvt = JSON.parse(data);
      idx = buf.indexOf('\n\n'); } }
  console.log('MOCK META:', JSON.stringify(metaEvt));
  console.log('DELTA COUNT:', deltaCount, '| CHARS:', deltaChars);
  console.log('DONE:', JSON.stringify(doneEvt));
  const order = [];
  // verify event order quickly by re-running with sequence capture
  const r2 = await handler(new Request('http://x/api/execute-card', { method: 'POST', headers: {'content-type':'application/json'}, body: enc({prompt:'x', target_model:'claude'}) }));
  const rd2 = r2.body.getReader(); let b2=''; const seq=[];
  while (true) { const {done, value} = await rd2.read(); if (done) break; b2 += new TextDecoder().decode(value, {stream:true});
    let idx = b2.indexOf('\n\n');
    while (idx>=0) { const block = b2.slice(0, idx); b2 = b2.slice(idx+2);
      seq.push((block.match(/^event: (.+)$/m)||[])[1]||'message'); idx = b2.indexOf('\n\n'); } }
  console.log('EVENT ORDER:', seq.join(' -> '));
})();
