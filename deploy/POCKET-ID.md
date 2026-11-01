# Pocket ID (optional, ab Shoot-It 1.23.0)

Pocket ID ergänzt Passwort und Google. Nach Installation oder Upgrade ist die
Integration deaktiviert. SCIM, Gruppenrechte, Single Logout und automatische
Benutzersperren gehören nicht zu dieser Integration.

## Einrichtung

1. Shoot-It aktualisieren. Der vorhandene Migrationsprozess ergänzt ausschließlich
   die Tabelle `PocketIdSettings`; bestehende Konten bleiben erhalten.
2. `AUTH_URL` auf die öffentliche Shoot-It-Adresse setzen. Als lokaler Administrator
   unter **Administration → Pocket ID** die Callback-URL kopieren:
   `https://shoot-it.example/api/auth/callback/pocket-id`.
3. In Pocket ID einen **vertraulichen OIDC-Client** mit genau dieser Callback-URL
   erstellen. Auf der Zugriffsseite die gewünschten Nutzergruppen oder alle Nutzer
   freigeben. Client-ID und Client-Secret kopieren.
4. In Shoot-It Issuer-Basisadresse (z. B. `https://id.example`, ohne
   `/.well-known/openid-configuration`), Client-ID und Secret eintragen.
   **Discovery prüfen** kontrolliert Metadaten und Erreichbarkeit, nicht das Secret.
5. Aktivieren und speichern. In einem separaten Browserprofil über **Mit Pocket ID
   anmelden** testen; die lokale Admin-Sitzung zunächst offen lassen.

Issuer und Discovery-Endpunkte müssen auch aus dem Shoot-It-Container erreichbar
sein. HTTPS mit gültigem Zertifikat ist erforderlich, auch bei internen Hostnamen.
HTTP ist nur mit `NODE_ENV=development` und `localhost`, `127.0.0.1` oder `::1`
erlaubt. Angefordert werden `openid profile email`. Ein fehlender oder falscher
`email_verified`-Claim blockiert die Anmeldung. Bestätige die E-Mail in Pocket ID,
statt die Verifikation in Shoot-It abzuschalten.

## Konten und Vertrauen

- Pocket-ID-Nutzer dürfen unabhängig von `OPEN`, `CLOSED` und `INVITE_ONLY` Konten
  erhalten. Neue Konten haben keine Admin-, Eigentümer- oder Projektberechtigungen.
- Eine bestätigte E-Mail verbindet ein Bestandskonto automatisch, ohne Beachtung
  der Groß-/Kleinschreibung. Das gilt **auch für Administratoren**. Die
  Pocket-ID-Administration muss daher vollständig vertrauenswürdig sein.
- Mehrdeutige E-Mail-Treffer und widersprüchliche Verbindungen werden abgelehnt.
  Es erfolgt keine automatische Zusammenführung.
- Nach der ersten Verbindung entscheidet die unveränderliche Benutzer-ID (`sub`).
  Eine geänderte E-Mail verschiebt die Verbindung nicht auf ein anderes Konto.
  Lokale Namen, Bilder, Inhalte und Rechte bleiben erhalten.
- Sperrung oder Löschung in Pocket ID beendet keine Shoot-It-Sitzung und sperrt
  keine vorhandene Passwort-/Google-Anmeldung. Logout bleibt lokal.

## Betrieb und Wiederherstellung

Einstellungen wirken ohne Neustart. Das Secret wird per AES-256-GCM mit einem
per HKDF aus `AUTH_SECRET` abgeleiteten Schlüssel verschlüsselt und nie an den
Browser zurückgeliefert. Datenbank **und `AUTH_SECRET`** sichern. Bei Wechsel oder
Verlust von `AUTH_SECRET` muss das Client-Secret erneut eingegeben werden; auch
die bestehende Auth.js-Sitzungsverschlüsselung hängt von diesem Wert ab.

Für die Rotation ein neues Client-Secret speichern; ein leeres Feld behält das
bisherige. Bei unlesbarem Secret wird nur Pocket ID ausgeblendet. Lokale Anmeldung
bleibt verfügbar. Deaktivieren löscht keine Konten oder Verbindungen. Nach der
ersten Verbindung ist ein Issuer-Wechsel gesperrt, damit externe Kennungen keiner
fremden Instanz zugeordnet werden.

Die Migration ist additiv. Ein Anwendungs-Rollback erfordert keine Löschung der
neuen Tabelle. Ein lokales Administratorkonto sollte beibehalten werden.

## Prüfung

`npm run test:pocket-id` verlangt `TEST_DATABASE_URL` mit Datenbankname `_test` und
verwendet ein anschließend entferntes Schema. Der Test prüft echte Auth.js-OIDC-
Callbacks gegen einen synthetischen Anbieter: PKCE, State, Nonce, JOSE-Signaturen,
Kontoverknüpfung, parallele Anlage, Registrierungsregeln, Secret-Rotation und Admin-
API. Bestehende Migrations- und Container-Tests prüfen Upgrades und Datenhaltung.
