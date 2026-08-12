// ============================================================================
// Den Ort aus einem Foto lesen
//
// Fast jedes Handyfoto trägt die Koordinaten in sich, an denen es aufgenommen
// wurde — im sogenannten EXIF-Block, den die Kamera vor die eigentlichen
// Bilddaten schreibt. Genau das nutzt diese Datei: Wer einen Spot anlegt,
// wählt sein Foto von dort aus, und die Position steht schon.
//
// Das Bild verlässt dabei das Gerät nicht. Gelesen wird nur der Anfang der
// Datei, im Browser, ohne dass irgendetwas hochgeladen wird.
//
// ----------------------------------------------------------------------------
// Warum das hier von Hand steht und keine fertige Bibliothek benutzt
//
// Die üblichen EXIF-Bibliotheken können hundert Dinge — Blende, Objektiv,
// Bildausrichtung, Miniaturbilder. Gebraucht werden hier vier Angaben:
// Breite, Länge und die zwei Himmelsrichtungen dazu. Dafür lohnt kein
// zusätzliches Paket von einem fremden Server, das bei jedem Aufruf
// mitgeladen werden müsste.
//
// ----------------------------------------------------------------------------
// Wie ein JPEG innen aufgebaut ist (die Kurzfassung)
//
//   FF D8                          Dateianfang
//   FF E1  [Länge]  "Exif\0\0"     ← hier steckt alles Interessante
//          [TIFF-Kopf][Verzeichnis][GPS-Verzeichnis]
//   FF DA                          ab hier kommen die Bilddaten
//
// Die Verzeichnisse sind Listen aus Einträgen zu je 12 Byte: Nummer der
// Angabe, Datentyp, Anzahl, Wert. Passt der Wert nicht in vier Byte — und drei
// Bruchzahlen für Grad, Minuten, Sekunden passen nie —, steht dort stattdessen
// die Stelle in der Datei, an der er wirklich liegt.
// ============================================================================

'use strict';

// Der EXIF-Block steht immer am Dateianfang. Mehr als ein paar hundert
// Kilobyte davon zu lesen wäre Verschwendung — ein Handyfoto ist 12 MB groß.
const ANFANG_BYTES = 256 * 1024;

// Die Nummern der Angaben, um die es geht.
const TAG_GPS_VERZEICHNIS = 0x8825;
const TAG_BREITE_RICHTUNG = 0x0001;   // "N" oder "S"
const TAG_BREITE          = 0x0002;   // Grad, Minuten, Sekunden
const TAG_LAENGE_RICHTUNG = 0x0003;   // "E" oder "W"
const TAG_LAENGE          = 0x0004;

/**
 * Liest die Koordinaten aus einem Bild.
 * Ergebnis: { lat, lng } — oder null, wenn im Bild kein Ort steht.
 * Wirft nie: ein unlesbares Bild ist einfach ein Bild ohne Ort.
 */
async function ortAusFoto(datei) {
  try {
    const puffer = await datei.slice(0, ANFANG_BYTES).arrayBuffer();
    return ortAusPuffer(new DataView(puffer));
  } catch {
    return null;
  }
}

function ortAusPuffer(sicht) {
  // 1. Ist das überhaupt ein JPEG?
  if (sicht.byteLength < 4 || sicht.getUint16(0) !== 0xffd8) return null;

  // 2. Die Segmente durchgehen, bis der EXIF-Block auftaucht.
  let stelle = 2;

  while (stelle + 4 < sicht.byteLength) {
    if (sicht.getUint8(stelle) !== 0xff) return null;   // aus dem Takt geraten

    const kennung = sicht.getUint8(stelle + 1);
    if (kennung === 0xda) return null;                  // Bilddaten — zu spät

    const laenge = sicht.getUint16(stelle + 2);
    if (laenge < 2) return null;

    // APP1 mit der Aufschrift "Exif" ist der gesuchte Block.
    if (kennung === 0xe1 && stelle + 10 < sicht.byteLength &&
        sicht.getUint32(stelle + 4) === 0x45786966) {   // "Exif"
      return ausExifBlock(sicht, stelle + 10);          // 4 + 6 Byte Vorspann
    }

    stelle += 2 + laenge;
  }
  return null;
}

