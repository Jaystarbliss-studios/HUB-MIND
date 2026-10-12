const { spawn } = require('node:child_process');
const path = require('node:path');
const { app } = require('electron');
const { randomUUID } = require('node:crypto');
let child = null, nextId = 0, buffer = '';
const pending = new Map();
function ensureAgent() {
 if (child && child.exitCode === null) return child;
 child = spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'jess-agent.ps1')],{windowsHide:true,stdio:['pipe','pipe','pipe'],shell:false});
 child.stdout.setEncoding('utf8');
 child.stdout.on('data',chunk=>{ buffer+=chunk; while(true){const at=buffer.indexOf('\n');if(at<0)break;const line=buffer.slice(0,at).trim();buffer=buffer.slice(at+1);if(!line)continue;try{const msg=JSON.parse(line),wait=pending.get(msg.id);if(wait){pending.delete(msg.id);clearTimeout(wait.timer);wait.resolve(msg.result);}}catch{}} });
 child.stderr.on('data',chunk=>console.warn('[Jess native agent]',String(chunk).slice(0,1000)));
 child.on('exit',(code,signal)=>{for(const [id,wait] of pending){clearTimeout(wait.timer);wait.reject(new Error('Jess native agent exited ('+(code??signal??'unknown')+')'));pending.delete(id);}child=null;buffer='';}); return child;
}
function call(method,args={},timeout=15000){if(process.platform!=='win32')return Promise.resolve({ok:false,verified:false,evidence:null,error:'Native Windows control is only available in the Windows desktop build.'});const proc=ensureAgent(),id=(++nextId)+'-'+randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Native action timed out: '+method));},timeout);pending.set(id,{resolve,reject,timer});proc.stdin.write(JSON.stringify({id,method,args})+'\n',error=>{if(error){const wait=pending.get(id);if(wait){pending.delete(id);clearTimeout(timer);reject(error);}}});});}
function stop(){if(child){child.kill();child=null;}for(const [id,wait] of pending){clearTimeout(wait.timer);wait.reject(new Error('Jess native agent stopped'));pending.delete(id);}}
app.on('before-quit',stop);
module.exports={call,stop};
