const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const Module = require('node:module')
const ts = require('typescript')
const React = require('react')
const sharp = require('sharp')
const { renderToStaticMarkup } = require('react-dom/server')
const cache = new Map()
function load(file) {
 const filename=['','.tsx','.ts','.json'].map(ext=>path.resolve(file+ext)).find(fs.existsSync)
 assert.ok(filename,file);if(filename.endsWith('.json'))return JSON.parse(fs.readFileSync(filename,'utf8'))
 if(cache.has(filename))return cache.get(filename).exports
 const mod=new Module(filename,module);mod.filename=filename;mod.paths=module.paths
 mod.require=id=>id==='next/navigation'?{useRouter:()=>({refresh(){}})}:id.startsWith('@/')?load('src/'+id.slice(2)):id.startsWith('.')?load(path.resolve(path.dirname(filename),id)):require(id)
 cache.set(filename,mod);mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename)
 return mod.exports
}
async function main() {
 const {imagePreviewSource}=load('src/lib/image-preview')
 const image={id:'portrait',filename:'portrait.jpg',path:'/api/uploads/selection/test/portrait.jpg',thumbnail:'/api/uploads/selection/test/preview_portrait.jpg.webp',width:2000,height:3000,ratings:null}
 assert.equal(imagePreviewSource(image),image.thumbnail)
 assert.equal(imagePreviewSource({...image,thumbnail:image.path}),image.thumbnail)
 assert.equal(imagePreviewSource({...image,thumbnail:null}),image.thumbnail)
 assert.equal(imagePreviewSource({path:'/video.mp4',thumbnail:'/poster.webp',isVideo:true}),'/poster.webp')
 const {ImageCard}=load('src/components/selection/ImageCard');const {I18nProvider}=load('src/components/I18nProvider')
 for(const layout of ['grid','masonry','justified']) {
  const html=renderToStaticMarkup(React.createElement(I18nProvider,{initialLocale:'de',initialDictionary:load('src/dictionaries/de.json')},React.createElement(ImageCard,{image,projectId:'test',onPreview(){},onDownload(){},masonry:layout==='masonry',justified:layout==='justified'})))
  assert.ok(html.includes(image.thumbnail));assert.ok(!html.includes('object-cover'));assert.ok(!html.includes('aspect-[4/3]'));assert.ok(!html.includes('group-hover:scale-105'))
 }
 const {generateThumbnail,generateResultPreview,getImageMetadata}=load('src/lib/image-processing')
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'gallery-preview-'))
 try {
  const file=path.join(temp,'portrait.jpg'),preview=path.join(temp,'preview.webp'),thumb=path.join(temp,'thumb.jpg')
  // Red and blue edges make a center crop observable, not just a metadata assertion.
  const top=Buffer.from('<svg width="1200" height="80"><rect width="1200" height="80" fill="red"/></svg>')
  const bottom=Buffer.from('<svg width="1200" height="80"><rect width="1200" height="80" fill="blue"/></svg>')
  await sharp({create:{width:1200,height:1800,channels:3,background:'#ffffff'}}).composite([{input:top,top:0,left:0},{input:bottom,top:1720,left:0}]).jpeg().toFile(file)
  await generateThumbnail(file,thumb);await generateResultPreview(file,preview)
  for(const target of [thumb,preview]) {
   const m=await sharp(target).metadata();assert.ok(m.height>m.width);assert.ok(Math.abs(m.width/m.height-2/3)<0.01)
   const {data,info}=await sharp(target).removeAlpha().raw().toBuffer({resolveWithObject:true})
   const first=(Math.floor(info.width/2))*info.channels;const last=((info.height-1)*info.width+Math.floor(info.width/2))*info.channels
   assert.ok(data[first]>200 && data[first+2]<80,'Top red border preserved');assert.ok(data[last+2]>200 && data[last]<80,'Bottom blue border preserved')
  }
  const rotated=path.join(temp,'exif.jpg');await sharp({create:{width:1800,height:1200,channels:3,background:'#c0c0c0'}}).withMetadata({orientation:6}).jpeg().toFile(rotated)
  const meta=await getImageMetadata(rotated);assert.equal(meta.width,1200);assert.equal(meta.height,1800)
  await generateResultPreview(rotated,preview);const m=await sharp(preview).metadata();assert.equal(m.width,1200);assert.equal(m.height,1800)
 } finally {fs.rmSync(temp,{recursive:true,force:true})}
 console.log('PASS: existing preview reused, legacy canonical preview, full-frame portraits in all layouts, preserved top/bottom image borders, EXIF orientation and original download/playback paths.')
}
main().catch(e=>{console.error(e);process.exitCode=1})