// Ab hier zählt alles ab dem TIFF-Kopf — die Stellenangaben im Block sind
// nicht auf die Datei bezogen, sondern auf diesen Punkt.
function ausExifBlock(sicht, tiff) {
  if (tiff + 8 > sicht.byteLength) return null;

  // Die Kamera legt fest, in welcher Richtung Zahlen gelesen werden:
  // "II" (Intel, rückwärts) oder "MM" (Motorola, vorwärts).
  const ordnung = sicht.getUint16(tiff);
  if (ordnung !== 0x4949 && ordnung !== 0x4d4d) return null;
  const klein = ordnung === 0x4949;

  const zahl16 = (p) => sicht.getUint16(p, klein);
  const zahl32 = (p) => sicht.getUint32(p, klein);

  if (zahl16(tiff + 2) !== 0x002a) return null;   // Prüfzahl des TIFF-Kopfs

  // 1. Verzeichnis suchen, darin den Verweis aufs GPS-Verzeichnis.
  const ersteStelle = zahl32(tiff + 4);
  const gpsStelle = eintragSuchen(sicht, tiff, tiff + ersteStelle, TAG_GPS_VERZEICHNIS, zahl16, zahl32);
  if (gpsStelle === null) return null;            // Foto ohne Ortsangabe

  // 2. Im GPS-Verzeichnis die vier Angaben einsammeln.
  const gps = verzeichnisLesen(sicht, tiff, tiff + gpsStelle, zahl16, zahl32);

  const breite = gradAusBruch(gps[TAG_BREITE]);
  const laenge = gradAusBruch(gps[TAG_LAENGE]);
  if (breite === null || laenge === null) return null;

  // Süd und West werden negativ gezählt.
  const lat = gps[TAG_BREITE_RICHTUNG] === 'S' ? -breite : breite;
  const lng = gps[TAG_LAENGE_RICHTUNG] === 'W' ? -laenge : laenge;

  // Ein Bild ohne Empfang beim Auslösen trägt gern 0/0 ein — das ist ein Punkt
  // im Atlantik und keine Ortsangabe.
  if (!isFinite(lat) || !isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;

  return { lat, lng };
}

// Ein einzelner Eintrag aus einem Verzeichnis, als Zahl.
function eintragSuchen(sicht, tiff, verzeichnis, gesucht, zahl16, zahl32) {
  if (verzeichnis + 2 > sicht.byteLength) return null;
  const anzahl = zahl16(verzeichnis);

  for (let i = 0; i < anzahl; i++) {
    const e = verzeichnis + 2 + i * 12;
    if (e + 12 > sicht.byteLength) return null;
    if (zahl16(e) === gesucht) return zahl32(e + 8);
  }
  return null;
}

// Das ganze GPS-Verzeichnis: Nummer der Angabe → Wert (Text oder Bruchliste).
function verzeichnisLesen(sicht, tiff, verzeichnis, zahl16, zahl32) {
  const werte = {};
  if (verzeichnis + 2 > sicht.byteLength) return werte;

  const anzahl = zahl16(verzeichnis);

  for (let i = 0; i < anzahl; i++) {
    const e = verzeichnis + 2 + i * 12;
    if (e + 12 > sicht.byteLength) break;

    const tag   = zahl16(e);
    const typ   = zahl16(e + 2);
    const menge = zahl32(e + 4);

    if (typ === 2) {
      // Text — bei den Himmelsrichtungen genau ein Buchstabe.
      const stelle = menge <= 4 ? e + 8 : tiff + zahl32(e + 8);
      if (stelle < sicht.byteLength) {
        werte[tag] = String.fromCharCode(sicht.getUint8(stelle)).toUpperCase();
      }

    } else if (typ === 5) {
      // Bruchzahlen: je acht Byte, oben der Zähler, unten der Nenner.
      const stelle = tiff + zahl32(e + 8);
      const liste = [];

      for (let n = 0; n < menge; n++) {
        const p = stelle + n * 8;
        if (p + 8 > sicht.byteLength) break;
        const oben = zahl32(p);
        const unten = zahl32(p + 4);
        liste.push(unten === 0 ? 0 : oben / unten);
      }
      werte[tag] = liste;
    }
  }
  return werte;
}

// [47, 38, 24.6] → 47.64017 (Grad, Minuten, Sekunden zusammenrechnen)
function gradAusBruch(liste) {
  if (!Array.isArray(liste) || liste.length < 2) return null;
  const [grad, minuten, sekunden = 0] = liste;
  if (![grad, minuten, sekunden].every((z) => typeof z === 'number' && isFinite(z))) return null;
  return grad + minuten / 60 + sekunden / 3600;
}

window.ortAusFoto = ortAusFoto;
