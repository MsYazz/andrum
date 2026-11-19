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
- `lib/gl.js`: WebGL2-hjälpare (en helskärmsshader per rum, plus egna pass där det behövs)
- `lib/ljud.js`: ljudmotor för de ljud som räknas fram i koden
- `lib/inspelning.js`: inspelade ljud. Bitar ur de rena avsnitten läggs efter varandra med mjuka övertoningar, och nivån räknas fram ur inspelningen så att även knäpp hålls långt under ljudvaktens gränser
- `lib/korn-processor.js`: kornsyntes för sand, där varje korn är ett litet tonlöst knäpp och simuleringen styr hur många, hur ljusa och hur mycket som rasar
- `ljud/`: inspelningarna, alla CC0, med källor i `ljud/KALLOR.md`
- `lib/vakt-processor.js`: ljudvakten, som sitter sist i ljudkedjan och stänger ljudet på några millisekunder om något plötsligt blir för starkt eller brusigt
- `lib/mottagare.js`: julkorten visas bara med en mottagare i länken. `?till=vivan` ger de personliga korten, `?till=barnen` ger provkort med samma utseende men egen text, och `?till=ingen` stänger av korten. Mottagaren sparas och skrivs in i hemskärmsappens startadress (`manifest-vivan.webmanifest`, `manifest-barnen.webmanifest`).
- `lib/portratt.js`: håller appen i porträttläge även när telefonen vrids
- `lib/rorelse.js`, `lib/haptik.js`: lutning, skakningar och små haptiska klick
- `luckor/NN-namn.js`: ett rum per fil, exporterar `start(duk, scen)` som returnerar en stoppfunktion
- `sw.js`: gör att appen fungerar offline. Den hämtar alltid från nätet först och sparar det den hämtar

## Nytt rum

1. Skapa `luckor/NN-namn.js` med samma form som de befintliga.
2. Lägg till rummet i `RUM` i `app.js` (sätt `rorelse: true` om rummet använder lutning eller skakningar).
3. Uppdatera raden i [RUM.md](RUM.md).

Service workern behöver inte ändras för nya rum, eftersom den sparar filerna när de hämtas första gången.
