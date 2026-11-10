"""Genera src/data/projects.json e src/data/site.json per il sito Astro.

Uso: python3 -E build_data.py <raw_content.json> <manifest.json> <repo_dir>
Testi IT/EN presi dal vecchio sito (raw_content), immagini dal manifest (percorsi
relativi a src/assets/img), modelli scontornati da src/assets/img/<slug>/modelli.
"""
import json
import re
import sys
from pathlib import Path

ORDER = ["titina", "mondo-fuori", "luddovio", "gettin-busy", "numero-magazine", "italian-realism", "gentleman-oliviero-toscani"]
PAGE = {s: (s if s != "gentleman-oliviero-toscani" else "gentleman-oliviero-toscani") + ".html" for s in ORDER}
IMGDIR = {"gentleman-oliviero-toscani": "gentleman"}

META = {
    "titina": dict(type="project", title="Titina", accent="#B29D4D", year="2023/24",
                   kind={"it": "Tesi di laurea", "en": "Bachelor thesis"}, tags=["Collezioni", "Knitwear", "Tesi"],
                   role={"it": "Designer", "en": "Designer"},
                   excerpt={"it": "Una ricerca sull’influenza reciproca di moda e sport dagli anni ’90: lo sportswear esce dal campo e diventa linguaggio quotidiano, spinto da icone come Michael Jordan, Tupac Shakur e le Spice Girls.",
                            "en": "A study of how fashion and sport have shaped each other since the ’90s: sportswear leaves the pitch and becomes an everyday language, driven by icons like Michael Jordan, Tupac Shakur and the Spice Girls."}),
    "mondo-fuori": dict(type="project", title="Mondo Fuori", accent="#9C6B43", year="2023/24",
                        kind={"it": "Collezione knitwear", "en": "Knitwear collection"}, tags=["Collezioni", "Knitwear"],
                        role={"it": "Designer (progetto di gruppo)", "en": "Designer (group project)"},
                        excerpt={"it": "Una riflessione su confine, pelle e protezione. Otto outfit costruiti con superfici tattili e trattamenti sperimentali, per tradurre in materia emozioni e tensioni contemporanee.",
                                 "en": "A reflection on boundaries, skin and protection. Eight outfits built from tactile surfaces and experimental treatments, turning contemporary emotions and tensions into material."}),
    "luddovio": dict(type="project", title="Luddovio", accent="#39D7FC", year="2023/24",
                     kind={"it": "Capsule collection", "en": "Capsule collection"}, tags=["Collezioni"],
                     role={"it": "Designer (progetto di gruppo)", "en": "Designer (group project)"},
                     excerpt={"it": "Quattordici outfit per una collaborazione immaginaria tra Jonathan Anderson e Mares: il neoprene e i dettagli della subacquea portati nello spazio urbano, con ironia e volumi inattesi.",
                              "en": "Fourteen outfits for an imaginary collaboration between Jonathan Anderson and Mares: neoprene and diving details brought into the city, with irony and unexpected volumes."}),
    "gettin-busy": dict(type="project", title="Gettin’ Busy", accent="#F44EDB", year="2023/24",
                        kind={"it": "Progetto personale", "en": "Personal project"}, tags=["Collezioni"],
                        role={"it": "Designer", "en": "Designer"},
                        excerpt={"it": "Una micro-capsule come esercizio di stile e ritmo visivo: stratificazione, ripetizione e segno grafico su silhouette pragmatiche, in dialogo con l’immaginario urbano contemporaneo.",
                                 "en": "A micro-capsule as an exercise in style and visual rhythm: layering, repetition and graphic marks on pragmatic silhouettes, in dialogue with contemporary urban imagery."}),
    "numero-magazine": dict(type="editorial", title="Numero Magazine", accent="#C8B79A", year="Università",
                            kind={"it": "Fashion photography", "en": "Fashion photography"}, tags=["Editoriali", "Fashion photography"],
                            role={"it": "Direzione artistica, casting, concept", "en": "Art direction, casting, concept"},
                            excerpt={"it": "La costruzione di una rivista dall’interno: concept visivo, casting e sequenza narrativa per capire come ritmo, layout e fotografia raccontano insieme una storia di moda.",
                                     "en": "Building a magazine from the inside: visual concept, casting and narrative sequence, to understand how rhythm, layout and photography tell a fashion story together."}),
    "italian-realism": dict(type="editorial", title="Italian Realism", accent="#C8B79A", year="The Mode",
                            kind={"it": "Editoriale", "en": "Editorial"}, tags=["Editoriali", "Styling"],
                            role={"it": "Stylist", "en": "Stylist"},
                            article={"label": "The Mode – Snob Non per Tutti", "href": "https://www.snobnonpertutti.it/themode/italian-realism/77182"},
                            excerpt={"it": "Una sensibilità contemporanea radicata nella cultura italiana: eleganza essenziale, contesti reali, dettagli che parlano di quotidiano.",
                                     "en": "A contemporary sensibility rooted in Italian culture: essential elegance, real settings, details that speak of everyday life."}),
    "gentleman-oliviero-toscani": dict(type="editorial", title="Gentleman", subtitle="Oliviero Toscani", accent="#C8B79A", year="Oliviero Toscani",
                                       kind={"it": "Editoriale", "en": "Editorial"}, tags=["Editoriali", "Styling"],
                                       role={"it": "Stylist", "en": "Stylist"},
                                       article={"label": "Milano Finanza – Gentleman", "href": "https://www.milanofinanza.it/news/oliviero-toscani-e-gentleman-le-ultime-foto-scattate-dal-maestro-della-fotografia-202501141204327777"},
                                       excerpt={"it": "Uno degli ultimi shooting del maestro Oliviero Toscani: una direzione provocatoria e lucidissima, con il lavoro di styling al servizio della forza comunicativa degli scatti.",
                                                "en": "One of the last shoots by master photographer Oliviero Toscani: a provocative, razor-sharp direction, with styling at the service of the images’ communicative power."}),
}

