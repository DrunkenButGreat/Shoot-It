const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
let session = null, allowed = false, calls = []
const project = { id: 'p', shortCode: 'code', isPublic: true, ownerId: 'owner', owner: { name: 'Owner' }, _count: { resultImages: 0, moodboardLinks: 0, participants: 0, selectionImages: 0, contracts: 1, appointmentSlots: 0 } }
let visible = { contracts: [{ id: 'c', title: 'Public contract', content: 'Visible contract body' }] }
const cache = new Map()
function load(file) {
 const filename = ['', '.ts', '.tsx', '.json'].map(ext => path.resolve(file + ext)).find(fs.existsSync)
 if (filename.endsWith('.json')) return JSON.parse(fs.readFileSync(filename, 'utf8'))
 if (cache.has(filename)) return cache.get(filename).exports
 const mod = new Module(filename, module); mod.filename=filename; mod.paths=module.paths
 mod.require = id => id === 'server-only' ? {} : id === '@/auth' ? {auth: async()=>session}
 : id === '@/lib/prisma' ? {__esModule:true,default:{project:{findUnique:async q=>{calls.push(q);return calls.length===1?project:visible}}}}
 : id === '@/lib/permissions' ? {canAccessProject:async()=>allowed}
 : id === 'next/headers' ? {cookies:async()=>({get:()=>undefined})}
 : id === 'next/navigation' ? {redirect:()=>{throw Error('redirect')},notFound:()=>{throw Error('notFound')}}
 : id.startsWith('@/components/') ? new Proxy({}, {get:(_t,key)=>key==='__esModule'?true:key})
 : id.startsWith('@/') ? load('src/'+id.slice(2)) : require(id)
 cache.set(filename,mod)
 mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename)
 return mod.exports
}
function elements(node) {
 if(!node || typeof node!=='object')return []
 if(Array.isArray(node))return node.flatMap(elements)
 return [node,...elements(node.props?.children)]
}
async function main(){
 const page=load('src/app/p/[shortCode]/page').default
 project.showContractsPublicly=true
 const tree=await page({params:Promise.resolve({shortCode:'code'})})
 assert.equal(calls.length,2)
 for(const key of ['moodboardLinks','participants','appointmentSlots','callsheet'])assert.equal(calls[1].include[key],false)
 assert.deepEqual(calls[1].include.contracts.select,{id:true,title:true,content:true})
 assert.ok(elements(tree).some(e=>e.props?.children==='Visible contract body'))
 session={user:{id:'outsider'}};calls=[];project.showSelectionPublicly=true
 const publicTree=await page({params:Promise.resolve({shortCode:'code'})})
 // An authenticated outsider follows the public link, never an internal member route.
 assert.ok(elements(publicTree).filter(e=>e.type==='ModuleBox').every(e=>!e.props.href.startsWith('/project/')))
 project.isPublic=false;calls=[]
 await page({params:Promise.resolve({shortCode:'code'})})
 assert.equal(calls.length,1,'Private outsider must never load module payloads')
 session=null;calls=[]
 await assert.rejects(()=>page({params:Promise.resolve({shortCode:'code'})}),/redirect/)
 assert.equal(calls.length,1)
 console.log('PASS: public module payload gates, public contract text and outsider navigation.')
}
main().catch(e=>{console.error(e);process.exitCode=1})
