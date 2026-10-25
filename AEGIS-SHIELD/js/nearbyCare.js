// js/nearbyCare.js - police stations and hospitals within 5 km, from OpenStreetMap's Overpass API.
// Needs: js/locationService.js (position) and Leaflet (map markers).
(function () {
  const $ = (s) => document.querySelector(s);
  const RADIUS = 5000; // metres
  const ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ]; // second is a backup
  const TIMEOUT_MS = 20000;
  const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  let careMap = null,
    results = [],
    busy = false;

  // el() builds elements with textContent, because place names come from the internet and must never be treated as HTML
  function el(tag, props = {}, ...kids) {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...kids);
    return e;
  }

  // ---- distance (haversine formula, in metres) ----
  function distanceM(a, b) {
    const R = 6371000,
      rad = (d) => (d * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat),
      dLng = rad(b.lng - a.lng);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  const fmt = (m) =>
    m < 1000
      ? `${Math.max(10, Math.round(m / 10) * 10)} m`
      : `${(m / 1000).toFixed(1)} km`;

  // ---- Overpass query and request ----
  function buildQuery(p) {
    return `[out:json][timeout:20];(nwr["amenity"="police"](around:${RADIUS},${p.lat},${p.lng});nwr["amenity"="hospital"](around:${RADIUS},${p.lat},${p.lng}););out center tags 60;`;
  }
  async function overpass(query) {
    let lastErr;
    for (const url of ENDPOINTS) {
      const ctrl = new AbortController(),
        timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(url, {
          method: "POST",
          signal: ctrl.signal,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: "data=" + encodeURIComponent(query),
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        return await res.json();
      } catch (e) {
        lastErr = e;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr;
  }

  // ---- turn Overpass elements into a clean, sorted list ----
  function parse(json, from) {
    return (json.elements || [])
      .map((e) => {
        const lat = e.lat ?? (e.center && e.center.lat),
          lng = e.lon ?? (e.center && e.center.lon);
        if (lat == null || lng == null) return null;
        const tags = e.tags || {},
          kind = tags.amenity === "police" ? "police" : "hospital";
        const phone = String(tags.phone || tags["contact:phone"] || "")
          .split(";")[0]
          .replace(/[^0-9+]/g, "");
        return {
          kind,
          lat,
          lng,
          phone: phone.length >= 5 ? phone : "",
          dist: distanceM(from, { lat, lng }),
          name:
            tags.name ||
            tags["name:en"] ||
            (kind === "police"
              ? "Police station (name not listed)"
              : "Hospital (name not listed)"),
        };
      })
      .filter(Boolean)
      .filter((r) => r.dist <= RADIUS * 1.05)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 15);
  }

  // ---- list items: Call (only if a phone tag exists) and Navigate ----
  const navUrl = (r) =>
    `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`;
  function actions(r) {
    return el(
      "div",
      { className: "c-actions" },
      r.phone
        ? el("a", {
            className: "mini",
            href: "tel:" + r.phone,
            textContent: "Call",
          })
        : el("small", {
            className: "care-meta",
            textContent: "No phone listed",
          }),
      el("a", {
        className: "mini",
        href: navUrl(r),
        target: "_blank",
        rel: "noopener",
        textContent: "Navigate",
      }),
    );
  }
  function item(r) {
    return el(
      "li",
      { className: "care" },
      el(
        "div",
        { className: "care-top" },
        el("span", {
          className: "badge " + (r.kind === "police" ? "prototype" : "working"),
          textContent: r.kind === "police" ? "Police" : "Hospital",
        }),
        el("small", { className: "care-meta", textContent: fmt(r.dist) }),
      ),
      el("div", { className: "care-name", textContent: r.name }),
      actions(r),
    );
  }
  function renderList(sel, list) {
    const ul = $(sel);
    if (ul) ul.replaceChildren(...list.map(item));
  }

  // ---- map markers: works on ANY Leaflet map, so the SOS map gets them too ----
  function popup(r) {
    return el(
      "div",
      {},
      el("strong", { textContent: r.name }),
      el("br"),
      document.createTextNode(fmt(r.dist) + " away"),
      el("br"),
      el("a", {
        href: navUrl(r),
        target: "_blank",
        rel: "noopener",
        textContent: "Navigate",
      }),
    );
  }
  function drawOn(map, from) {
    if (!map || typeof L === "undefined") return;
    if (map.__care) map.__care.remove();
    const group = L.layerGroup().addTo(map);
    map.__care = group;
    results.forEach((r) => {
      const police = r.kind === "police";
      group.addLayer(
        L.circleMarker([r.lat, r.lng], {
          radius: 8,
          weight: 2,
          fillOpacity: 1,
          color: police ? "#F0C38E" : "#312C51",
          fillColor: police ? "#48426D" : "#F0C38E",
        }).bindPopup(popup(r)),
      );
    });
  }
  function ensureCareMap() {
    if (typeof L === "undefined") return null;
    $("#careMap").hidden = false;
    if (!careMap) {
      careMap = L.map("careMap");
      careMap.fitWorld();
      L.tileLayer(TILES, {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(careMap);
    }
    return careMap;
  }

  // ---- messages ----
  function say(text) {
    ["#careStatus", "#careSosNote"].forEach((s) => {
      const n = $(s);
      if (n) n.textContent = text;
    });
  }
  function fail(text) {
    say(text);
    renderList("#careList", []);
    renderList("#careSosList", []);
  }

  // ---- the search ----
  async function search() {
    if (busy) return;
    busy = true;
    ["#careBtn", "#careSosBtn"].forEach((s) => {
      const b = $(s);
      if (b) b.disabled = true;
    });
    try {
      say("Finding your location...");
      let here;
      try {
        here = await window.safemeLocation.get({ maxAgeMs: 60000 });
      } catch (e) {
        return fail(e.message);
      }

      say("Searching OpenStreetMap near you...");
      let json;
      try {
        json = await overpass(buildQuery(here));
      } catch (e) {
        return fail(
          !navigator.onLine
            ? "You are offline. Searching nearby places needs internet."
            : e && e.name === "AbortError"
              ? "The map data service took too long. Try again in a minute."
              : "The map data service is not responding. Try again in a minute.",
        );
      }

      results = parse(json, here);
      if (!results.length)
        return fail(
          "No police stations or hospitals found within 5 km in OpenStreetMap. Its data can be incomplete. In an emergency, call 112.",
        );

      say(
        `Found ${results.length} place${results.length === 1 ? "" : "s"} within 5 km, nearest first.`,
      );
      renderList("#careList", results);
      renderList("#careSosList", results.slice(0, 3));

      const m = ensureCareMap();
      if (m) {
        drawOn(m, here);
        const you = L.circleMarker([here.lat, here.lng], {
          radius: 9,
          weight: 3,
          color: "#F0C38E",
          fillColor: "#F1AA9B",
          fillOpacity: 1,
        }).bindPopup("You are here");
        if (m.__you) m.__you.remove();
        m.__you = you.addTo(m);
        m.invalidateSize();
        m.fitBounds(
          L.latLngBounds([
            [here.lat, here.lng],
            ...results.map((r) => [r.lat, r.lng]),
          ]),
          { padding: [24, 24] },
        );
      }
      drawOn(window.safemeMap, here); // the SOS dashboard map, if it exists
    } finally {
      busy = false;
      ["#careBtn", "#careSosBtn"].forEach((s) => {
        const b = $(s);
        if (b) b.disabled = false;
      });
    }
  }

  const a = $("#careBtn"),
    b = $("#careSosBtn");
  if (a) a.onclick = search;
  if (b) b.onclick = search;
  window.safemeNearby = { search, parse, distanceM }; // exposed so it can be tested
})();
