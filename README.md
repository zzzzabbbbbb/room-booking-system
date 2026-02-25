# Room Booking App

A simple room booking system for Google Calendar with Slack notifications.

## Features

- 📅 Weekly calendar grid view
- 🔄 Drag-and-drop booking
- 🤖 Slack bot reminders
- 📊 Real-time availability dashboard

## Setup

### 1. Apps Script Project

1. Go to [script.google.com](https://script.google.com)
2. Create new project
3. Copy all `.js` and `.html` files

### 2. Enable Google Calendar API

1. Apps Script Editor → Services (+)
2. Add **Google Calendar API**

### 3. Configure Script Properties

Project Settings → Script Properties → Add:

```
SLACK_BOT_TOKEN          = xoxb-your-token
SLACK_ADMIN_ID           = UXXXXXXXXXX
SLACK_DEFAULT_CHANNEL    = CXXXXXXXXXX
WEB_APP_URL              = (will set after deploy)
```

### 4. Update Room Calendars

Edit `App.js` - Replace placeholder IDs with your actual room calendar IDs:

```javascript
const ROOM_CALENDARS = {
  A: 'c_xxxxx@resource.calendar.google.com',
  B: 'c_yyyyy@resource.calendar.google.com'
  // Add your rooms
};

const ROOM_LABELS = {
  A: 'Conference Room A · 4 people',
  B: 'Conference Room B · 8 people'
  // Match your rooms
};
```

### 5. Deploy

1. Deploy → New deployment → Web app
2. Execute as: **Me**
3. Access: **Anyone within yourcompany.com**
4. Copy URL and add to Script Properties as `WEB_APP_URL`

### 6. Slack Integration

1. Create Slack app at [api.slack.com/apps](https://api.slack.com/apps)
2. Add bot scopes: `chat:write`, `im:write`, `users:read`
3. Install to workspace
4. Copy Bot Token to Script Properties

### 7. Set up Triggers

Apps Script → Triggers → Add:

- `remindUpcomingBookings` - Every 1 minute
- `remindEndingBookings` - Every 1 minute
- `sendDailyDigest` - Daily at 8:00 AM
- `notifyRecentRoomBookings` - Every 1 minute

## Files

- `App.js` - Main backend logic
- `bot.js` - Slack integration
- `UI.html` - Frontend interface
- `bot-home.html` - Slack app home

## Configuration

### Work Hours

Edit `App.js`:

```javascript
const WORK_START = 6;   // 06:00
const WORK_END = 17;    // 17:00
```

### Slack User Mapping

Store in Script Properties:

```javascript
// One-time setup
PropertiesService.getScriptProperties()
  .setProperty('SLACK_USER_MAP_user@company.com', 'UXXXXXXXXXX');
```

## Usage

### Book a Room

1. Open web app URL
2. Click and drag on calendar
3. Fill meeting details
4. Submit

### Slack Notifications

- ⏰ 15 min before meeting starts
- 🏁 10 min before meeting ends
- ☀️ Daily digest at 8:00 AM

## Troubleshooting

**Slack not working?**
- Check `SLACK_BOT_TOKEN` in Script Properties
- Verify bot has required scopes

**Calendar not loading?**
- Check Calendar API quota
- Verify calendar sharing permissions

## License

Internal use only

## Contact

For issues or questions, contact your Zab.
