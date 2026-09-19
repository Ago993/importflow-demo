const assert=require("assert");
const fs=require("fs");
const path=require("path");
const core=require("../core.js");

const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
const app=fs.readFileSync(path.join(__dirname,"../app.js"),"utf8");
const source=fs.readFileSync(path.join(__dirname,"../core.js"),"utf8");

assert.ok(/Content-Security-Policy/.test(html));
assert.ok(/script-src 'self'/.test(html));
assert.ok(/connect-src 'none'/.test(html));
assert.ok(/object-src 'none'/.test(html));
assert.ok(/form-action 'none'/.test(html));
assert.ok(!/\.innerHTML\s*=|insertAdjacentHTML|document\.write|\beval\s*\(|new Function/.test(app));
assert.ok(!/\.innerHTML\s*=|insertAdjacentHTML|document\.write|\beval\s*\(|new Function/.test(source));

assert.equal(core.guardFormula("=1+1"),"'=1+1");
assert.equal(core.guardFormula("+SUM(A1:A2)"),"'+SUM(A1:A2)");
assert.equal(core.guardFormula("-2+3"),"'-2+3");
assert.equal(core.guardFormula("@cmd"),"'@cmd");
assert.equal(core.guardFormula("\tcmd"),"'\tcmd");

const xss='<img src=x onerror=alert(1)>';
const data=core.prepareData(core.parseCSV('sku;nome;prezzo\nA1;"'+xss+'";10\n'));
const result=core.transform(data.rows,data.headers,core.autoMap(data.headers),{
  iva:"22",disponibilita:"0",categoria:"X"
});
assert.equal(result.records[0].values.nome,xss);

console.log("OK - ImportFlow security tests passed");
