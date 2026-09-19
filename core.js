(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
  if(root) root.ImportFlowCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const LIMITS={
    csvChars:5_000_000,
    csvRows:10_000,
    csvColumns:100,
    fieldChars:10_000,
    previewRows:100
  };

  const TARGETS=[
    {key:"sku",label:"SKU",required:true,type:"text"},
    {key:"nome",label:"Nome",required:true,type:"text"},
    {key:"prezzo",label:"Prezzo",required:true,type:"number"},
    {key:"iva",label:"IVA",required:false,type:"vat",defaultValue:"22"},
    {key:"disponibilita",label:"Disponibilità",required:false,type:"stock",defaultValue:"0"},
    {key:"categoria",label:"Categoria",required:false,type:"text",defaultValue:"Non categorizzato"}
  ];
  const SYNONYMS={
    sku:["sku","codice","cod","codicearticolo","articolo","item","partnumber","partno","idprodotto"],
    nome:["nome","descrizione","denominazione","prodotto","articolo_descrizione","product","name"],
    prezzo:["prezzo","prezzounitario","importo","listino","price","unitprice","costo"],
    iva:["iva","aliquota","aliquotaiva","vat","tax","taxrate"],
    disponibilita:["disponibilita","giacenza","qta","quantita","stock","magazzino","qty"],
    categoria:["categoria","reparto","famiglia","gruppo","category","classe"]
  };

  function cleanText(value){
    return String(value==null?"":value).replace(/^\uFEFF/,"");
  }

  function normalizeHeader(value){
    return cleanText(value)
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .toLowerCase().replace(/[^a-z0-9]+/g,"");
  }

  function countDelimiters(line,delimiter){
    let count=0,quoted=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch==='"'){
        if(quoted&&line[i+1]==='"'){i++;continue;}
        quoted=!quoted;
      }else if(!quoted&&ch===delimiter) count++;
    }
    return count;
  }
  function detectDelimiter(text){
    const sample=cleanText(text).split(/\r?\n/).slice(0,5).join("\n");
    const candidates=[";",",","\t","|"];
    let best=";",bestScore=-1;
    for(const delimiter of candidates){
      const score=countDelimiters(sample,delimiter);
      if(score>bestScore){best=delimiter;bestScore=score;}
      else if(score===bestScore&&delimiter===";"){best=delimiter;}
    }
    return best;
  }

  function parseCSV(text,delimiter){
    text=cleanText(text);
    if(text.length>LIMITS.csvChars) throw new Error("CSV troppo grande: massimo 5 MB di testo.");
    delimiter=delimiter||detectDelimiter(text);
    const rows=[];let row=[],field="",quoted=false,truncated=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i];
      if(quoted){
        if(ch==='"'&&text[i+1]==='"'){field+='"';i++;}
        else if(ch==='"'){quoted=false;}
        else field+=ch;
      }else{
        if(ch==='"'){quoted=true;}
        else if(ch===delimiter){
          if(field.length>LIMITS.fieldChars) throw new Error("Campo CSV troppo lungo.");
          row.push(field);field="";
        }else if(ch==="\n"||ch==="\r"){
          if(ch==="\r"&&text[i+1]==="\n") i++;
          row.push(field);field="";
          if(row.some(cell=>cell!=="")){
            if(row.length>LIMITS.csvColumns) throw new Error("Troppe colonne nel CSV.");
            rows.push(row);
            if(rows.length>LIMITS.csvRows+1){truncated=true;break;}
          }
          row=[];
        }else field+=ch;
      }
    }
    if(quoted) throw new Error("CSV non valido: virgolette non chiuse.");
    if(field.length>LIMITS.fieldChars) throw new Error("Campo CSV troppo lungo.");
    if(field!==""||row.length){
      row.push(field);
      if(row.length>LIMITS.csvColumns) throw new Error("Troppe colonne nel CSV.");
      if(row.some(cell=>cell!=="")) rows.push(row);
    }
    if(rows.length>LIMITS.csvRows+1) truncated=true;
    return {rows:rows.slice(0,LIMITS.csvRows+1),delimiter,truncated};
  }

  function detectHeader(rows){
    if(rows.length<2) return rows.length===1;
    const first=rows[0],second=rows[1]||[];
    const firstText=first.filter(v=>/[A-Za-zÀ-ÿ]/.test(v)).length;
    const secondNumeric=second.filter(v=>parseFlexibleNumber(v)!=null).length;
    return firstText>=Math.max(1,Math.ceil(first.length/2))&&secondNumeric>0;
  }

  function autoMap(headers){
    const normalized=headers.map(normalizeHeader);
    const mapping={};
    for(const target of TARGETS){
      const synonyms=SYNONYMS[target.key]||[];
      let index=normalized.findIndex(h=>synonyms.includes(h));
      if(index<0){
        index=normalized.findIndex(h=>synonyms.some(s=>h.includes(s)||s.includes(h)));
      }
      mapping[target.key]=index>=0?headers[index]:null;
    }
    return mapping;
  }

  function stripMoney(value){
    return cleanText(value)
      .replace(/[€$£]|\bEUR\b|\bEURO\b/gi,"")
      .replace(/[\u00A0\u2009\s]/g,"").trim();
  }
  function parseFlexibleNumber(value){
    let s=stripMoney(value);
    if(!s) return null;
    if(!/^[+-]?[0-9.,]+$/.test(s)) return null;
    const comma=s.lastIndexOf(","),dot=s.lastIndexOf(".");
    if(comma>=0&&dot>=0){
      const decimal=comma>dot?",":".";
      const thousands=decimal===","?".":",";
      s=s.split(thousands).join("").replace(decimal,".");
    }else if(comma>=0){
      const parts=s.split(",");
      s=parts.length===2&&parts[1].length!==3?parts[0]+"."+parts[1]:parts.join("");
    }else if(dot>=0){
      const parts=s.split(".");
      s=parts.length===2&&parts[1].length===3?parts.join(""):s;
    }
    const n=Number(s);
    return Number.isFinite(n)?n:null;
  }

  function normalizeVat(value,defaultValue){
    let raw=cleanText(value).trim();
    if(!raw) raw=String(defaultValue==null?"22":defaultValue);
    raw=raw.replace("%","").trim();
    let n=parseFlexibleNumber(raw);
    if(n==null) return {value:null,error:"IVA non valida"};
    if(n>0&&n<1) n*=100;
    n=Math.round(n*100)/100;
    if(n<0||n>100) return {value:null,error:"IVA fuori intervallo 0-100"};
    const standard=[0,4,5,10,22];
    return {value:n,warning:standard.includes(n)?null:"Aliquota IVA non standard"};
  }

  function normalizeStock(value,defaultValue){
    let raw=cleanText(value).trim().toLowerCase();
    if(!raw||["n.d.","nd","-"].includes(raw)) raw=String(defaultValue==null?"0":defaultValue);
    if(["si","sì","disponibile","yes"].includes(raw)) return {value:1};
    if(["no","esaurito","no stock"].includes(raw)) return {value:0};
    const n=parseFlexibleNumber(raw);
    if(n==null||n<0) return {value:null,error:"Disponibilità non valida"};
    if(!Number.isInteger(n)) return {value:Math.round(n),warning:"Disponibilità arrotondata"};
    return {value:n};
  }

  function textValue(value,defaultValue){
    const raw=cleanText(value).trim();
    return raw||String(defaultValue==null?"":defaultValue);
  }

  function buildRecord(raw,headers,mapping,defaults,rowNumber){
    const source={};
    headers.forEach((h,i)=>{source[h]=raw[i]==null?"":raw[i];});
    const record={rowNumber,source,values:{},issues:[]};

    for(const target of TARGETS){
      const sourceHeader=mapping[target.key];
      const original=sourceHeader?source[sourceHeader]:"";
      const fallback=defaults&&defaults[target.key]!=null?defaults[target.key]:target.defaultValue;
      let value;

      if(target.type==="number"){
        value=parseFlexibleNumber(original);
        if(value==null) record.issues.push({severity:"error",field:target.key,message:"Prezzo non valido"});
        else if(value<0) record.issues.push({severity:"error",field:target.key,message:"Prezzo negativo"});
        else if(value===0) record.issues.push({severity:"warning",field:target.key,message:"Prezzo pari a zero"});
      }else if(target.type==="vat"){
        const out=normalizeVat(original,fallback);value=out.value;
        if(out.error) record.issues.push({severity:"error",field:target.key,message:out.error});
        if(out.warning) record.issues.push({severity:"warning",field:target.key,message:out.warning});
        if(!original) record.issues.push({severity:"warning",field:target.key,message:"IVA impostata al valore predefinito"});
      }else if(target.type==="stock"){
        const out=normalizeStock(original,fallback);value=out.value;
        if(out.error) record.issues.push({severity:"error",field:target.key,message:out.error});
        if(out.warning) record.issues.push({severity:"warning",field:target.key,message:out.warning});
        if(!original) record.issues.push({severity:"warning",field:target.key,message:"Disponibilità impostata al valore predefinito"});
      }else{
        value=textValue(original,fallback);
        if(!original&&!target.required&&fallback) record.issues.push({severity:"warning",field:target.key,message:target.label+" impostata al valore predefinito"});
      }

      if(target.required&&(value==null||String(value).trim()==="")){
        record.issues.push({severity:"error",field:target.key,message:target.label+" obbligatorio"});
      }
      record.values[target.key]=value;
    }
    return record;
  }

  function transform(rows,headers,mapping,defaults){
    const records=rows.map((row,i)=>buildRecord(row,headers,mapping,defaults,i+2));
    const seen=new Map();
    for(const record of records){
      const key=String(record.values.sku||"").trim().toLowerCase();
      if(!key) continue;
      if(seen.has(key)){
        record.issues.push({severity:"error",field:"sku",message:"SKU duplicato"});
        const first=seen.get(key);
        if(!first.issues.some(i=>i.field==="sku"&&i.message==="SKU duplicato")){
          first.issues.push({severity:"error",field:"sku",message:"SKU duplicato"});
        }
      }else seen.set(key,record);
    }

    for(const record of records){
      record.status=record.issues.some(i=>i.severity==="error")?"error":
        record.issues.some(i=>i.severity==="warning")?"warning":"valid";
    }
    const stats={
      total:records.length,
      valid:records.filter(r=>r.status==="valid").length,
      warning:records.filter(r=>r.status==="warning").length,
      error:records.filter(r=>r.status==="error").length
    };
    return {records,stats};
  }
  function guardFormula(value){
    const s=String(value==null?"":value);
    return /^[=+\-@\t\r]/.test(s)?"'"+s:s;
  }

  function escapeCSV(value){
    const s=guardFormula(value).replace(/"/g,'""');
    return /[;"\n\r,]/.test(s)?'"'+s+'"':s;
  }

  function toCSV(result){
    const headers=TARGETS.map(t=>t.key);
    const lines=[headers.join(";")];
    for(const record of result.records){
      if(record.status==="error") continue;
      const cells=TARGETS.map(target=>{
        const value=record.values[target.key];
        return target.type==="text"?escapeCSV(value):String(value==null?"":value).replace(".",",");
      });
      lines.push(cells.join(";"));
    }
    return lines.join("\r\n");
  }

  function prepareData(parsed){
    const hasHeader=detectHeader(parsed.rows);
    const headers=hasHeader?parsed.rows[0].map((h,i)=>cleanText(h).trim()||"Colonna "+(i+1)):
      (parsed.rows[0]||[]).map((_,i)=>"Colonna "+(i+1));
    const maxRaw=hasHeader?LIMITS.csvRows+1:LIMITS.csvRows;
    const truncated=Boolean(parsed.truncated||parsed.rows.length>maxRaw);
    const sourceRows=hasHeader?parsed.rows.slice(1,LIMITS.csvRows+1):parsed.rows.slice(0,LIMITS.csvRows);
    const rows=sourceRows.map(row=>{
      const out=Array(headers.length).fill("");
      for(let i=0;i<headers.length;i++) out[i]=row[i]==null?"":row[i];
      return out;
    });
    return {headers,rows,hasHeader,truncated,delimiter:parsed.delimiter};
  }

  return {
    LIMITS,TARGETS,SYNONYMS,detectDelimiter,parseCSV,detectHeader,autoMap,
    parseFlexibleNumber,normalizeVat,normalizeStock,transform,toCSV,prepareData,guardFormula
  };
});
