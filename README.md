# Heading Lab

Radarový trénink odhadu headingů, připravený pro GitHub Pages. Funguje bez instalace, sestavování a serverové části. Rozhraní používá vlastní radarovou grafiku inspirovanou ATC pracovišti, včetně symbolu letadla, leaderu, labelu a waypointu.


## Nezávislá nastavení

| Nastavení | Easy | Medium | Hard |
| --- | --- | --- | --- |
| Růžice | značky a hodnoty po 30° | značky a hodnoty po 90° | růžice je skrytá |
| Krok cílů | 30° | 15° | 5° |

Krok znamená, že správný heading je násobkem zvolené hodnoty. Stejný heading se nevygeneruje dvakrát za sebou. Vzdálenost waypointu se mírně mění; nemění úhlovou obtížnost.

- **Tolerance zásahu:** samostatně od 0° do ±15°. Hranice je včetně; při ±5° se odchylka přesně 5° počítá jako zásah.
- **Volný trénink:** bez časového limitu, ukončuje se ručně.
- **Test na čas:** 60, 120 nebo 180 sekund aktivního odpovídání. Rozbor a pauza se do limitu nepočítají. Nezodpovězený cíl při vypršení času je chyba a zobrazí se jeho řešení.
- **Nastavení během cvičení:** zůstává uzamčené, aby výsledky patřily stejné kombinaci podmínek. Ukonči cvičení, uprav hodnoty a začni nové.

## Jak se hraje

Sever je nahoře, letadlo je ve středu růžice. Zadej heading směrem k zelenému waypointu a potvrď jej Enterem. Kratší zápis, například `90`, se přijímá jako `090`. `000` i `360` znamenají sever; rozhraní sever zobrazuje jako `360`.

Hra předpokládá bezvětří. Hledaný heading se tedy shoduje se směrem k waypointu. Krátký modrý vektor a údaj `Hxxx` u labelu znázorňují **současný** směr letadla; neukazují řešení. Letadlo se nepohybuje a waypointy ani jejich umístění nepředstavují skutečnou navigační mapu.

Po odpovědi se objeví:

- zelená spojnice a správný heading,
- červený přerušovaný směr zadané odpovědi,
- vyznačený rozdíl směrů a číselná odchylka,
- vysvětlení, zda odpověď leží vlevo, nebo vpravo od správného směru.

Při přesné odpovědi obě čáry splývají. Odchylka se vždy počítá nejkratší cestou přes sever: zadání 005° při cíli 355° znamená +10°, ne −350°. Další cíl se zobrazí až po dalším Enteru nebo kliknutí.

## Ovládání

| Ovládání | Akce |
| --- | --- |
| 0–9 / číselná tlačítka | zadání headingu |
| Enter | potvrzení odpovědi / další waypoint / výsledky po vypršení času |
| Backspace | smazání poslední číslice |
| Escape při zadávání / CLR | vymazání headingu |
| P / tlačítko Pauza | pozastavení a pokračování |
| ? | nápověda |

Přepnutí do jiné karty při zadávání automaticky hru pozastaví. Po návratu je potřeba pokračování potvrdit. Otevření nápovědy nebo historie také pozastaví rozehrané cvičení.

## Statistiky

Hra ukazuje počet zásahů, procentní úspěšnost, průměrnou absolutní odchylku a průměrný čas zadané odpovědi. Nezodpovězený cíl při vypršení času snižuje úspěšnost, ale nevstupuje do průměrné úhlové odchylky ani času zadaných odpovědí.

Dokončené cvičení obsahuje i tabulku jednotlivých odpovědí. Posledních 20 dokončených cvičení a zvolená nastavení zůstávají v místním úložišti prohlížeče. Historie se nesynchronizuje mezi zařízeními. Rozehrané cvičení se po obnovení stránky neobnovuje. V některých prohlížečích nemusí být ukládání při otevření souboru přes `file://` dostupné; samotný trénink funguje dál.

## Úpravy kódu

| Soubor | Obsah |
| --- | --- |
| `index.html` | struktura rozhraní a nápověda |
| `styles.css` | vzhled radaru a responzivní zobrazení |
| `engine.js` | převody headingů, generování cílů a hodnocení |
| `app.js` | vykreslování, ovládání, časovač a historie |
| `tests/engine.test.cjs` | matematické a hodnoticí testy |

Výchozí hodnoty změníš v `DEFAULT` v `app.js`. Prohlížeč s uloženým nastavením použije vlastní poslední hodnoty. Barvy jsou definované v CSS proměnných a v konstantě `COLORS` v `app.js`. Cvičné callsigny a názvy bodů jsou ve stejném souboru.

Testy se spouštějí pomocí Node.js:

```sh
node --test tests/engine.test.cjs
```

Jde o samostatnou osobní tréninkovou hru. Nepoužívá software, logo ani grafické soubory TopSky nebo EUROCONTROLu.
