# Agent

- **Versioning**
  - Respect Semantic Versioning and update the `package.json` accordingly before each commit.
  - Maintain the `CHANGELOG.md` for every release version, documenting all notable changes (Added, Changed, Fixed, Removed).
  - The application version in the UI (Footer) is automatically pulled from `package.json`, so only update the version there.

- **DB Migration**
  - Always keep in mind to make it easy upgradeable and maintainable. So if sth changes there need to be a way to upgrade it without loosing data. So try to avoid any data loss or provide a upgrade script

- **Localization (i18n)**: Always use the localization system for UI text.
  - Text should be stored in `src/dictionaries/de.json` and `src/dictionaries/en.json`.
  - In Server Components, use `getLocale` and `getDictionary` from `@/lib/i18n`.
  - In Client Components, use the `useI18n` hook from `@/components/I18nProvider`.
  - Default language is German, but English translations should always be provided.
