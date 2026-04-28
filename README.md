# Multimediálna Webová Služba - Portal

Toto je hlavný portál pre predmet, ktorý agreguje a zobrazuje všetky študentské zadania. Portál beží ako jednoduchá aplikácia v **Python Flask**.

## 🚀 Ako spustiť portál?

1. Uisti sa, že máš nainštalovaný Python a `flask`:
   ```bash
   pip install flask
   ```
2. V hlavnom priečinku portáluusti:
   ```bash
   python app.py
   ```
3. Otvor si prehliadač na adrese [http://127.0.0.1:5000](http://127.0.0.1:5000).

---

## 📚 Inštrukcie pre Študentov (Ako pridať projekt)

Každý študent si vybral tému (AUDIO, OBRAZ, VIDEO, TEXT, 3D MODEL). Vašou úlohou je vyvinúť **Multimediálnu webovú službu** (napr. v Pythone, Jave, alebo čisto v HTML/JS).

Aby bol váš projekt správne zaindexovaný a zobrazený na hlavnom portáli, musíte dodržať nasledujúce konvencie!

### 1. Štruktúra priečinka

Váš projekt musí byť nakopírovaný do adresára `Projects/` pod názvom, ktorý reprezentuje vašu tému alebo meno. Názov priečinka sa automaticky stane názvom projektu na portáli (napr. priečinok `Moj_Audio_Projekt` sa zobrazí ako **Moj Audio Projekt**).

Váš priečinok **MUSÍ** obsahovať:

- `thumbnail.png` – obrázok s **presným rozlíšením 1000 x 1000 pixelov** (pomer strán 1:1). Iné veľkosti nie sú povolené. Toto je náhľad, ktorý sa ukáže na karte portálu.
- `index.html` – hlavný frontend rozhranie vášho zadania (toto uvidí užívateľ po rozkliknutí karty na webe).
  - ⚠️ **Dôležité:** Váš `index.html` musí obsahovať **tlačidlo "Späť"** (odkaz `<a href="/">Späť</a>`), aby sa hodnotiteľ vedel po vyskúšaní zadania jedným klikom vrátiť na hlavný portál!

### **Odovzdávanie a Nasadenie (GitHub Workflow)**

Aby sme vedeli spravovať všetkých 80+ projektov v tomto jednom portáli, odovzdávanie prebieha výlučne cez **Git/GitHub**:
1. Projekt nahráš **na svoj GitHub** (public repozitár).
2. Odkaz na tvoj GitHub repozitár vložíš do učiteľovej centrálnej hodnotiacej tabuľky. Učiteľ si následne cez príkaz `git clone` stiahne tvoj projekt, kde ti ho jedným klikom priamo zo spoločného servera vyskúša.



### 2. Rozhranie (Frontend & Backend)

**Frontend (`index.html`)**:
- Portál používa statické servovanie frontendov z `Projects`. Keď užívateľ klikne na vašu kartu, portál vráti tento `index.html`. 
- Uistite sa, že do `index.html` vkladáte CSS a JS cez relatívne cesty (napr. `<script src="script.js"></script>`, alebo priamo cez inline tagy).
- Vaša stránka musí jasne vysvetliť, ako sa má používať! Napríklad, pridať tlačidlo pre "Upload súboru".

**Vylúčenie Backendu (Strictne Frontend)**:
- Vaše zadanie **NESMIE** závisieť od akéhokoľvek vonkajšieho bežiaceho serverového backendu (žiadny Python Flask, Java Spring, Node.js Express ap.), či už lokálne ale aj na internetových službách - pretože vaše servery by po rokoch zmizli.
- Portál a aj projekty tak musia plne fungovať a vykonávať logiku výlučne vo webovom prehliadači užívateľa na báze statických súborov.
- Ak robíte zadanie a chcete použiť Python, použite technológiu ako **PyScript** (beží Python v prehliadači) resp. WebAssembly. Ostatné procesy kóďte pomocou moderných webových rozhraní prehliadačov (HTML5 Canvas, Web Audio API, `Three.js` WebGL atď.).
- Jedine toto zabezpečí, že po vložení priečinka so zadaním to učiteľovi okamžite aspoň o 5 rokov bezchybne pobeží bez riešenia padnutých alebo vypnutých serverov.

### 3. Vstup a Výstup (In/Out)

Každé zadanie musí spĺňať podobnú in/out štruktúru:
- **INPUT**: Rozhranie umožňuje užívateľovi nahrať multimediálny súbor (audio, video, obraz...) alebo parametre pre 3D/textový generátor prostredníctvom webového formulára alebo Drag & Drop UI.
- **OUTPUT**: Výsledok spracovania sa musí vizualizovať/prehrať priamo na vašej stránke. Nevraciate iba čisté dáta do konzoly!

---

*Inšpirujte sa 3 ukážkovými projektmi (`Example_Python_Audio`, `Example_Java_Image`, `Example_HTML_3D_Viewer`), ktoré sa nachádzajú priamo v zložke `Projects`!*
