# Sound effects

Six licensed tracks, served from this directory. They are **not** committed —
the licences are per-account, so the files are exported from the account that
holds them and dropped in here (and kept out of git; see `.gitignore` beside
this file).

`src/lib/sounds.ts` looks each one up by name. Until a file is present its effect
falls back to a synthesised stand-in, so the app is never silent — but the
stand-ins are placeholders, not the intended sounds.

| File | Plays when |
| --- | --- |
| `notification.mp3` | A notification arrives in the bell. Once per batch, and at most once in ten minutes — see `CHIME_QUIET_MS` in `hooks/queries/notifications.ts` |
| `delete.mp3` | Any bin icon is clicked, anywhere: a task, a routine, a subtask, an attachment, a checklist row |
| `empty-trash.mp3` | "Esvaziar lixeira" in the routine trash |
| `sweep.mp3` | The broom that clears a note (Limpar) |
| `countdown-end.mp3` | The Time blocking countdown reaches zero |
| `task-completed.mp3` | A task moves to "Feita" |

Export as MP3 and keep the names exactly as above — nothing else needs changing.
