const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');

const saved=[]
let proof={editable:true,busy:false,send:cmd=>saved.push(cmd)}
const filename = path.resolve('src/components/selection/RatingControls.tsx');
const componentModule = new Module(filename, module);
componentModule.filename = filename;
componentModule.paths = module.paths;
componentModule.require = id => id === './PersonalSelection'
  ? {useProof:()=>proof}
  : id === '@/components/I18nProvider'
    ? { useI18n: () => ({ t: key => key }) }
    : id === 'lucide-react'
      ? { Star: () => null }
      : require(id);
componentModule._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText, filename);
const { RatingControls } = componentModule.exports;

const props = { imageId:'one',initialRating:{id:'one',stars:5,color:'RED'} }
function controls() { const tree=RatingControls(props); return tree.props.children.map(group=>group.props.children) }
const [stars,colors]=controls()
assert.ok(stars[4].props['aria-pressed']);assert.ok(colors[0].props['aria-pressed'])
stars[4].props.onClick(); colors[2].props.onClick()
assert.deepEqual(saved,[{action:'rate',imageId:'one',stars:null},{action:'rate',imageId:'one',color:'GREEN'}])
proof.editable=false
assert.ok(controls()[0][2].props.disabled)
controls()[0][2].props.onClick();assert.equal(saved.length,2)
console.log('PASS: independent star and color edits; other reviewers are read-only.')
