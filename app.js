"use strict";

const core=window.ImportFlowCore;
const $=id=>document.getElementById(id);

const SAMPLE_CSV=[
  "cod_art;descrizione;listino;aliquota;giacenza;famiglia",
  "A-100;Bullone inox M8;12,50;22%;120;Ferramenta",
  "A-101;Vite torx 4x30;8,40;;45;Ferramenta",
  "A-102;Guarnizione alta temperatura;5,90;22%;disponibile;Ricambi",
  "A-103;Filtro aria;0;22%;12;Ricambi",
  "A-104;Pompa acqua;-15,00;22%;3;Ricambi",
  "A-105;;25,00;22%;5;Ricambi",
  "A-106;Kit manutenzione;1.234,56;10%;2;Manutenzione",
  "A-106;Kit manutenzione duplicato;1.250,00;10%;4;Manutenzione",
  "=2+3;Articolo con codice speciale;18,50;22%;7;Test",
  "A-107;Prodotto senza stock;15,30;21%;;Altro",
  "A-108;Prodotto esaurito;99,99;22%;esaurito;Altro",
  "A-109;Prezzo da verificare;abc;22%;8;Altro"
].join("\n");

const state={
  fileName:"",
  data:null,
  mapping:{},
  defaults:{iva:"22",disponibilita:"0",categoria:"Non categorizzato"},
  result:null,
  filter:"all"
};

function clear(node){while(node.firstChild) node.removeChild(node.firstChild);}
function make(tag,className,text){
  const node=document.createElement(tag);
  if(className) node.className=className;
  if(text!=null) node.textContent=text;
  return node;
}
function decodeFile(file){
  if(file.size>5_000_000) return Promise.reject(new Error("File troppo grande: massimo 5 MB."));
  return file.arrayBuffer().then(buffer=>{
    let text=new TextDecoder("utf-8").decode(buffer);
    if(text.includes("\uFFFD")) text=new TextDecoder("windows-1252").decode(buffer);
    return text;
  });
}

function loadText(text,fileName){
  try{
    const parsed=core.parseCSV(text);
    const data=core.prepareData(parsed);
    if(!data.headers.length) throw new Error("Il CSV non contiene colonne leggibili.");
    state.fileName=fileName;
    state.data=data;
    state.mapping=core.autoMap(data.headers);
    state.filter="all";
    renderWorkspace();
  }catch(error){
    window.alert(error.message||"Impossibile leggere il CSV.");
  }
}

function renderWorkspace(){
  $("workspace").hidden=false;
  $("fileName").textContent=state.fileName;
  const delimiter=state.data.delimiter==="\t"?"TAB":state.data.delimiter;
  $("sourceMeta").textContent=state.data.rows.length+" righe · "+state.data.headers.length+" colonne · separatore "+delimiter;
  renderMapping();
  runTransform();
  $("workspace").scrollIntoView({behavior:"smooth",block:"start"});
}
function renderMapping(){
  const host=$("mappingRows");
  clear(host);
  core.TARGETS.forEach(target=>{
    const row=make("div","mapping-row");
    const label=make("div","target-label");
    label.append(make("strong","",target.label));
    label.append(make("small","",target.required?"OBBLIGATORIO":"OPZIONALE"));
    const arrow=make("span","arrow","→");
    const select=make("select");
    select.dataset.target=target.key;
    select.dataset.required=String(target.required);

    const empty=make("option","","— non mappato —");
    empty.value="";
    select.append(empty);
    state.data.headers.forEach(header=>{
      const option=make("option","",header);
      option.value=header;
      select.append(option);
    });

    select.value=state.mapping[target.key]||"";
    select.classList.toggle("unmapped",target.required&&!select.value);
    select.addEventListener("change",()=>{
      state.mapping[target.key]=select.value||null;
      select.classList.toggle("unmapped",target.required&&!select.value);
      runTransform();
    });
    row.append(label,arrow,select);
    host.append(row);
  });
}

