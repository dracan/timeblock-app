Create a Windows desktop app for time-blocking the current day.
This does not need to integrate with a calendar.
The reason for this app is to plan my day when I'm on a client's laptop, and I don't have access to my own Google Calendar, but I don't want to use the crappy Outlook Calendar UI that the client's email uses.

This app just needs the following:

- A one-day view
- The user can:
  - Click and drag vertically with the mouse to create an entry
  - Drag existing entries up and down. This won't change the duration.
  - Resize entries up and down by dragging either the top of bottom of an entry. Top to change the start time, and bottom to change the end time.
  - Ctrl-click to select multiple entries. The user can then drag all selected entries up and down the timeline.
  - Change the entry's colour via a right-click menu.
- Each entry will show:
  - A title
  - The start and end date
- This information needs persisting to a local file so that I can close and re-open it without losing any data. Ideally this should be a markdown file, so I can look at previous days easily in a markdown editor.
- It needs a dark theme

