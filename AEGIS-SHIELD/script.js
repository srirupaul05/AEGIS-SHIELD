// ===== HOME screen =====
(function () {
  const $ = (s) => document.querySelector(s);
  const load = (k, d) => {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? d;
    } catch (e) {
      return d;
    }
  };

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.id);
    toast.id = setTimeout(() => (t.hidden = true), 3000);
  }

  // ---- greeting ----
  const hour = new Date().getHours();
  $("#greet").textContent =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  // ---- setup checklist + status card ----
  function setRow(name, done, text) {
    const btn = document.querySelector(`[data-check="${name}"]`);
    btn.classList.toggle("done", done);
    btn.querySelector("small").textContent = text;
  }
  async function refresh() {
    const count = load("contacts", []).length;
    const bio = !!load("settings", {}).biometric;
    let loc = "prompt";
    try {
      loc = (await navigator.permissions.query({ name: "geolocation" })).state;
    } catch (e) {
      /* older browsers */
    }

    setRow(
      "contacts",
      count > 0,
      count ? `${count} added` : "Add someone you trust",
    );
    setRow(
      "location",
      loc === "granted",
      loc === "granted"
        ? "Allowed"
        : loc === "denied"
          ? "Blocked. Allow it in browser settings"
          : "Tap to allow",
    );
    setRow("biometric", bio, bio ? "On" : "Optional, currently off");

    const ready = count > 0 && loc === "granted";
    $("#statusCard").classList.toggle("ready", ready);
    $("#statusTitle").textContent = ready ? "You are ready" : "Finish setup";
    $("#statusText").textContent = ready
      ? "Contacts and location are set."
      : count === 0
        ? "Add a trusted contact so someone can be alerted."
        : "Allow location so contacts can see where you are.";
  }
  refresh();

  document.querySelectorAll("#checklist button").forEach(
    (b) =>
      (b.onclick = () => {
        const name = b.dataset.check;
        if (name === "location")
          navigator.geolocation.getCurrentPosition(refresh, refresh, {
            timeout: 10000,
          });
        else window.showTab(name === "contacts" ? "contacts" : "settings");
      }),
  );

  // ---- hold-to-activate SOS (prevents accidental taps) ----
  const HOLD_MS = 1500;
  const sos = $("#sosBtn");
  let startTime = 0,
    raf = 0;

  function frame(now) {
    const p = Math.min((now - startTime) / HOLD_MS, 1);
    sos.style.setProperty("--p", p * 360 + "deg");
    if (p >= 1) return complete();
    raf = requestAnimationFrame(frame);
  }
  function begin() {
    if (raf) return;
    startTime = performance.now();
    sos.classList.add("holding");
    raf = requestAnimationFrame(frame);
    if (navigator.vibrate) navigator.vibrate(30);
  }
  function release() {
    cancelAnimationFrame(raf);
    raf = 0;
    sos.classList.remove("holding");
    sos.style.setProperty("--p", "0deg");
  }
  function complete() {
    release();
    if (navigator.vibrate) navigator.vibrate([100, 60, 100]);
    // The countdown screen (built next) listens for this event.
    const check = window.confirmIdentity
      ? window.confirmIdentity()
      : Promise.resolve(true);
    check.then((ok) =>
      ok
        ? document.dispatchEvent(new CustomEvent("sos:requested"))
        : toast("Fingerprint check did not pass. Hold SOS to try again."),
    );
  }
  sos.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    begin();
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach((ev) =>
    sos.addEventListener(ev, release),
  );
  sos.addEventListener("contextmenu", (e) => e.preventDefault());
  sos.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
      e.preventDefault();
      begin();
    }
  });
  sos.addEventListener("keyup", release);

  // ---- quick actions ----
  $("#fakeBtn").onclick = () => {
    document.dispatchEvent(new CustomEvent("fakecall:requested"));
  };
  $("#shareBtn").onclick = () => {
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const a = p.coords.latitude,
          b = p.coords.longitude;
        const text = `My location: https://www.openstreetmap.org/?mlat=${a}&mlon=${b}#map=17/${a}/${b}`;
        if (navigator.share) {
          try {
            await navigator.share({ text });
          } catch (e) {
            /* closed */
          }
        } else {
          try {
            await navigator.clipboard.writeText(text);
            toast("Location link copied");
          } catch (e) {
            toast(text);
          }
        }
      },
      () => toast("Location is blocked. Allow it in browser settings."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  document.addEventListener("tab:changed", refresh);
})();

