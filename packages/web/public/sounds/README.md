# Sound effects

Five licensed Epidemic Sound tracks, served from this directory. They are **not**
committed — Epidemic Sound licences are per-account, so the files are exported
from the account that holds the licence and dropped in here (and kept out of git;
see `.gitignore` beside this file).

`src/lib/sounds.ts` looks each one up by name. Until a file is present its effect
falls back to a synthesised stand-in, so the app is never silent — but the
stand-ins are placeholders, not the intended sounds.

| File | Plays when | Source |
| --- | --- | --- |
| `notification.mp3` | A notification arrives in the bell | [Alert, Alerts, Notification 15](https://www.epidemicsound.com/sound-effects/tracks/03912ce4-2784-4547-98a5-aa5404704118/) |
| `delete.mp3` | Any bin icon is clicked, anywhere | [track](https://www.epidemicsound.com/sound-effects/tracks/39f57618-645c-47f8-82a7-5e74766969fb/) |
| `sweep.mp3` | Any broom button is pressed (Limpar, Esvaziar lixeira) | [track](https://www.epidemicsound.com/sound-effects/tracks/fa77255b-35e9-447d-a5dd-f9f0f1f57e32/) |
| `countdown-end.mp3` | The Time blocking countdown reaches zero | [track](https://www.epidemicsound.com/sound-effects/tracks/a34a8492-af26-4685-a907-4705f172e353/) |
| `task-completed.mp3` | A task moves to "Concluído" | [track](https://www.epidemicsound.com/sound-effects/tracks/45c94b43-2fb0-4970-98db-cc0fe6ea3678/) |

Export as MP3 and keep the names exactly as above — nothing else needs changing.
