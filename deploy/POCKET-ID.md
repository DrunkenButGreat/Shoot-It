# Pocket ID (optional, ab Shoot-It 1.23.0)

Pocket ID ergänzt Passwort und Google. Nach Installation oder Upgrade ist die
Integration deaktiviert. SCIM, Gruppenrechte, Single Logout und automatische
Benutzersperren gehören nicht zu dieser Integration.

## Einrichtung

1. Shoot-It aktualisieren. Der vorhandene Migrationsprozess ergänzt ausschließlich
   die Tabelle `PocketIdSettings` und ab 1.24.1 die optionale Spalte
   `SiteSettings.publicUrl`; bestehende Konten und Einstellungen bleiben erhalten.
2. Als lokaler Administrator unter **Administration → Pocket ID** die
   **Öffentliche Shoot-It-URL** setzen, zum Beispiel mit **Aktuelle Browser-URL
   übernehmen**. HTTPS-Adresse ohne Unterpfad verwenden. Die angezeigte Callback-URL
   kopieren:
   `https://shoot-it.example/api/auth/callback/pocket-id`.
3. In Pocket ID einen **vertraulichen OIDC-Client** mit genau dieser Callback-URL
   erstellen. Auf der Zugriffsseite die gewünschten Nutzergruppen oder alle Nutzer
   freigeben. Client-ID und Client-Secret kopieren.
4. In Shoot-It die **OIDC-Discovery-URL** aus Pocket ID einfügen, zum Beispiel
   `https://id.example/.well-known/openid-configuration`, sowie Client-ID und Secret
   eintragen. Die bisherige Issuer-Basisadresse wird weiterhin akzeptiert.
   **Discovery prüfen** kontrolliert Metadaten und Erreichbarkeit, nicht das Secret.
5. Aktivieren und speichern. Nach einer Änderung der öffentlichen URL erneut
   anmelden; durch HTTPS oder einen Hostwechsel können andere Sitzungscookies
   erforderlich sein. Anschließend in einem separaten Browserprofil über
   **Mit Pocket ID anmelden** testen.

Issuer und Discovery-Endpunkte müssen auch aus dem Shoot-It-Container erreichbar
sein. HTTPS mit gültigem Zertifikat ist erforderlich, auch bei internen Hostnamen.
HTTP ist nur mit `NODE_ENV=development` und `localhost`, `127.0.0.1` oder `::1`
erlaubt. Angefordert werden `openid profile email`. Ein fehlender oder falscher
`email_verified`-Claim blockiert die Anmeldung. Bestätige die E-Mail in Pocket ID,
statt die Verifikation in Shoot-It abzuschalten.

## Reverse Proxy und öffentliche URL

Die gespeicherte öffentliche URL gilt ohne Neustart für OAuth-Callbacks,
Anmelde-Rücksprünge, sichere Sitzungscookies und Projektlinks in E-Mails. Sie hat
Vorrang vor `AUTH_URL` bzw. `NEXTAUTH_URL`; ein leeres Feld verwendet wieder diese
Umgebungsvariablen. Im Container darf HTTP verwendet werden, während der Proxy
extern HTTPS bereitstellt. Die öffentliche URL muss im Browser erreichbar sein.

Ein aktueller Browser kann die Einstellung auch dann erstmals speichern, wenn
`AUTH_URL` im Container noch die falsche interne Adresse enthält: Die Admin-API
prüft die browserseitige Same-Origin-Kennung zusätzlich zur Admin-Sitzung und
JSON-Anforderung. Fremde Webseiten erhalten dadurch keine Schreibberechtigung.
Clients ohne Fetch-Metadata-Header müssen weiterhin einen zur konfigurierten
öffentlichen URL passenden `Origin` senden.

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
neuen Tabelle oder Spalte. Ein lokales Administratorkonto sollte beibehalten werden.

## Prüfung

`npm run test:pocket-id` verlangt `TEST_DATABASE_URL` mit Datenbankname `_test` und
verwendet ein anschließend entferntes Schema. Der Test prüft echte Auth.js-OIDC-
Callbacks gegen einen synthetischen Anbieter: PKCE, State, Nonce, JOSE-Signaturen,
Kontoverknüpfung, parallele Anlage, Registrierungsregeln, Secret-Rotation und Admin-
API sowie Proxy-Ursprünge, öffentliche Callbacks und sichere Cookies trotz
abweichendem `AUTH_URL`. Bestehende Migrations- und Container-Tests prüfen Upgrades und Datenhaltung.
