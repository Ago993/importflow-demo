const assert=require("assert");
const fs=require("fs");
const path=require("path");
const core=require("../core.js");

const sample=fs.readFileSync(path.join(__dirname,"../samples/sample.csv"),"utf8");
const parsed=core.parseCSV(sample);
assert.equal(parsed.delimiter,";");
const data=core.prepareData(parsed);
assert.equal(data.hasHeader,true);
assert.equal(data.rows.length,12);
assert.deepEqual(data.headers,["cod_art","descrizione","listino","aliquota","giacenza","famiglia"]);

const mapping=core.autoMap(data.headers);
assert.equal(mapping.sku,"cod_art");
assert.equal(mapping.nome,"descrizione");
assert.equal(mapping.prezzo,"listino");
assert.equal(mapping.iva,"aliquota");
assert.equal(mapping.disponibilita,"giacenza");
assert.equal(mapping.categoria,"famiglia");

const result=core.transform(data.rows,data.headers,mapping,{
  iva:"22",disponibilita:"0",categoria:"Non categorizzato"
});
assert.deepEqual(result.stats,{total:12,valid:4,warning:3,error:5});
assert.equal(core.parseFlexibleNumber("12,50"),12.5);
assert.equal(core.parseFlexibleNumber("1.234"),1234);
assert.equal(core.parseFlexibleNumber("1.234,56"),1234.56);
assert.equal(core.parseFlexibleNumber("1,234.56"),1234.56);
assert.equal(core.parseFlexibleNumber("€ 1.250,50 EUR"),1250.5);
assert.equal(core.parseFlexibleNumber("abc"),null);

assert.equal(core.normalizeVat("22%","0").value,22);
assert.equal(core.normalizeVat("0,22","0").value,22);
assert.equal(core.normalizeVat("21%","0").warning,"Aliquota IVA non standard");
assert.equal(core.normalizeStock("disponibile","0").value,1);
assert.equal(core.normalizeStock("esaurito","0").value,0);
assert.equal(core.normalizeStock("12,0","0").value,12);
assert.ok(core.normalizeStock("-5","0").error);

const quoted=core.parseCSV('codice;nome;prezzo\r\nA1;"Vite; speciale";12,50\r\n');
assert.equal(quoted.rows[1][1],"Vite; speciale");
assert.equal(quoted.rows[1][2],"12,50");

const multiline=core.parseCSV('codice;nome\nA1;"prima riga\nseconda riga"\n');
assert.equal(multiline.rows[1][1],"prima riga\nseconda riga");
const dupRows=core.prepareData(core.parseCSV(
  "sku;nome;prezzo\n AB-1 ;Uno;10\nab-1;Due;12\n"
));
const dupMap=core.autoMap(dupRows.headers);
const dupResult=core.transform(dupRows.rows,dupRows.headers,dupMap,{iva:"22",disponibilita:"0",categoria:"X"});
assert.equal(dupResult.stats.error,2);

const leading=core.prepareData(core.parseCSV("sku;nome;prezzo\n0012;Zero;10\n"));
const leadingResult=core.transform(leading.rows,leading.headers,core.autoMap(leading.headers),{
  iva:"22",disponibilita:"0",categoria:"X"
});
assert.equal(leadingResult.records[0].values.sku,"0012");

const csv=core.toCSV(result);
assert.ok(csv.includes("'=2+3"));
assert.ok(!csv.includes("A-104;Pompa acqua"));
assert.ok(!csv.includes("A-109;Prezzo da verificare"));
const exported=core.prepareData(core.parseCSV(csv));
const remap=core.autoMap(exported.headers);
const roundtrip=core.transform(exported.rows,exported.headers,remap,{iva:"22",disponibilita:"0",categoria:"X"});
assert.equal(roundtrip.stats.error,0);

assert.throws(()=>core.parseCSV("x".repeat(core.LIMITS.csvChars+1)),/troppo grande/i);
assert.throws(()=>core.parseCSV("a;b\n"+"x".repeat(core.LIMITS.fieldChars+1)+";1"),/troppo lungo/i);
console.log("OK - ImportFlow core tests passed");