// ===== TABS + CONTACTS screens =====
(function () {
  const $ = (s) => document.querySelector(s);
  const toast = (m) => {
    const t = $("#toast");
    t.textContent = m;
    t.hidden = false;
    clearTimeout(toast.id);
    toast.id = setTimeout(() => (t.hidden = true), 3000);
  };

  // --- tab switching: shows one <main> screen at a time ---
  window.showTab = function (name) {
    const screen = document.getElementById(name);
    if (!screen || screen.tagName !== "MAIN")
      return toast("That screen is built in a later step.");
    document.querySelectorAll("main").forEach((m) => (m.hidden = m !== screen));
    document
      .querySelectorAll(".tabs button")
      .forEach((b) =>
        b.setAttribute(
          "aria-current",
          b.dataset.tab === name ? "page" : "false",
        ),
      );
    window.scrollTo(0, 0);
    document.dispatchEvent(new CustomEvent("tab:changed", { detail: name }));
  };
  document
    .querySelectorAll(".tabs button")
    .forEach((b) => (b.onclick = () => window.showTab(b.dataset.tab)));

  // --- contacts: saved on this phone in localStorage under the key "contacts" ---
  const load = () => {
    try {
      return JSON.parse(localStorage.getItem("contacts")) || [];
    } catch (e) {
      return [];
    }
  };
  let contacts = load();
  const save = () => localStorage.setItem("contacts", JSON.stringify(contacts));
  const digits = (p) => p.replace(/\s/g, "");
  // el() builds elements with textContent, so a typed name can never inject HTML
  function el(tag, props = {}, ...kids) {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...kids);
    return e;
  }

  function render() {
    const ul = $("#contactList");
    $("#contactsTitle").textContent = contacts.length
      ? `Your contacts (${contacts.length})`
      : "Your contacts";
    if (!contacts.length) {
      ul.replaceChildren(
        el("li", {
          className: "empty",
          textContent:
            "No contacts yet. Add someone who should hear from you first.",
        }),
      );
      return;
    }
    ul.replaceChildren(
      ...contacts.map((c, i) =>
        el(
          "li",
          {},
          el("div", {
            className: "avatar",
            textContent: c.name.charAt(0).toUpperCase(),
          }),
          el(
            "div",
            { className: "c-info" },
            el("strong", { textContent: c.name }),
            el("small", {
              textContent: `${c.relation}, ${c.phone}${c.notify ? "" : " (not alerted)"}`,
            }),
          ),
          el(
            "div",
            { className: "c-actions" },
            el("a", {
              className: "mini",
              href: "tel:" + digits(c.phone),
              textContent: "Call",
            }),
            el("button", {
              className: "mini danger",
              textContent: "Remove",
              onclick: () => {
                if (confirm(`Remove ${c.name}?`)) {
                  contacts.splice(i, 1);
                  save();
                  render();
                }
              },
            }),
          ),
        ),
      ),
    );
  }

  $("#contactForm").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const phone = f.get("phone").trim();
    if (contacts.some((c) => digits(c.phone) === digits(phone)))
      return toast("That number is already saved.");
    contacts.push({
      name: f.get("name").trim(),
      phone,
      relation: f.get("relation"),
      notify: f.get("notify") === "on",
    });
    save();
    e.target.reset();
    render();
    toast("Contact saved");
  };
  render();
})();

