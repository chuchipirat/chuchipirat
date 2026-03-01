/**
 * GlobalSettings — Typdefinition für globale Einstellungen.
 *
 * @deprecated Verwende stattdessen GlobalSettingsDomain aus GlobalSettingsRepository.
 * Diese Klasse wird nur noch für die Kompatibilität mit dem bestehenden Reducer verwendet,
 * bis alle Consumer auf die Domain-Interfaces umgestellt sind.
 *
 * @param allowSignUp - Ob die Registrierung erlaubt ist
 * @param maintenanceMode - Ob der Wartungsmodus aktiv ist
 */
class GlobalSettings {
  allowSignUp: boolean;
  maintenanceMode: boolean;

  constructor() {
    this.allowSignUp = false;
    this.maintenanceMode = false;
  }
}

export default GlobalSettings;