function currentDefaults(){
  return {
    iva:$("defaultIva").value.trim()||"22",
    disponibilita:$("defaultStock").value.trim()||"0",
    categoria:$("defaultCategory").value.trim()||"Non categorizzato"
  };
}
function runTransform(){
  if(!state.data) return;
  state.defaults=currentDefaults();
  state.result=core.transform(state.data.rows,state.data.headers,state.mapping,state.defaults);
  renderKpis();
  renderPreview();

  const banner=$("limitBanner");
  banner.hidden=!state.data.truncated;
  if(state.data.truncated){
    banner.textContent="Il file supera il limite demo: vengono elaborate le prime 10.000 righe.";
  }

  const exportable=state.result.records.filter(record=>record.status!=="error").length;
  $("exportBtn").disabled=exportable===0;
  $("exportBtn").textContent="Esporta CSV · "+exportable;
}

function renderKpis(){
  $("kpiTotal").textContent=state.result.stats.total;
  $("kpiValid").textContent=state.result.stats.valid;
  $("kpiWarning").textContent=state.result.stats.warning;
  $("kpiError").textContent=state.result.stats.error;
  document.querySelectorAll(".kpi").forEach(button=>{
    button.classList.toggle("active",button.dataset.filter===state.filter);
  });
}

function formatValue(target,value){
  if(value==null) return "—";
  if(target==="prezzo"){
    return Number(value).toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2})+" €";
  }
  if(target==="iva") return String(value)+"%";
  return String(value);
}
function renderPreview(){
  const body=$("previewBody");
  clear(body);

  const visible=state.result.records.filter(record=>{
    return state.filter==="all"||record.status===state.filter;
  });
  const shown=visible.slice(0,core.LIMITS.previewRows);
  $("previewCount").textContent=shown.length+" di "+visible.length+" righe";

  shown.forEach(record=>{
    const tr=document.createElement("tr");
    const statusTd=document.createElement("td");
    statusTd.append(make(
      "span",
      "status-pill "+record.status,
      record.status==="valid"?"PRONTA":record.status==="warning"?"WARNING":"ERRORE"
    ));
    tr.append(statusTd);

    ["sku","nome","prezzo","iva","disponibilita","categoria"].forEach(key=>{
      const td=document.createElement("td");
      td.textContent=formatValue(key,record.values[key]);
      tr.append(td);
    });

    const issuesTd=document.createElement("td");
    const list=make("div","issue-list");
    if(!record.issues.length){
      list.append(make("span","issue","Nessuna anomalia"));
    }
    record.issues.slice(0,3).forEach(issue=>{
      list.append(make("span","issue "+issue.severity,issue.message));
    });
    if(record.issues.length>3){
      list.append(make("span","issue","+"+(record.issues.length-3)+" altre"));
    }
    issuesTd.append(list);
    tr.append(issuesTd);
    body.append(tr);
  });

  if(!shown.length){
    const tr=document.createElement("tr");
    const td=document.createElement("td");
    td.colSpan=8;
    td.textContent="Nessuna riga per questo filtro.";
    tr.append(td);
    body.append(tr);
  }
}
function downloadCSV(){
  if(!state.result) return;
  const csv="\uFEFF"+core.toCSV(state.result);
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;
  link.download="importflow-normalizzato.csv";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),500);
}

function reset(){
  state.fileName="";
  state.data=null;
  state.mapping={};
  state.result=null;
  state.filter="all";
  $("workspace").hidden=true;
  $("fileInput").value="";
  window.scrollTo({top:0,behavior:"smooth"});
}

$("sampleBtn").addEventListener("click",()=>{
  loadText(SAMPLE_CSV,"listino-fornitore-demo.csv");
});

$("fileInput").addEventListener("change",event=>{
  const file=event.target.files&&event.target.files[0];
  if(!file) return;
  decodeFile(file)
    .then(text=>loadText(text,file.name))
    .catch(error=>window.alert(error.message));
});
$("resetBtn").addEventListener("click",reset);
$("exportBtn").addEventListener("click",downloadCSV);

["defaultIva","defaultStock","defaultCategory"].forEach(id=>{
  $(id).addEventListener("input",()=>{
    if(state.data) runTransform();
  });
});

document.querySelectorAll(".kpi").forEach(button=>{
  button.addEventListener("click",()=>{
    state.filter=button.dataset.filter;
    renderKpis();
    renderPreview();
  });
});

if(new URLSearchParams(window.location.search).get("demo")==="1"){
  loadText(SAMPLE_CSV,"listino-fornitore-demo.csv");
}