// ===== SOS: countdown + emergency dashboard =====
(function () {
  const $ = (s) => document.querySelector(s);
  const toast = (m) => {
    const t = $("#toast");
    t.textContent = m;
    t.hidden = false;
    clearTimeout(toast.id);
    toast.id = setTimeout(() => (t.hidden = true), 3000);
  };
  const load = (k, d) => {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? d;
    } catch (e) {
      return d;
    }
  };
  const digits = (p) => p.replace(/\s/g, "");
  function el(tag, props = {}, ...kids) {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...kids);
    return e;
  }

  const state = { pos: null, started: 0 };
  let cdTimer,
    locTimer,
    clockTimer,
    wake = null,
    map = null,
    dot = null,
    ring = null;

  // ---- 1) 5-second cancel countdown (Home fires "sos:requested" after the hold) ----
  document.addEventListener("sos:requested", () => {
    if (!$("#countdown").hidden || !$("#emergency").hidden) return;
    let n = 5;
    $("#cdNum").textContent = n;
    $("#countdown").hidden = false;
    cdTimer = setInterval(() => {
      $("#cdNum").textContent = --n;
      if (n <= 0) {
        clearInterval(cdTimer);
        $("#countdown").hidden = true;
        startSos();
      }
    }, 1000);
  });
  $("#cancelCd").onclick = () => {
    clearInterval(cdTimer);
    $("#countdown").hidden = true;
    toast("SOS cancelled. No one was alerted.");
  };

  // ---- 2) emergency mode ----
  async function startSos() {
    state.started = Date.now();
    state.pos = null;
    $("#emergency").hidden = false;
    $("#coords").textContent = "Finding you...";
    $("#lastUpdate").textContent = "Not yet";
    const secs = Number(load("settings", {}).interval) || 15;
    $("#refreshNote").textContent = `Every ${secs} seconds`;
    renderContacts();
    initMap();
    requestWake();
    tickClock();
    clockTimer = setInterval(tickClock, 1000);
    readLocation();
    locTimer = setInterval(readLocation, secs * 1000);
  }
  function stopSos() {
    clearInterval(locTimer);
    clearInterval(clockTimer);
    if (wake) {
      wake.release().catch(() => {});
      wake = null;
    }
    if (dot) {
      dot.remove();
      ring.remove();
      dot = ring = null;
    }
    window.lastKnownPos = null;
    $("#emergency").hidden = true;
    toast("SOS stopped.");
  }
  $("#stopBtn").onclick = () => {
    if (confirm("Stop SOS and location updates?")) stopSos();
  };

  function tickClock() {
    const s = Math.floor((Date.now() - state.started) / 1000);
    $("#emTime").textContent =
      `Active for ${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }
  // Keeps the screen on so updates continue. The browser drops it when you switch apps, so ask again.
  async function requestWake() {
    try {
      wake = await navigator.wakeLock.request("screen");
    } catch (e) {
      /* not supported */
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !$("#emergency").hidden) requestWake();
  });

  // ---- 3) location (timed) ----
  function readLocation() {
    if (!navigator.geolocation) {
      $("#coords").textContent = "This browser cannot read location.";
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        state.pos = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          acc: p.coords.accuracy,
        };
        window.lastKnownPos = state.pos;
        window.safemeLocation.set(state.pos);
        $("#coords").textContent =
          `${state.pos.lat.toFixed(5)}, ${state.pos.lng.toFixed(5)} (within ${Math.round(state.pos.acc)} m)`;
        $("#lastUpdate").textContent = new Date().toLocaleTimeString();
        drawOnMap();
      },
      (err) => {
        $("#coords").textContent =
          err.code === 1
            ? "Location is blocked. Allow it in browser settings."
            : "Could not get location. Trying again.";
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  // ---- 4) map (Leaflet + OpenStreetMap) ----
  function initMap() {
    const ok = typeof L !== "undefined";
    $("#map").hidden = !ok;
    $("#mapMsg").hidden = ok;
    if (!ok) return;
    if (!map) {
      map = L.map("map");
      map.fitWorld();
      window.safemeMap = map;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);
    }
    setTimeout(() => map.invalidateSize(), 150);
  }
  function drawOnMap() {
    if (!map) return;
    const ll = [state.pos.lat, state.pos.lng];
    if (!dot) {
      ring = L.circle(ll, {
        radius: state.pos.acc,
        color: "#F0C38E",
        weight: 1,
        fillOpacity: 0.12,
      }).addTo(map);
      dot = L.circleMarker(ll, {
        radius: 9,
        color: "#F0C38E",
        weight: 3,
        fillColor: "#F1AA9B",
        fillOpacity: 1,
      }).addTo(map);
    } else {
      dot.setLatLng(ll);
      ring.setLatLng(ll);
      ring.setRadius(state.pos.acc);
    }
    map.setView(ll, 16);
  }

  // ---- 5) contacts: call, or open a text message with the location link ----
  function smsLink(c) {
    const where = state.pos
      ? `https://www.openstreetmap.org/?mlat=${state.pos.lat}&mlon=${state.pos.lng}#map=17/${state.pos.lat}/${state.pos.lng}`
      : "not available yet";
    const st = load("settings", {});
    const who = st.userName ? ` This is ${st.userName}.` : "";
    const msg =
      st.sosMessage || "I need help. Please call me or come to my location.";
    return `sms:${digits(c.phone)}?body=${encodeURIComponent(`SOS from AEGIS-SHIELD.${who} ${msg} My location: ${where}`)}`;
  }
  function renderContacts() {
    const list = load("contacts", []).filter((c) => c.notify);
    $("#emContacts").replaceChildren(
      ...(list.length
        ? list.map((c) =>
            el(
              "li",
              {},
              el("div", {
                className: "avatar",
                textContent: c.name.charAt(0).toUpperCase(),
              }),
              el(
                "div",
                { className: "c-info" },
                el("strong", { textContent: c.name }),
                el("small", { textContent: c.relation }),
              ),
              el(
                "div",
                { className: "c-actions" },
                el("a", {
                  className: "mini",
                  href: "tel:" + digits(c.phone),
                  textContent: "Call",
                }),
                el("a", {
                  className: "mini",
                  href: "sms:" + digits(c.phone),
                  textContent: "Send location",
                  onclick: (e) => {
                    e.currentTarget.href = smsLink(c);
                  },
                }),
              ),
            ),
          )
        : [
            el("li", {
              className: "empty",
              textContent:
                "No contacts to alert. Add one in Contacts before you need it.",
            }),
          ]),
    );
  }
})();

