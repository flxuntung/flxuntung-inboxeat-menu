# Inboxeat · Menú del día

Web-App für das Restaurant: Tagesgerichte auf Spanisch eintragen, Illustration wird sofort über die Freepik-API (Google Nano Banana Pro) erstellt, Karte mit Logo als PNG herunterladen.

## Aufbau

- `index.html` Oberfläche (Spanisch), Logo `logo.png`
- `api/generate.js` übersetzt fehlende englische Zeilen, baut den Prompt, startet die Freepik-Aufgabe
- `api/status.js` fragt den Stand der Aufgabe ab
- `api/image.js` lädt das fertige Bild für den Browser (Canvas-Export)
- `api/check.js` prüft Passwort und Konfiguration

Der API-Schlüssel liegt nur auf dem Server (Vercel-Umgebungsvariable), nie im Browser.

## Deploy auf Vercel

1. Repo in Vercel importieren (Framework Preset: Other, kein Build Command).
2. Umgebungsvariablen setzen (Settings > Environment Variables):

| Variable | Pflicht | Beschreibung |
|---|---|---|
| `FREEPIK_API_KEY` | ja | Schlüssel aus freepik.com/developers |
| `APP_PASSWORD` | ja | Gemeinsames Passwort fürs Restaurant |
| `ANTHROPIC_API_KEY` | nein | Bessere Übersetzung im Menü-Stil ("Fennel & saffron"). Ohne Schlüssel wird MyMemory (kostenlos, wörtlich) genutzt |
| `FREEPIK_MODEL` | nein | Standard `gemini-3-pro-preview` (Nano Banana Pro). Alternative `gemini-2-5-flash-image-preview` (Nano Banana, schneller und günstiger) |
| `IMAGE_RESOLUTION` | nein | `1k` (Standard), `2k` oder `4k`. Über 2k kann der Bild-Proxy an das 4,5-MB-Limit von Vercel stoßen |

3. Deploy. Die App läuft unter der Vercel-URL, Link ans Restaurant geben, Passwort separat mitteilen.

## Freepik-Endpunkt prüfen

Der Modellpfad wurde nach bestem Wissen gesetzt. Falls `Crear ilustración` einen Fehler `Freepik 404` zeigt, den genauen Pfad für Nano Banana Pro in der Freepik-API-Dokumentation (docs.freepik.com, Bereich Text to Image) nachsehen und als `FREEPIK_MODEL` eintragen. Erwartetes Schema:

- `POST https://api.freepik.com/v1/ai/text-to-image/<MODEL>` mit `{ prompt, aspect_ratio, resolution }`
- `GET  https://api.freepik.com/v1/ai/text-to-image/<MODEL>/<task_id>` liefert `{ data: { status, generated: [url] } }`

## Lokal testen

```
npm i -g vercel
vercel dev
```