TAB_EN = {"moodboard": "Moodboard", "outfit": "Outfit", "silhouette": "Silhouette", "telini": "Fabric swatches",
          "tecnici": "Technical drawings", "filati": "Yarns", "shooting": "Shooting", "schede": "Technical sheets",
          "magazine": "Magazine", "approfondimenti": "Insights"}
SIDE = {"fronte": {"it": "Fronte", "en": "Front"}, "retro": {"it": "Retro", "en": "Back"}, "figurino": {"it": "Figurino", "en": "Sketch"}}

COMP_EN = [("lana vergine", "virgin wool"), ("lana merino", "merino wool"), ("lana", "wool"), ("cotone", "cotton"),
           ("poliestere", "polyester"), ("poliammide", "polyamide"), ("viscosa", "viscose"), ("cellulosa", "cellulose"),
           ("seta", "silk"), ("microfibra", "microfiber"), ("elastomero", "elastomer")]


def comp(it):
    en = it
    for a, b in COMP_EN:
        en = re.sub(rf"\b{a}\b", b, en)
    return {"it": it, "en": en}


FILATI = {
    "titina": {
        "intro": {"it": "I filati selezionati per il progetto di tesi <em>Titina</em> rappresentano un equilibrio tra ricerca tecnica e resa estetica. Colori primari, contrasti netti e materiali misti sono stati scelti per sostenere la narrazione progettuale e dare coerenza alla collezione.",
                  "en": "The yarns selected for the <em>Titina</em> thesis project strike a balance between technical research and aesthetic result. Primary colours, sharp contrasts and mixed materials were chosen to support the project’s narrative and give the collection coherence."},
        "rows": [("Sesia, biocable black", "NM 6700", "100% CO"), ("Lane Cardate, Canberra black", "1/15.5 NM", "100% cotone"),
                 ("Filato black", "—", "100% CO"), ("LineaPiù, Angie black", "NM 35000", "75% VI – 25% PL"),
                 ("Filato green", "—", "70% CO – 30% PL"), ("LineaPiù, Angie black", "NM 34000", "75% VI – 25% PL"),
                 ("LineaPiù, Angie yellow", "NM 34000", "75% VI – 25% PL"), ("LineaPiù, Angie heavy yellow", "NM 34000", "75% VI – 25% PL"),
                 ("Filato yellow", "—", "100% cotone"), ("LineaPiù, Angie green", "NM 34000", "75% VI – 25% PL"),
                 ("Filato Loro Piana black", "—", "—"), ("Filato lana & arcobaleno black", "—", "100% CO")],
    },
    "mondo-fuori": {
        "intro": {"it": "I filati selezionati per questa collezione rappresentano un equilibrio tra tradizione artigianale, sperimentazione tattile e sostenibilità. Dalla lana vergine al cashmere, passando per misti tecnici e fibre naturali, ogni filato è stato scelto per esprimere al meglio la sensazione del paesaggio a cui si ispira.",
                  "en": None},  # preso dal vecchio sito più sotto
        "rows": [({"it": "marrone panta", "en": "brown panta"}, "Zegna Baruffa – NM 2/48000", "100% lana vergine"),
                 ({"it": "marrone 1", "en": "brown 1"}, "NM 2/50000", "100% lana"),
                 ({"it": "marrone 2 (in uni)", "en": "brown 2 (uni)"}, "Zegna Baruffa – NM 2/48000", "100% lana vergine"),
                 ({"it": "bianco bouclé", "en": "white bouclé"}, "NM 2/16000", "50% cotone, 50% poliestere"),
                 ({"it": "neve fresca", "en": "fresh snow"}, "Mondial – NM 5000", "80% lana merino, 20% microfibra"),
                 ("sottobosco", "Zegna Baruffa – NM 2/48000", "100% lana vergine"), ("sottobosco", "NM 2/48000", "100% lana"),
                 ("cellulosa", "NM 1250", "100% cellulosa"),
                 ({"it": "melange marrone maglietta", "en": "brown melange t-shirt"}, "NM 2/50000", "100% cotone"),
                 ("Lanari", "NM 10000", "80% skid mohair, 20% poliammide"), ("Filart", "NM 40000", "100% cotone"),
                 ("Cariaggi", "NM 2/28000", "100% cashmere"), ("Fullonica SNC", "NM 2/60000", "100% lana"),
                 ("Gruppo Filpucci", "NM 40000", "100% cotone"), ("Prisma Ricerche", "NM 2/35", "83% viscosa, 17% poliestere"),
                 ("Lafil", "NM 44000", "100% poliestere"), ("Manifatture Tessili Biellesi", "NM 4/1000000", "100% cotone"),
                 ("—", "NM 40000", "100% cotone"), ("—", "NM 38000", "7% elastomero, 83% poliammide"),
                 ("Kypritzu", "NM 60000", "100% poliestere"), ("—", "NM 40000", "50% poliestere, 50% cotone"),
                 ("Lurex", "NM 65000", "100% poliestere"), ("—", "NM 44000", "100% poliestere"),
                 ("Lineapiù Italia S.P.A.", "NM 16000", "100% cotone"), ("Cariaggi", "NM 2/56000", "70% cashmere, 30% seta")],
    },
}