// ===== SETTINGS screen =====
(function () {
  const $ = (s) => document.querySelector(s);
  const toast = (m) => {
    const t = $("#toast");
    t.textContent = m;
    t.hidden = false;
    clearTimeout(toast.id);
    toast.id = setTimeout(() => (t.hidden = true), 3000);
  };

  // Saved on this phone under the key "settings". Other screens read the same key.
  const DEFAULTS = {
    interval: 15,
    fakeCaller: "Mom",
    fakeDelay: 10,
    biometric: false,
    userName: "",
    sosMessage: "I need help. Please call me or come to my location.",
  };
  const get = () => {
    try {
      return Object.assign(
        {},
        DEFAULTS,
        JSON.parse(localStorage.getItem("settings")) || {},
      );
    } catch (e) {
      return Object.assign({}, DEFAULTS);
    }
  };
  const change = (patch) => {
    localStorage.setItem(
      "settings",
      JSON.stringify(Object.assign(get(), patch)),
    );
    toast("Saved");
  };

  const s = get();
  $("#setSecs").value = s.interval;
  $("#setDelay").value = s.fakeDelay;
  $("#setCaller").value = s.fakeCaller;
  $("#setBio").checked = s.biometric;
  $("#setName").value = s.userName;
  $("#setMsg").value = s.sosMessage;

  $("#setSecs").onchange = (e) => change({ interval: Number(e.target.value) });
  $("#setName").onchange = (e) => {
    e.target.value = e.target.value.trim();
    change({ userName: e.target.value });
  };
  $("#setMsg").onchange = (e) => {
    const msg = e.target.value.trim() || DEFAULTS.sosMessage;
    e.target.value = msg;
    change({ sosMessage: msg });
  };
  $("#setDelay").onchange = (e) =>
    change({ fakeDelay: Number(e.target.value) });
  $("#setCaller").onchange = (e) => {
    const name = e.target.value.trim() || "Mom";
    e.target.value = name;
    change({ fakeCaller: name });
  };

  // ---- fingerprint / face check (WebAuthn) ----
  // PROTOTYPE: the challenge is made on the phone. A production app needs the server to issue it.
  const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
  async function register() {
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: rand(32),
        rp: { name: "AEGIS-SHIELD" },
        user: { id: rand(16), name: "user", displayName: "AEGIS-SHIELD user" },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
        },
      },
    });
    localStorage.setItem(
      "credId",
      btoa(String.fromCharCode(...new Uint8Array(cred.rawId))),
    );
  }
  $("#setBio").onchange = async (e) => {
    if (!e.target.checked) return change({ biometric: false });
    if (!window.PublicKeyCredential || !window.isSecureContext) {
      e.target.checked = false;
      return toast(
        "Fingerprint check needs a supported browser on localhost or https.",
      );
    }
    try {
      await register();
      change({ biometric: true });
    } catch (err) {
      e.target.checked = false;
      toast("Could not set up the fingerprint check on this device.");
    }
  };

  // Home calls this before starting the SOS countdown. Returns true if SOS may continue.
  window.confirmIdentity = async function () {
    const id = localStorage.getItem("credId");
    if (!get().biometric || !id) return true;
    try {
      await navigator.credentials.get({
        publicKey: {
          challenge: rand(32),
          userVerification: "required",
          allowCredentials: [
            {
              type: "public-key",
              id: Uint8Array.from(atob(id), (c) => c.charCodeAt(0)),
            },
          ],
        },
      });
      return true;
    } catch (e) {
      return false;
    }
  };

  // ---- delete everything on this phone ----
  $("#clearData").onclick = () => {
    if (
      !confirm(
        "Delete your contacts and settings from this phone? This cannot be undone.",
      )
    )
      return;
    localStorage.clear();
    location.reload();
  };
})();

