# Security

ImportFlow è una demo statica e browser-only.

## Superficie

Non contiene:

- database;
- autenticazione;
- API server;
- tracking;
- upload verso servizi esterni.

Il Content Security Policy imposta `connect-src 'none'` e lo script dinamico usa `createElement` / `textContent` per i dati provenienti dai CSV.

## Protezioni implementate

- limite file: 5 MB;
- limite righe: 10.000;
- limite colonne: 100;
- limite singolo campo: 10.000 caratteri;
- nessun uso di `innerHTML` con dati del file;
- neutralizzazione di celle che iniziano con `=`, `+`, `-`, `@`, TAB o CR nell'export testuale;
- righe con errori bloccanti escluse dall'export;
- CSP restrittiva tramite meta tag.

## Limite della CSP

Su GitHub Pages la CSP è fornita come meta tag e non come header HTTP. Per un prodotto di produzione sarebbe preferibile configurarla a livello server/header.

## Segnalazioni

Per questa demo portfolio, eventuali problemi possono essere aperti nel repository GitHub associato.
