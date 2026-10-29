# IdroCondotta VVF

App web per il **calcolo e la verifica delle staffette idrauliche** (condotte) dei Vigili del Fuoco: profilo plano-altimetrico, linea piezometrica, perdite di carico, manichette e motopompe in serie.

Nata per l'uso in campo: interfaccia **mobile-first**, in italiano, con report stampabile in PDF da allegare al rapporto d'intervento.

**App online: <https://mattnan.github.io/idrocondotta-vvf/>** — si apre dal telefono e con "Aggiungi a schermata Home" diventa un'app a sé. Dopo la prima apertura **funziona anche senza rete**: il service worker tiene in cache tutta l'applicazione (montagna, zone bianche).

## Funzioni principali

- **Profilo plano-altimetrico**: inserimento manuale dei punti, importazione da CSV/Excel, rilievo GPS live con mappa del percorso.
- **Calcolo idraulico**: Hazen-Williams con percentuale di perdite localizzate, controllo pressione minima/massima, velocità e perdita per 100 m.
- **Peli liberi**: partenza o aspirazione da vascone/fiume/vasca (H_asp); ogni pelo libero spezza l'impianto in tratti indipendenti, ognuno con la sua curva, e vale il tratto più debole.
- **Motopompe in serie**: catalogo macchine (portata/prevalenza), modalità *in diretta* o *aspirazione a pelo libero*, ΔP regolata dall'operatore (o MAX).
- **Manichette**: conteggio rotoli (spezzone 20 m o 30 m) per tratto fra peli liberi e per macchina.
- **Piezometrica e curva di impianto**: portata che l'impianto riesce davvero a muovere, prevalenza richiesta, margine alla lancia.
- **Sicurezza**: registro allarmi (pressione alta, scoppio manichetta, depressione/collasso, pressione insufficiente) con consigli operativi di posa.
- **Report stampabile** con tabella macchine, manichette, KPI e grafico a misura di foglio A4.
- **Offline (PWA)**: installabile sulla schermata Home, funziona senza connessione dopo la prima apertura.
- **Scenari di esempio**: incendio boschivo a staffetta mista, rifornimento da fiume a grande portata, linea su colle, relay reale a 7 motopompe su 2,5 km.

## Avvio

```bash
npm install
npm run dev      # sviluppo su http://localhost:3000
npm run build    # build di produzione (tsc + vite) in dist/
npm run preview  # anteprima della build
```

## Tecnologie

React 19 · TypeScript · Vite 6 · Tailwind CSS 4 · Chart.js (+ annotation) · PapaParse · SheetJS · lucide-react

## Struttura

```
src/
  engine/      calcolo idraulico, curva di impianto, conteggio manichette, catalogo pompe
  components/  pannelli, grafico piezometrico, report, import/export
  utils/       parser CSV/Excel, modello dei nodi, GPS
  data/        scenari di esempio
  types/       tipi condivisi
```

## Modello CSV

Il modello scaricabile dall'app ha due sezioni:

1. `# SEZIONE 1 - POMPE E VASCHE`: progressiva, quota, tipo, modello pompa, modalità (`direct` / `vascone_suction`), altezza di aspirazione, ΔP regolata, note.
2. `# SEZIONE 2 - PROFILO PLANO-ALTIMETRICO`: progressiva, quota, latitudine, longitudine, note.

All'import l'intestazione delle sezioni è tollerante (`pomp`, `vasc`, `macchin`, `equip`, `dotazion`), mentre le righe di tipo `vascone` (vecchio formato) vengono scartate: il pelo libero ora si dichiara sulla pompa come `vascone_suction`.

## Nota

Progetto a uso operativo: i risultati vanno sempre verificati sul posto dall'operatore.