def bi(it, en=None):
    return {"it": it, "en": en if en else it}


def main(raw_path, manifest_path, repo):
    raw = json.loads(Path(raw_path).read_text(encoding="utf-8"))
    man = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
    repo = Path(repo)
    img_root = repo / "src/assets/img"
    rel = lambda p: str(Path(p).relative_to(img_root))
    imgs = {}
    for m in man:
        if m.get("ok"):
            imgs.setdefault(m["page"], []).append(m)

    projects = []
    for i, slug in enumerate(ORDER):
        page = PAGE[slug]
        r, meta = raw[page], META[slug]
        texts = [t for t in r["items"] if t["kind"] == "text"]
        h2 = next((t for t in texts if t["tag"] == "h2"), None)
        paras = [bi(t["it"], t["en"]) for t in texts if t["tag"] == "p" and t["zone"] in ("intro", "body")]
        by_zone = {}
        for m in imgs.get(page, []):
            by_zone.setdefault(m["zone"], []).append(rel(m["new_path"]))
        p = {"slug": slug, "order": i + 1, **{k: v for k, v in meta.items()}}
        p["context"] = bi(h2["it"], h2["en"]) if h2 else bi("")
        p["paragraphs"] = paras
        nice = lambda s: s[:1].upper() + s[1:].lower()
        if meta["type"] == "project":
            p["intro"] = by_zone.get("intro", [])
            plates = by_zone.get("lineup", []) or ([by_zone["outfit"][0]] if slug == "gettin-busy" else [])
            mdir = img_root / slug / "modelli"
            models = []
            for f in sorted(mdir.glob("look-*.png")):
                mm = re.match(r"look-(\d+)-(\w+)\.png", f.name)
                models.append({"src": rel(f), "look": int(mm.group(1)), "side": SIDE[mm.group(2)]})
            p["lineup"] = {"plates": plates, "models": models}
            tabs = []
            for t in r["tabs"]:
                tid = t["panel"]
                tab = {"id": tid, "label": bi(nice(t["label"]), TAB_EN.get(tid)), "images": by_zone.get(tid, [])}
                if tid == "magazine":
                    tab["spread"] = True
                tabs.append(tab)
            p["tabs"] = tabs
            if slug in FILATI:
                f = FILATI[slug]
                intro = f["intro"]
                if intro["en"] is None:
                    intro = next((bi(t["it"], t["en"]) for t in texts if t["zone"] == "panel:filati" and t["tag"] == "p"), bi(intro["it"]))
                rows = []
                for name, nm, c in f["rows"]:
                    rows.append({"name": name if isinstance(name, dict) else bi(name), "nm": nm, "comp": comp(c)})
                p["filati"] = {"intro": intro, "rows": rows}
        else:
            p["gallery"] = by_zone.get("gallery", [])
        p["cover"] = (p.get("intro") or p.get("gallery"))[0]
        projects.append(p)
    for i, p in enumerate(projects):
        p["next"] = projects[(i + 1) % len(projects)]["slug"]

    home = raw["index.html"]
    ht = [t for t in home["items"] if t["kind"] == "text"]
    about = [bi(t["it"], t["en"]) for t in ht if t["tag"] == "span"]
    tagline = next(bi(t["it"], t["en"]) for t in ht if "appassionato" in t["it"])
    site = {
        "name": "Michele Motta",
        "role": bi("fashion & knitwear designer"),
        "tagline": tagline,
        "aboutTitle": bi("Fashion designer siciliano, con la maglieria nelle mani e la cultura visiva negli occhi.",
                         "A Sicilian fashion designer, with knitwear in his hands and visual culture in his eyes."),
        "about": about,
        "portrait": rel(next(m["new_path"] for m in imgs["index.html"] if "IMG_2624" in m["old_src"])),
        "heroImage": rel(next(m["new_path"] for m in imgs["index.html"] if "tesi-97" in m["old_src"])),
        "tags": ["Collezioni", "Knitwear", "Editoriali", "Styling", "Fashion photography", "Tesi"],
        "tagsEn": {"Collezioni": "Collections", "Knitwear": "Knitwear", "Editoriali": "Editorials", "Styling": "Styling",
                   "Fashion photography": "Fashion photography", "Tesi": "Thesis"},
        "path": [
            {"title": "Politecnico di Milano", "text": bi("Laurea triennale in Design della Moda — specializzazione Knitwear Design. Tesi “Titina”, A.A. 2023/2024.",
                                                          "Bachelor’s degree in Fashion Design — Knitwear Design specialisation. Thesis “Titina”, academic year 2023/2024.")},
            {"title": "Rinascente Milano", "text": bi("Visual merchandiser in ambito retail.", "Visual merchandiser in retail.")},
            {"title": "Styling editoriale", "titleEn": "Editorial styling",
             "text": bi("Stylist con Tommaso Basilio per The Mode / Snob Non per Tutti e Gentleman, con la direzione di Oliviero Toscani.",
                        "Stylist alongside Tommaso Basilio for The Mode / Snob Non per Tutti and Gentleman, directed by Oliviero Toscani.")},
        ],
        "contacts": {
            "email": "michelemotta2001@gmail.com",
            "phone": "+39 346 528 8836",
            "phoneHref": "tel:+393465288836",
            "linkedin": "https://www.linkedin.com/in/michele-motta-a1885b266",
            "instagram": "https://www.instagram.com/_michelemotta_",
            "instagramHandle": "@_michelemotta_",
        },
    }
    out = repo / "src/data"
    out.mkdir(parents=True, exist_ok=True)
    (out / "projects.json").write_text(json.dumps(projects, ensure_ascii=False, indent=1), encoding="utf-8")
    (out / "site.json").write_text(json.dumps(site, ensure_ascii=False, indent=1), encoding="utf-8")
    for p in projects:
        extra = f"intro={len(p.get('intro', []))} lineup={len(p.get('lineup', {}).get('plates', []))}+{len(p.get('lineup', {}).get('models', []))} tabs={[(t['id'], len(t['images'])) for t in p.get('tabs', [])]}" if p["type"] == "project" else f"gallery={len(p['gallery'])}"
        print(f"{p['slug']:28s} paras={len(p['paragraphs'])} {extra}")


if __name__ == "__main__":
    main(*sys.argv[1:4])
