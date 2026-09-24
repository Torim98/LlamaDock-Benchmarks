# LlamaDock-Benchmarks

Öffentliche Ergebnisseite der [LlamaDock](https://github.com/Torim98/LlamaDock)-Benchmarks:
lokale Modelle auf einer RTX 4090, dieselben Aufgaben, dieselbe Messung — mit Leaderboard,
Rankings nach Anwendungsfall und den erzeugten Artefakten zum Anschauen (die Spiele und
Webseiten laufen direkt in der Seite).

**Seite:** https://torim98.github.io/LlamaDock-Benchmarks/

Dieses Repo enthält **nur die fertige Seite**. LlamaDock (privat) schreibt sie hierher, committet
und pusht automatisch: nach jedem Benchmark-Lauf aus dem Tab „Benchmarks“, nach jeder Bewertung,
Freigabe-Änderung und Szenario-Änderung. Läuft dasselbe Szenario mit exakt derselben Konfiguration
(Modell + Parameter) erneut, ersetzt der neue Lauf den alten.

Der Export nimmt nur freigegebene Läufe und bricht ab, wenn in den Daten ein Home-Pfad, der
Benutzername, eine Tailscale-IP, eine E-Mail-Adresse oder ein Token auftaucht. System-Prompt-Texte
werden nur mit ausdrücklichem Häkchen am Lauf mitveröffentlicht, Tool-Protokolle nie.

Der Workflow `.github/workflows/pages.yml` veröffentlicht jeden Push auf GitHub Pages
(Settings → Pages → Source „GitHub Actions“).

## Aufbau

| Pfad | Inhalt |
|---|---|
| `index.html` | Leaderboard, Rankings nach Anwendungsfall, Szenario-Matrix |
| `models/<modell>/` | eine Seite je Modell: alle Konfigurationen mit exakten Parametern, Hardware, Score und allen Läufen |
| `methode/` | Ablauf, Score-Formel, Szenarien |
| `app.js`, `style.css` | die statische Seite (kein Build) |
| `data/index.json` | Modelle, Konfigurationen, Scores, Rankings, Szenarien, externe Werte |
| `data/runs/<id>/` | ein Lauf: `run.json`, Screenshots, erzeugte Dateien (`work/`) |
