import test from 'node:test';
import assert from 'node:assert/strict';
import {pageWindow} from '../board-pagination.js';
test('five rows per page; clamp after filter/deletion; empty board stays on page one',()=>{
 assert.equal(pageWindow(0,20).page,1);
 assert.equal(pageWindow(6,2).start,5);
 assert.equal(pageWindow(6,20).page,2);
 assert.equal(pageWindow(6,-1).page,1);
 assert.equal(pageWindow(25,5).end,25);
});
test('five page navigation groups cover boundaries without skipping records',()=>{
 assert.deepEqual(pageWindow(56,5).pages,[1,2,3,4,5]);
 assert.deepEqual(pageWindow(56,6).pages,[6,7,8,9,10]);
 assert.deepEqual(pageWindow(56,12).pages,[11,12]);
 let seen=[];for(let p=1;p<=12;p++){let s=pageWindow(56,p);seen.push(...Array.from({length:56},(_,i)=>i).slice(s.start,s.end));}
 assert.deepEqual(seen,Array.from({length:56},(_,i)=>i));
});
