# AEGIS-SHIELD

**One emergency trigger, multiple layers of protection.**

AEGIS-SHIELD is a personal safety and emergency-response web application. With a single trigger, a user can start an emergency mode that gets their location, alerts trusted contacts, keeps sharing location at regular intervals, and offers extra safety tools such as a fake incoming call and evidence capture.

Built for the online hackathon **Axion** by team **Ciao Bella**.

Live Demo (Demo Site) : https://aegis-shield-pearl.vercel.app
Live demo (Actual Site): https://aegis-shield-gamma.vercel.app

---


## Problem

In an emergency, a person may not be able to unlock a phone, find the right app, type a message, or make a call. Existing safety tools usually do only one thing. SAFEME-AL combines several protections behind one quick action, so the user does not have to think about which tool to use.

---

## Features

| Feature | Description | Status |
|---|---|---|
| Emergency SOS | Activate SOS, confirm or cancel during a countdown, then enter emergency mode | Prototype |
| Emergency dashboard | Shows emergency status, coordinates, map, last update time and sharing status | Prototype |
| Live location | Gets the user's position using the browser Geolocation API and shows it on a map | Prototype |
| Timed location updates | Refreshes location every X seconds during an emergency; the interval is configurable | Prototype |
| Emergency contacts | Add trusted contacts with name, phone number, relationship and preference | Prototype |
| Emergency people connect | Call, SMS or share location with trusted contacts | Prototype |
| Fake call | Simulated incoming call with a configurable caller name (for example "Mom") | Prototype |
| Silent evidence capture | Records audio (and optionally video) during an emergency, with permission, timestamped | Prototype |
| One-tap 112 call | Opens the phone dialer with the emergency number | Prototype |
| Biometric confirmation | Device fingerprint or face confirmation using WebAuthn, where supported | Planned / mock flow |
| Volume-button SOS | Volume button, then biometric confirmation, then SOS | Simulated (needs native app) |
| Offline SOS | Device-to-device relay when there is no internet | Simulated (needs native app) |

Status meanings:

- **Prototype**: works in the browser for a live demonstration.
- **Planned / mock flow**: designed, and shown as a clearly labelled mock where real support is not available.
- **Simulated**: the concept is demonstrated in the UI, but the real implementation needs native Android functionality. See [Limitations](#limitations-and-honest-scope).

---

## How the SOS Flow Works

```text
User activates SOS
        |
        v
Confirmation countdown (confirm or cancel)
        |
        v
Emergency mode starts
        |
        v
Location is obtained
        |
        v
Trusted contacts are notified
        |
        v
Location is updated every X seconds
        |
        v
Emergency status is displayed on the dashboard
```

The countdown exists to reduce accidental activations. During emergency mode the screen is kept awake (Wake Lock API) so location updates continue.

---

## Tech Stack

**Frontend**

- HTML, CSS and JavaScript (no framework)
- Progressive Web App approach (installable, mobile-first)
- Leaflet and OpenStreetMap for maps
- Geolocation API for location
- Wake Lock API to keep the screen on during an emergency
- MediaRecorder API for audio/video evidence
- IndexedDB for storing evidence and data on the device
- WebAuthn for biometric confirmation where supported

**Backend**

- Node.js with Express
- SQL database (SQLite for the prototype)
- JWT for authentication
- bcrypt for password hashing
- Input validation and rate limiting

**Deployment**

- Vercel for the frontend and API
- GitHub for source control


## Limitations and Honest Scope

This is a hackathon prototype. These are the real limits of the current version.

**Volume-button SOS.** A web app cannot intercept hardware volume buttons, especially when the screen is off or the app is in the background. Android and iOS restrict this for security. The prototype simulates the flow. A production version needs a native Android app (for example using an accessibility or foreground service) or a platform-approved trigger.

**Biometric confirmation.** Where the browser and device support it, WebAuthn is used for fingerprint or face confirmation. Where it is not supported, the app shows a clearly labelled mock confirmation.

**Offline SOS.** A browser cannot do unrestricted Bluetooth or Wi-Fi Direct relay. The offline SOS in this prototype is a simulation of the intended behaviour: SOS, nearby device detection, device-to-device relay, emergency message. A real implementation needs native Android with Bluetooth Low Energy or Wi-Fi Direct (such as Nearby Connections).

**Contacting people.** The app uses the phone's own dialer and messaging links for calls and SMS. A web app cannot silently send SMS on its own. SAFEME-AL does not directly contact police or emergency services; the one-tap 112 button only opens the dialer.

**Evidence capture.** Recording only starts after the user grants microphone (and camera) permission, and the app tells the user it is recording. It does not bypass device permissions or record secretly. Browsers may stop recording if the page is closed or the phone is locked.

**Location updates.** Timed updates work while the app is open and the screen is kept awake. Browsers do not guarantee background location tracking.

---

## Future Scope

- Native Android app for real volume-button triggering and background behaviour
- True offline SOS using Bluetooth Low Energy or Wi-Fi Direct relay
- Automatic SMS delivery through a messaging service
- Encrypted cloud storage for evidence
- Live location tracking page for trusted contacts
- Integration with official emergency-response services where available
- Multilingual support (English, Hindi, Bengali)

---

## License

To be decided by the team before final submission.
