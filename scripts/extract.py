"""Estrae testi (IT/EN), tab e immagini dalle 8 pagine del vecchio sito di Michele Motta.

Uso: python3 -I extract.py <repo_dir> <out_json>
Solo libreria standard. Non esegue nulla del repo: lo legge come testo.
"""
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

PAGES = [
    "index.html", "titina.html", "mondo-fuori.html", "luddovio.html",
    "gettin-busy.html", "numero-magazine.html", "italian-realism.html",
    "gentleman-oliviero-toscani.html",
]
VOID = {"img", "br", "input", "meta", "link", "hr", "source", "wbr"}
# contenitori di interfaccia comune (menu, barra progetti, contatti): testi da ignorare
CHROME_IDS = {"mainNav", "projectBar", "contactsPanel", "contactsBackdrop"}


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []          # [(tag, id, class)]
        self.items = []          # sequenza ordinata di testi / immagini / link
        self.tabs = []
        self.panel_text = {}     # testo libero dentro pannelli (es. FILATI)
        self.style = []
        self._in_style = False
        self._in_script = False

    def _ids(self):
        return [i for _, i, _ in self.stack if i]

    def _classes(self):
        return [c for _, _, c in self.stack if c]

    def _in_chrome(self):
        return any(i in CHROME_IDS for i in self._ids())

    def _panel(self):
        # due convenzioni nel vecchio sito: id="panel-outfit" oppure id="outfitPanel"
        for i in reversed(self._ids()):
            if i.startswith("panel-"):
                return i[len("panel-"):]
            if i.endswith("Panel") and i != "contactsPanel":
                return i[: -len("Panel")]
        return None

    def _zone(self):
        ids, classes = self._ids(), " ".join(self._classes())
        if self._panel():
            return "panel:" + self._panel()
        if "imageScroll" in ids or "image-column" in classes or "gallery-section" in classes:
            return "intro"
        if "lineup" in classes.lower() or "line-up" in classes.lower():
            return "lineup"
        return "body"

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "style":
            self._in_style = True
        if tag == "script":
            self._in_script = True
        if tag == "div" and "tab" in (a.get("class") or "").split():
            m = re.search(r"openPanel\('([^']+)'\)", a.get("onclick") or "")
            panel = a.get("data-panel") or (m.group(1) if m else None)
            if panel:
                self.tabs.append({"panel": panel, "label": None})
        if not self._in_chrome():
            if tag == "img":
                self.items.append({"kind": "img", "zone": self._zone(), "src": a.get("src"), "alt": a.get("alt")})
            elif "data-it" in a:
                self.items.append({"kind": "text", "tag": tag, "zone": self._zone(), "it": a.get("data-it"), "en": a.get("data-en")})
            elif tag == "a" and a.get("href"):
                self.items.append({"kind": "link", "zone": self._zone(), "href": a["href"]})
        if tag not in VOID:
            self.stack.append((tag, a.get("id"), a.get("class")))

    def handle_endtag(self, tag):
        if tag == "style":
            self._in_style = False
        if tag == "script":
            self._in_script = False
        for k in range(len(self.stack) - 1, -1, -1):
            if self.stack[k][0] == tag:
                del self.stack[k:]
                break

    def handle_data(self, data):
        if self._in_style:
            self.style.append(data)
            return
        if self._in_script or self._in_chrome():
            return
        text = data.strip()
        if not text:
            return
        top_class = (self.stack[-1][2] or "") if self.stack else ""
        if "tab" in top_class.split() and self.tabs and self.tabs[-1]["label"] is None:
            self.tabs[-1]["label"] = text
            return
        panel = self._panel()
        if panel:
            self.panel_text.setdefault(panel, []).append(text)
        else:
            self.items.append({"kind": "data", "tag": self.stack[-1][0] if self.stack else None, "zone": self._zone(), "text": text})


def main(repo_dir, out_path):
    repo = Path(repo_dir)
    result = {}
    for name in PAGES:
        p = PageParser()
        p.feed((repo / name).read_text(encoding="utf-8"))
        css = "".join(p.style)
        result[name] = {
            "tabs": p.tabs,
            "panel_text": p.panel_text,
            "items": p.items,
            "css_colors": sorted(set(re.findall(r"#[0-9a-fA-F]{6}\b", css))),
        }
    Path(out_path).write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    for name, d in result.items():
        imgs = [i for i in d["items"] if i["kind"] == "img"]
        texts = [i for i in d["items"] if i["kind"] == "text"]
        print(f"{name:34s} img={len(imgs):3d} testi={len(texts):3d} tab={[t['label'] for t in d['tabs']]}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
