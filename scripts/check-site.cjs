const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('Pack873_Website_DEV/index.html','utf8');
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
for(const [,attrs,source] of scripts){
 if(/type=["']application\/ld\+json/.test(attrs)){JSON.parse(source);continue;}
 if(!source.trim())continue;
 new vm.Script(source.replace(/^import .*;$/gm,''));
}
assert(html.includes("input.insertAdjacentElement('afterend',toggle)"));
assert(html.includes("const {error:loginError}=await db.auth.signInWithPassword({email,password})"));
console.log('Inline JavaScript and JSON syntax verified; password controls and automatic re-login present.');
