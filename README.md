# LlamaDock-Benchmarks

Öffentliche Ergebnisseite der [LlamaDock](https://github.com/Torim98/LlamaDock)-Benchmarks:
lokale Modelle auf einer RTX 4090, dieselben Aufgaben, dieselbe Messung — mit den erzeugten
Artefakten zum Anschauen (die Snake-Spiele und Landingpages laufen direkt in der Seite).

Dieses Repo enthält **nur die fertige Seite**. Erzeugt wird sie aus LlamaDock (privat):

```bash
node scripts/export-site.mjs
```

Der Export schreibt `index.html`, `app.js`, `style.css` und `data/` hierher. Er nimmt
ausschließlich freigegebene Läufe und bricht ab, wenn in den Daten ein Home-Pfad, der
Benutzername, eine Tailscale-IP, eine E-Mail-Adresse oder ein Token auftaucht.
System-Prompt-Texte werden nur mit ausdrücklichem Häkchen am Lauf mitveröffentlicht,
Tool-Protokolle (`events.jsonl`) nie.

Danach hier committen und pushen; der Workflow `.github/workflows/pages.yml` veröffentlicht
den Stand auf GitHub Pages (Settings → Pages → Source „GitHub Actions“).

## Aufbau

| Pfad | Inhalt |
|---|---|
| `index.html`, `app.js`, `style.css` | die statische Seite (kein Build) |
| `data/index.json` | Übersicht: Modelle, Szenarien, beste Läufe |
| `data/runs/<id>/` | ein Lauf: `run.json`, Screenshots, erzeugte Dateien |
| `data/external.json` | fremde Benchmarkwerte mit Quelle und Datum |
