// js/limitations.js - the "Judge notes" table in the Tools tab.
// To change the wording, edit INTRO or ROWS below. Nothing else needs to change.
(function () {
  const INTRO =
    "AEGIS-SHIELD is a web app. Everything here runs on your phone, and no server stores your contacts, location or recordings yet. This table says plainly what works, what is a prototype, and what needs a native app.";

  const STATUS = {
    working: "Working",
    prototype: "Prototype",
    no: "Not possible in browser",
  };

  // [feature, status key, what production would need]
  const ROWS = [
    [
      "SOS (hold, 5-second cancel, dashboard)",
      "working",
      "Server-sent alerts to contacts instead of the user tapping send, and a native app so SOS can start with the screen off. Official 112 integration would need control-room verification.",
    ],
    [
      "Live location and timed updates",
      "working",
      "Works while the app is open and on screen (the screen is kept awake). Background tracking needs a native Android foreground service, and updates need a server to receive them.",
    ],
    [
      "Emergency contacts",
      "working",
      "Contacts are saved on this phone only. Production needs accounts, sync across devices and contact verification.",
    ],
    [
      "Fake call",
      "working",
      "It is an on-screen simulation with a browser-made ring and the phone's voice. A native app could use the real call screen and ring while the phone is locked.",
    ],
    [
      "Audio evidence",
      "working",
      "Recorded with consent and stored on this phone. It is not encrypted and not uploaded. Production needs encryption, secure upload and background recording from a native app.",
    ],
    [
      "Biometric check",
      "prototype",
      "Uses the phone's fingerprint or face unlock through WebAuthn, but the challenge is made on the phone and no server verifies it. Production needs server-issued challenges and verification.",
    ],
    [
      "Volume-button trigger",
      "no",
      "Browsers cannot read hardware buttons. A native Android app is needed, and Android restricts background key detection, so it would need an approved approach and policy review.",
    ],
    [
      "Offline SOS (device-to-device relay)",
      "no",
      "Browsers cannot use Bluetooth or Wi-Fi Direct for this. Production needs a native Android app using Bluetooth LE or Google Nearby Connections, plus a relaying device that has internet.",
    ],
    [
      "Nearby police and hospitals",
      "working",
      "Uses public OpenStreetMap data over the internet, which can be incomplete and often lacks phone numbers. Production would use a verified emergency-services directory.",
    ],
  ];

  const intro = document.getElementById("notesIntro");
  const holder = document.getElementById("notesTable");
  if (!intro || !holder) return;
  intro.textContent = INTRO;

  function cell(label, child) {
    const td = document.createElement("td");
    td.dataset.label = label;
    td.append(child);
    return td;
  }

  const table = document.createElement("table");
  table.className = "notes";
  table.innerHTML =
    "<thead><tr><th>Feature</th><th>Status</th><th>What production would need</th></tr></thead>"; // fixed text, no user data
  const body = document.createElement("tbody");
  ROWS.forEach(([feature, key, need]) => {
    const badge = document.createElement("span");
    badge.className = "badge " + key;
    badge.textContent = STATUS[key];
    const name = document.createElement("strong");
    name.textContent = feature;
    const tr = document.createElement("tr");
    tr.append(
      cell("Feature", name),
      cell("Status", badge),
      cell("What production would need", document.createTextNode(need)),
    );
    body.append(tr);
  });
  table.append(body);
  holder.replaceChildren(table);
})();
