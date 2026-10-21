import { useId, useState } from 'react';
import { roomSettingsSchema, ROOM_LIMITS, type RoomSettings } from '@penshow/shared';
import { strings } from '../../strings/pt-BR';
import { Button } from '../../ui/button';

export function SettingsForm({
  settings,
  busy,
  disabled,
  submitLabel,
  onSave,
}: {
  settings: RoomSettings;
  busy: boolean;
  disabled: boolean;
  submitLabel: string;
  onSave: (settings: RoomSettings) => Promise<boolean>;
}) {
  const id = useId();
  const [capacity, setCapacity] = useState(String(settings.maxPlayers));
  const [themes, setThemes] = useState(settings.enabledCategories);
  const [invalid, setInvalid] = useState(false);
  const [saved, setSaved] = useState(false);
  const options = [
    ...new Set([...Object.keys(strings.room.themeNames), ...settings.enabledCategories]),
  ];
  return (
    <form
      noValidate
      className="settings-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const parsed = roomSettingsSchema.safeParse({
          format: settings.format,
          maxPlayers: Number(capacity),
          enabledCategories: themes,
        });
        setInvalid(!parsed.success);
        setSaved(false);
        if (parsed.success) setSaved(await onSave(parsed.data));
      }}
    >
      <fieldset disabled={busy || disabled} aria-describedby={invalid ? `${id}-error` : undefined}>
        <legend>{strings.room.settings}</legend>
        <label htmlFor={`${id}-capacity`}>{strings.room.capacity}</label>
        <input
          id={`${id}-capacity`}
          type="number"
          min={ROOM_LIMITS.minPlayers}
          max={ROOM_LIMITS.maxPlayers}
          value={capacity}
          onChange={(event) => {
            setCapacity(event.target.value);
            setSaved(false);
          }}
        />
        <fieldset className="theme-options">
          <legend>{strings.room.themes}</legend>
          {options.map((theme) => (
            <label key={theme}>
              <input
                type="checkbox"
                checked={themes.includes(theme)}
                onChange={(event) => {
                  setThemes(
                    event.target.checked
                      ? [...themes, theme]
                      : themes.filter((value) => value !== theme),
                  );
                  setSaved(false);
                }}
              />
              {strings.room.themeNames[theme] ?? theme}
            </label>
          ))}
        </fieldset>
        <p className="help-text">{strings.room.themesPending}</p>
        {invalid && (
          <p id={`${id}-error`} className="field-error" role="alert">
            {strings.room.settingsError}
          </p>
        )}
        <Button type="submit">{busy ? strings.room.working : submitLabel}</Button>
      </fieldset>
      {saved && <p role="status">{strings.room.settingsSaved}</p>}
    </form>
  );
}
