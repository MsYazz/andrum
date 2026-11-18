# Andrum

En adventskalender med 24 dörrar. Bakom varje dörr finns ett rum att vila i: ett lugnt ljud- och bildlandskap som svarar på beröring. Inga poäng, inga krav.

Alla 24 rum, principerna och vad som är klart finns i [RUM.md](RUM.md).

## Köra lokalt

```powershell
python -m http.server 5180
```

Öppna sedan http://localhost:5180. Före 1 december är alla färdiga rum öppna (förhandsvisning). Lägg till `?prov` i adressen för att öppna dem även i december.

## Struktur

- `index.html`, `style.css`, `app.js`: kalendern med dörrarna
- `lib/gl.js`: WebGL2-hjälpare (en helskärmsshader per rum)
- `lib/ljud.js`: ljudmotor, allt ljud skapas i koden
- `luckor/NN-namn.js`: ett rum per fil, exporterar `start(duk, scen)` som returnerar en stoppfunktion
- `sw.js`: gör att appen fungerar offline

## Nytt rum

1. Skapa `luckor/NN-namn.js` med samma form som de befintliga.
2. Lägg till rummet i `RUM` i `app.js`.
3. Lägg till filen i `FILER` i `sw.js` och höj versionen i `CACHE`.
