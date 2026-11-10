# Michele Motta — portfolio

Portfolio di Michele Motta, fashion & knitwear designer: [www.michlemotta.com](https://www.michlemotta.com) (attenzione: «michle», senza la *e*).

Sito statico in [Astro](https://astro.build) con 8 pagine: homepage, 4 progetti (Titina, Mondo Fuori, Luddovio, Gettin’ Busy) e 3 editoriali (Numero Magazine, Italian Realism, Gentleman – Oliviero Toscani). Testi in italiano con pulsante IT/EN. Ospitato su Vercel.

## Avvio in locale

Serve **Node.js 22.12 o superiore** (vedi `engines` in `package.json`).

```sh
npm install
npm run dev       # anteprima su http://localhost:4321
npm run build     # sito finale in dist/
npm run preview   # controlla la build in locale
```

## Dove modificare i contenuti

| Cosa | Dove |
| --- | --- |
| Testi, ordine, immagini e link dei 7 lavori | `src/data/projects.json` |
| Bio, percorso, contatti, testi della homepage | `src/data/site.json` |
| Immagini | `src/assets/img/<progetto>/` |
| Etichette dell’interfaccia (menu, pulsanti…) | `src/lib/i18n.ts` |

- Ogni testo bilingue è una coppia `{ "it": "…", "en": "…" }`; nei paragrafi si possono usare `<b>` ed `<em>`.
- Le immagini si indicano con il percorso relativo a `src/assets/img`, per esempio `"gentleman/gallery-01.png"`. Astro le converte da solo in WebP alle varie misure: basta caricare l’originale (JPG o PNG).
- Per aggiungere una foto a un editoriale: copia il file in `src/assets/img/<progetto>/` e aggiungi il percorso all’elenco `gallery` del lavoro. Le foto orizzontali occupano tutta la larghezza, le verticali vanno su due colonne sfalsate. Testo alternativo e didascalia si scrivono in `src/components/editorial/EditorialGallery.astro`.
- Il campo `next` decide quale lavoro compare in fondo alla pagina come «Progetto successivo».

## Figure scontornate (cartelle `modelli/`)

I look della line-up interattiva sono PNG con sfondo trasparente in `src/assets/img/<progetto>/modelli/`, collegati in `projects.json` → `lineup.models`. Per rigenerarli o aggiungerne uno:

1. ritaglia la singola figura dalla tavola di line-up del progetto (le tavole sono elencate in `lineup.plates`);
2. rendi trasparente lo sfondo bianco (Photoshop, lo strumento «Alfa istantaneo» di Anteprima su macOS o un qualsiasi servizio di rimozione sfondo);
3. esporta in PNG con **le stesse dimensioni in pixel** delle altre figure dello stesso progetto (così restano allineate) e con il nome `look-NN-fronte.png`, `look-NN-retro.png` o `look-NN-figurino.png`;
4. sostituisci il file nella cartella `modelli/`, oppure aggiungi la voce in `lineup.models` se è un look nuovo.

## Deploy su Vercel

- Ogni push su `main` pubblica il sito in **produzione**; ogni altro branch crea un’**anteprima** con un suo indirizzo.
- La configurazione è in `vercel.json`: framework Astro, build `npm run build`, cartella `dist`, URL senza `.html` (`/titina` come nel vecchio sito), cache lunga per i file in `/_astro/` e redirect da `/rione` a `/numero-magazine`.
- Nelle impostazioni del progetto Vercel (*Settings → Build and Deployment → Node.js Version*) la versione di Node deve essere **22.x o superiore**.
- `sitemap.xml` e `robots.txt` escono con la build; il dominio è impostato in `astro.config.mjs` (`site`).

## Struttura

```
src/
  data/          contenuti (projects.json, site.json)
  assets/img/    immagini originali, una cartella per lavoro
  components/    header, footer, pagine progetto ed editoriale, lightbox
  layouts/       Base.astro: layout comune con meta e Open Graph
  pages/         index, [slug] (i 7 lavori), 404, sitemap.xml
  scripts/       lingua IT/EN, menu, comparse allo scroll
  styles/        global.css: colori, caratteri, spaziature
public/          favicon.svg, robots.txt
```
