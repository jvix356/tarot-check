process.env.PUBLIC_COMMUNITY_WRITES='1';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {checkText,checkPrivate} from '../lib/filter.js';
import {writeJSON,readJSON} from '../lib/store.js';
import {publicIndex} from '../lib/board.js';
import admin from '../api/admin.js';
import posts from '../api/posts.js';
import {signToken} from '../lib/util.js';
process.env.STORE='memory';
async function call(handler,method,body,token='test-admin-token-1234') {
 const req={method,body,headers:{authorization:'Bearer '+token,host:'test.local'},query:{}};
 const res={setHeader(){},end(x){this.data=JSON.parse(x);}};
 await handler(req,res); return {status:res.statusCode,...res.data};
}
test('public identifiers blocked; private evidence allowed; normalized bypasses blocked',()=>{
 for(const s of ['https://example.com/x','example.com','@상담계정','＠tarot','@ta\u200brot','아이디: reader','인스타 reader_1','010-1234-5678']) assert.ok(checkText(s).blocked.length,s);
 assert.equal(checkText('추가 결제를 요구하는 수법을 경험했어요.').blocked.length,0);
 assert.deepEqual(checkPrivate('@reader https://example.com 010-1234-5678'),[]);
 assert.ok(checkPrivate('죽여버린다').length);
});
test('cached public data excludes private fields, identifiers, comments and unsafe replies',()=>{
 const base={id:'a',body:'수법을 공유합니다.',nickname:'독자',privateNote:'PRIVATE',authorId:'SECRET',reply:{body:'@leak',at:'now'},comments:[{id:'c',body:'@leak'}]};
 const idx=publicIndex({posts:[base,{...base,id:'b',title:'https://example.com'}]});
 assert.equal(idx.posts.length,1); assert.equal(idx.posts[0].reply,null); assert.deepEqual(idx.posts[0].comments,[]);
 assert.ok(!JSON.stringify(idx).includes('PRIVATE')); assert.ok(!JSON.stringify(idx).includes('SECRET'));
});
test('write → private note → moderation → public API, and admin cannot bypass filter',async()=>{
 await writeJSON('accounts/u.json',{id:'u',nickname:'독자',sessionVersion:1,posts:[]});
 const token=signToken({uid:'u',sv:1});
 const draft={type:'report',title:'결제 유도 수법',body:'추가 결제를 요구하는 수법을 경험했어요.',privateNote:'@reader https://example.com',agree:true};
 const m=await call(posts,'POST',{...draft,body:'@reader 계정을 제보합니다.'},token);assert.equal(m.status,200);assert.ok(m.masked.includes('계정'));
 const made=await call(posts,'POST',draft,token);assert.equal(made.status,200);
 assert.equal((await call(admin,'POST',{action:'publish',id:made.id})).status,200);
 const list=await call(posts,'GET',null,token);assert.equal(list.posts.length,0);assert.equal((await readJSON(`posts/${made.id}.json`)).status,'private');assert.ok(!JSON.stringify(list).includes('@reader'));
 assert.equal((await call(admin,'POST',{action:'edit',id:made.id,body:'@reader 계정을 제보합니다.'})).status,400);
 assert.equal((await call(admin,'POST',{action:'reply',id:made.id,reply:'https://example.com'})).status,400);
 assert.equal((await readJSON(`posts/${made.id}.json`)).body,draft.body);
 await writeJSON('posts/legacy.json',{...draft,id:'legacy',nickname:'독자',body:'@reader 계정입니다.',status:'pending'});
 assert.equal((await call(admin,'POST',{action:'publish',id:'legacy'})).status,400);
});
test('exact source evidence preserves lines, repeated matches and escapes HTML',()=>{
 const src=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const fn=src.slice(src.indexOf('function signalEvidence('),src.indexOf('function styleAnalyze('));
 const ctx=vm.createContext({esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')});
 vm.runInContext(fn,ctx);
 const items=ctx.signalEvidence('첫 줄\n<script>흐름</script> 흐름',/흐름/g);
 assert.equal(items.length,2);assert.equal(items[0].line,2);assert.equal(items[0].match,'흐름');
 const html=ctx.renderEvidence(items);assert.ok(html.includes('<mark>흐름</mark>'));assert.ok(!html.includes('<script>'));
});
