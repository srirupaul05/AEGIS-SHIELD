// js/locationService.js - the ONE place that knows where the user is.
// Other modules read window.safemeLastPosition, or call safemeLocation.get() for a fresh fix.
(function () {
  window.safemeLastPosition = null; // { lat, lng, accuracy, timestamp } or null if we have no fix yet

  // Store a position. The SOS code calls this on every timed update, so both always agree.
  function set(p) {
    if (!p || typeof p.lat !== "number" || typeof p.lng !== "number") return;
    window.safemeLastPosition = {
      lat: p.lat,
      lng: p.lng,
      accuracy: p.accuracy ?? p.acc ?? null,
      timestamp: Date.now(),
    };
    document.dispatchEvent(
      new CustomEvent("safeme:position", { detail: window.safemeLastPosition }),
    );
  }

  // Resolves with a position, or rejects with { code, message }.
  // maxAgeMs: reuse the last fix if it is newer than this (saves time during an SOS).
  function get(opts) {
    const maxAge = (opts && opts.maxAgeMs) || 0;
    const last = window.safemeLastPosition;
    if (maxAge && last && Date.now() - last.timestamp <= maxAge)
      return Promise.resolve(last);
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation)
        return reject({
          code: "unsupported",
          message: "This browser cannot read your location.",
        });
      navigator.geolocation.getCurrentPosition(
        (p) => {
          set({
            lat: p.coords.latitude,
            lng: p.coords.longitude,
            accuracy: p.coords.accuracy,
          });
          resolve(window.safemeLastPosition);
        },
        (e) =>
          reject(
            e.code === 1
              ? {
                  code: "denied",
                  message:
                    "Location is blocked. Allow it in your browser settings, then try again.",
                }
              : e.code === 3
                ? {
                    code: "timeout",
                    message:
                      "Finding your location took too long. Move near a window or outside and try again.",
                  }
                : {
                    code: "unavailable",
                    message: "Your location is not available right now.",
                  },
          ),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    });
  }

  window.safemeLocation = { get, set };
})();