// ===== TOOLS: fake call + audio evidence =====
(function () {
  const $ = (s) => document.querySelector(s);
  const toast = (m) => {
    const t = $("#toast");
    t.textContent = m;
    t.hidden = false;
    clearTimeout(toast.id);
    toast.id = setTimeout(() => (t.hidden = true), 3000);
  };
  const load = (k, d) => {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? d;
    } catch (e) {
      return d;
    }
  };
  function el(tag, props = {}, ...kids) {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...kids);
    return e;
  }
  const cfg = () => load("settings", {});

  // keep the labels in sync with Settings
  function labels() {
    $("#toolCaller").textContent = cfg().fakeCaller || "Mom";
    $("#toolDelay").textContent = cfg().fakeDelay || 10;
  }
  labels();
  document.addEventListener("tab:changed", labels);

  // ---------- fake call (looks like a real phone call) ----------
  const FAKE_LINES = [
    "Hello? Where are you?",
    "I have been trying to reach you.",
    "Come home now, it is important.",
  ];
  let ctx = null,
    ringTimer = null,
    callTimer = null,
    pending = null,
    speakTimer = null;
  function tone() {
    // two-tone phone ring made in the browser, no audio file needed
    if (!ctx) return;
    [440, 480].forEach((f) => {
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.frequency.value = f;
      g.gain.value = 0.12;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.8);
    });
  }
  function ring() {
    if (!$("#fakeCall").hidden) return;
    const name = cfg().fakeCaller || "Mom";
    document
      .querySelectorAll(".js-name")
      .forEach((n) => (n.textContent = name));
    document
      .querySelectorAll(".js-initial")
      .forEach((n) => (n.textContent = name.charAt(0).toUpperCase()));
    $("#callIncoming").hidden = false;
    $("#callActive").hidden = true;
    $("#fakeCall").hidden = false;
    const buzz = () => {
      tone();
      if (navigator.vibrate) navigator.vibrate([400, 200, 400]);
    };
    buzz();
    ringTimer = setInterval(buzz, 2500);
  }
  function schedule(seconds) {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      ctx.resume();
    } catch (e) {
      /* no sound */
    }
    clearTimeout(pending);
    if (seconds > 0) toast(`Fake call in ${seconds} seconds`);
    pending = setTimeout(ring, seconds * 1000);
  }
  function hangUp() {
    clearInterval(ringTimer);
    clearInterval(callTimer);
    clearTimeout(speakTimer);
    if (window.speechSynthesis) speechSynthesis.cancel();
    if (navigator.vibrate) navigator.vibrate(0);
    $("#fakeCall").hidden = true;
  }
  // After you answer, the phone's own voice says a few lines, one after another.
  function speak(i) {
    if (!window.speechSynthesis || i >= FAKE_LINES.length) return;
    const u = new SpeechSynthesisUtterance(FAKE_LINES[i]);
    u.onend = () => {
      speakTimer = setTimeout(() => speak(i + 1), 2500);
    };
    speechSynthesis.speak(u);
  }
  $("#fakeLater").onclick = () => schedule(Number(cfg().fakeDelay) || 10);
  $("#fakeNow").onclick = () => schedule(0);
  document.addEventListener("fakecall:requested", () =>
    schedule(Number(cfg().fakeDelay) || 10),
  ); // Home quick action
  $("#declineCall").onclick = hangUp;
  $("#endCall").onclick = hangUp;
  document
    .querySelectorAll(".call-grid button")
    .forEach((b) => (b.onclick = () => b.classList.toggle("on")));
  $("#acceptCall").onclick = () => {
    clearInterval(ringTimer);
    if (navigator.vibrate) navigator.vibrate(0);
    $("#callIncoming").hidden = true;
    $("#callActive").hidden = false;
    let s = 0;
    $("#callState").textContent = "00:00";
    callTimer = setInterval(() => {
      s++;
      $("#callState").textContent =
        `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    }, 1000);
    speakTimer = setTimeout(() => speak(0), 1200);
  };

  // ---------- evidence storage (IndexedDB, stays on this phone) ----------
  function openDb() {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open("safeme-evidence", 1);
      r.onupgradeneeded = () =>
        r.result.createObjectStore("clips", { keyPath: "id" });
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  async function tx(mode, fn) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const t = db.transaction("clips", mode),
        q = fn(t.objectStore("clips"));
      t.oncomplete = () => resolve(q && q.result);
      t.onerror = () => reject(t.error);
    });
  }

  // ---------- audio recording, with consent ----------
  let rec = null,
    capTimer = null;
  function setRecUi(on) {
    $("#recBar").hidden = !on;
    document
      .querySelectorAll(".rec-btn")
      .forEach(
        (b) => (b.textContent = on ? "Stop recording" : b.dataset.label),
      );
  }
  async function toggleRecord() {
    if (rec) return rec.stop();
    if (!navigator.mediaDevices || !window.MediaRecorder)
      return toast("This browser cannot record audio.");
    if (!localStorage.getItem("recConsent")) {
      if (
        !confirm(
          "AEGIS-SHIELD will record audio from your microphone and save it only on this phone. A bar stays on screen while it records. Continue?",
        )
      )
        return;
      localStorage.setItem("recConsent", "1");
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [],
        r = new MediaRecorder(stream),
        t0 = Date.now();
      r.ondataavailable = (e) => {
        if (e.data && e.data.size) chunks.push(e.data);
      };
      r.onstop = async () => {
        clearTimeout(capTimer);
        stream.getTracks().forEach((t) => t.stop());
        rec = null;
        setRecUi(false);
        const clip = {
          id: crypto.randomUUID(),
          time: new Date().toISOString(),
          seconds: Math.round((Date.now() - t0) / 1000),
          pos: window.lastKnownPos || null,
          blob: new Blob(chunks, { type: r.mimeType || "audio/webm" }),
        };
        await tx("readwrite", (s) => s.put(clip));
        renderEvidence();
        toast("Recording saved on this phone");
      };
      r.start();
      rec = r;
      setRecUi(true);
      capTimer = setTimeout(() => r.stop(), 10 * 60 * 1000); // safety stop after 10 minutes
    } catch (e) {
      toast("Microphone permission was blocked. Allow it in browser settings.");
    }
  }
  document
    .querySelectorAll(".rec-btn")
    .forEach((b) => (b.onclick = toggleRecord));
  $("#recStop").onclick = toggleRecord;

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  async function renderEvidence() {
    const clips = ((await tx("readonly", (s) => s.getAll())) || []).sort(
      (a, b) => b.time.localeCompare(a.time),
    );
    $("#evTitle").textContent = clips.length
      ? `Saved recordings (${clips.length})`
      : "Saved recordings";
    $("#evList").replaceChildren(
      ...(clips.length
        ? clips.map((c) => {
            const url = URL.createObjectURL(c.blob),
              ext = (c.blob.type || "").includes("mp4") ? "m4a" : "webm";
            return el(
              "li",
              { className: "ev" },
              el("strong", { textContent: new Date(c.time).toLocaleString() }),
              el("small", {
                textContent:
                  `${fmt(c.seconds)} long` +
                  (c.pos
                    ? `, near ${c.pos.lat.toFixed(4)}, ${c.pos.lng.toFixed(4)}`
                    : ""),
              }),
              el("audio", { controls: true, src: url }),
              el(
                "div",
                { className: "c-actions" },
                el("a", {
                  className: "mini",
                  href: url,
                  download: `aegis-shield-${c.time.slice(0, 19).replace(/[:T]/g, "-")}.${ext}`,
                  textContent: "Download",
                }),
                el("button", {
                  className: "mini danger",
                  textContent: "Delete",
                  onclick: async () => {
                    if (confirm("Delete this recording?")) {
                      await tx("readwrite", (s) => s.delete(c.id));
                      renderEvidence();
                    }
                  },
                }),
              ),
            );
          })
        : [
            el("li", {
              className: "empty",
              textContent:
                "No recordings yet. Start one here, or from the SOS screen.",
            }),
          ]),
    );
  }
  renderEvidence().catch(() => {});
})();

// ===== PWA: install button + offline support =====
(function () {
  const $ = (s) => document.querySelector(s);
  const toast = (m) => {
    const t = $("#toast");
    t.textContent = m;
    t.hidden = false;
    clearTimeout(toast.id);
    toast.id = setTimeout(() => (t.hidden = true), 3500);
  };

  // The service worker (sw.js) saves the app so it opens offline. It only runs on https or localhost.
  if (
    "serviceWorker" in navigator &&
    (location.protocol === "https:" || location.hostname === "localhost")
  ) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    navigator.standalone;
  let prompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    // Chrome and Edge on Android and desktop
    e.preventDefault();
    prompt = e;
    if (!standalone) {
      $("#installBtn").hidden = false;
      $("#installCard").hidden = false;
    }
  });
  $("#installBtn").onclick = async () => {
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice;
    prompt = null;
    $("#installCard").hidden = true;
  };
  window.addEventListener("appinstalled", () => {
    $("#installCard").hidden = true;
    toast("AEGIS-SHIELD installed");
  });

  // iPhones have no install button, so show the steps instead.
  if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone) {
    $("#installText").textContent =
      "On iPhone: tap the Share button in Safari, then Add to Home Screen.";
    $("#installBtn").hidden = true;
    $("#installCard").hidden = false;
  }

  window.addEventListener("offline", () =>
    toast("You are offline. Maps need internet. Everything else still works."),
  );
  window.addEventListener("online", () => toast("Back online"));
})();

// ===== ADD NEXT SCREEN'S JS ABOVE THIS LINE =====
