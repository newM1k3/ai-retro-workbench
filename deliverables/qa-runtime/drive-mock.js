const fn = require('./execute-card.cjs');
const handler = fn.default;
const enc = JSON.stringify;
(async () => {
  process.env.ANTHROPIC_API_KEY = ''; process.env.OPENAI_API_KEY = ''; process.env.ZAI_API_KEY = '';
  const r = await handler(new Request('http://x/api/execute-card', { method: 'POST', headers: {'content-type':'application/json'}, body: enc({prompt:'Analyze the 1984 sales memo', target_model:'glm', stream:true}) }));
  const reader = r.body.getReader(); const dec = new TextDecoder(); let buf=''; const seq=[]; let meta=null; let deltaCount=0, deltaChars=0; let done=null;
  while (true) { const {done:d, value} = await reader.read(); if (d) break; buf += dec.decode(value, {stream:true});
    let idx = buf.indexOf('\n\n');
    while (idx >= 0) { const block = buf.slice(0, idx); buf = buf.slice(idx+2);
      const evt = (block.match(/^event: (.+)$/m) || [])[1] || 'message';
      const data = block.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5)).join('\n');
      seq.push(evt);
      if (evt==='meta') meta = JSON.parse(data); else if (evt==='delta') { deltaCount++; deltaChars += JSON.parse(data).length; } else if (evt==='done') done = JSON.parse(data);
      idx = buf.indexOf('\n\n'); } }
  console.log('STATUS:', r.status, '| CT:', r.headers.get('content-type'));
  console.log('EVENT ORDER:', seq.join(' -> '));
  console.log('META:', JSON.stringify(meta));
  console.log('DELTAS:', deltaCount, '| CHARS:', deltaChars);
  console.log('DONE:', JSON.stringify(done));
  // first delta <= 300ms after meta (150ms pacing) - liveness check
  console.log('HAS_DONE_TOKENS:', done && typeof done.tokens === 'number');
})();
