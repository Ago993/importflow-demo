# ImportFlow

ImportFlow è una demo browser-only che mostra come automatizzare il passaggio manuale tra sistemi già esistenti.

## Cosa fa

- importa CSV con separatore punto e virgola, virgola, TAB o pipe;
- riconosce intestazioni comuni e propone la mappatura verso un tracciato standard;
- normalizza SKU, nome, prezzo, IVA, disponibilità e categoria;
- gestisce numeri italiani come `1.234,56`;
- segnala righe valide, warning ed errori;
- individua SKU duplicati;
- esporta un CSV normalizzato escludendo le righe bloccanti;
- protegge l'export dalla spreadsheet formula injection;
- elabora tutto localmente nel browser.
## Posizionamento

La demo non sostituisce ERP, gestionali o software verticali. Mostra invece come si può automatizzare il lavoro residuo tra un export e il sistema successivo.

Esempio:

`gestionale / fornitore -> CSV -> controllo manuale -> adattamento colonne -> nuovo import`

ImportFlow automatizza il tratto centrale.

## Demo

Usa **Carica dati di esempio** per vedere subito un dataset volutamente sporco con valori mancanti, duplicati, formati italiani e righe non valide.

## Limiti demo

- massimo 5 MB;
- massimo 10.000 righe;
- preview limitata alle prime 100 righe del filtro selezionato;
- input CSV soltanto;
- schema di destinazione fisso;
- nessun backend e nessuna persistenza.
## Sviluppo

```bash
node --check core.js
node --check app.js
node tests/test_core.js
node tests/test_security.js
```

Stack: HTML, CSS e JavaScript vanilla. Nessuna dipendenza runtime.

## Sicurezza

Vedi [SECURITY.md](SECURITY.md) per limiti, CSP e protezioni dell'export.

## Nota

ImportFlow è un nome demo/provvisorio e non rappresenta una verifica di disponibilità del marchio.
