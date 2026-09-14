/** @OnlyCurrentDoc
 * Room Booking App
 * -----------------------------------------
 * - Weekly grid with drag, resize, and quick suggestions
 * - Requires the "Calendar" Advanced Google Service
 * - Room calendars must be shared with the executing user/service account
 */

// =====================================================================
// ===                    DEMO CONFIGURATION                         ===
// ===              👇 THIS IS THE ONLY BLOCK YOU EDIT 👆             ===
// =====================================================================
//
// STEP 1 — Create 3 test calendars in Google Calendar (one per room).
// STEP 2 — Open each calendar's Settings → "Integrate calendar" and copy
//          its "Calendar ID".
// STEP 3 — Paste each ID below, replacing the PASTE_..._HERE placeholder.
//          Keep the quotes. Nothing else in this file needs to change.
//
// A test calendar ID usually looks like one of these:
//   c_a1b2c3d4e5f6@group.calendar.google.com      ← calendar you created
//   c_1883...@resource.calendar.google.com        ← Workspace room resource
//
// Full walkthrough: see DEMO_SETUP.md
// ---------------------------------------------------------------------

const ROOM_CALENDARS = {
  A:   'PASTE_ROOM_A_CALENDAR_ID_HERE',   // → shows as "Room A" in the grid
  B:   'PASTE_ROOM_B_CALENDAR_ID_HERE',   // → shows as "Room B" in the grid
  C:   'PASTE_ROOM_C_CALENDAR_ID_HERE'    // → shows as "Room C" in the grid
  // Add more rooms as needed — add a matching entry to ROOM_LABELS below.
};

// Display names shown in the UI. Keys MUST match ROOM_CALENDARS above.
const ROOM_LABELS = {
  A:   'Room A · 4 people',
  B:   'Room B · 6 people',
  C:   'Room C · 10 people'
};

// --- Optional: grid hours shown in the demo (defaults are fine) -------
const WORK_START = 6;   // 06:00 local
const WORK_END = 17;    // 17:00 local
const SLOT_MIN = 30;    // minutes per grid cell
const WEEK_DAYS = 5;    // Monday–Friday

// =====================================================================
// ===                  END OF DEMO CONFIGURATION                    ===
// ===        Everything below is app logic — no need to touch.      ===
// =====================================================================

const CALENDAR_ID_TO_ROOM = Object.keys(ROOM_CALENDARS).reduce(function(map, key) {
  map[ROOM_CALENDARS[key]] = key;
  return map;
}, {});

const EVENT_SUGGESTION_LOOKAHEAD_DAYS = 7; // How many days ahead to check for personal events
const EVENT_SUGGESTION_MIN_DURATION_MIN = 15; // Ignore very short events

//////////////////////
// Utilities
//////////////////////

function toISO(date) {
  var pad = function(value) { return String(value).padStart(2, '0'); };
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
         'T' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':00';
}

/**
 * Calculate duration in minutes between two ISO datetime strings
 */
function calculateDuration(startISO, endISO) {
  try {
    var start = new Date(startISO);
    var end = new Date(endISO);
    return Math.round((end.getTime() - start.getTime()) / 60000);
  } catch (error) {
    return '';
  }
}

function humanizeEmail(email) {
  if (!email) return '';
  var local = String(email).split('@')[0];
  if (!local) return email;
  var parts = local.split(/[._-]+/).filter(function(part) { return part && part.length; });
  if (!parts.length) return local.charAt(0).toUpperCase() + local.slice(1);
  return parts.map(function(part) {
    return part.charAt(0).toUpperCase() + part.slice(1);
  }).join(' ');
}

//////////////////////
// Server endpoints
//////////////////////

/** Build the weekly availability grid. */
function getWeekGrid(payload) {
  var weekStartISO = payload && payload.weekStartISO;
  var slotMin = (payload && payload.slotMin) || SLOT_MIN;
  var workStart = (payload && payload.workStart) || WORK_START;
  var workEnd = (payload && payload.workEnd) || WORK_END;

  if (!weekStartISO) throw new Error('Missing weekStartISO (YYYY-MM-DD).');

  var startOfWeek = new Date(weekStartISO + 'T00:00:00');
  var dayOfWeek = (startOfWeek.getDay() + 6) % 7; // convert Sunday=0 to Monday=0
  startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);

  var tz = Session.getScriptTimeZone();

  // Build labels per day and the column matrix
  var dayLabels = [];
  var timesPerDay = [];
  for (var day = 0; day < WEEK_DAYS; day++) {
    var base = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + day, 0, 0, 0);
    dayLabels.push(Utilities.formatDate(base, tz, 'EEE dd/MM'));

    var dayStart = new Date(base.getFullYear(), base.getMonth(), base.getDate(), workStart, 0, 0);
    var dayEnd = new Date(base.getFullYear(), base.getMonth(), base.getDate(), workEnd, 0, 0);

    var slots = [];
    for (var time = dayStart.getTime(); time < dayEnd.getTime(); time += slotMin * 60000) {
      var slotStart = new Date(time);
      var slotEnd = new Date(time + slotMin * 60000);
      slots.push({
        startMs: time,
        endMs: time + slotMin * 60000,
        startISO: toISO(slotStart),
        endISO: toISO(slotEnd),
        label: Utilities.formatDate(slotStart, tz, 'HH:mm')
      });
    }
    timesPerDay.push(slots);
  }

  var slotsPerDay = timesPerDay.length ? timesPerDay[0].length : 0;

  var columns = [];
  for (var dayIndex = 0; dayIndex < WEEK_DAYS; dayIndex++) {
    var dayCols = timesPerDay[dayIndex];
    for (var col = 0; col < dayCols.length; col++) {
      columns.push(dayCols[col]);
    }
  }

  var weekStart = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate(), 0, 0, 0);
  var weekEnd = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + WEEK_DAYS, 23, 59, 59);

  var freebusy = Calendar.Freebusy.query({
    timeMin: weekStart.toISOString(),
    timeMax: weekEnd.toISOString(),
    items: Object.values(ROOM_CALENDARS).map(function(id) { return { id: id }; })
  });

  var eventsByRoom = {};
  Object.keys(ROOM_CALENDARS).forEach(function(roomKey) {
    var calendarId = ROOM_CALENDARS[roomKey];
    var events = [];
    try {
      var response = Calendar.Events.list(calendarId, {
        timeMin: weekStart.toISOString(),
        timeMax: weekEnd.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 250,
        alwaysIncludeEmail: true,
        fields: 'items(id,summary,start,end,status,organizer(email,displayName),creator(email,displayName),attendees(email,displayName,resource,responseStatus))'
      });
      events = (response && response.items) ? response.items : [];
    } catch (error) {
      events = [];
    }

    eventsByRoom[calendarId] = events.map(function(event) {
      var summary = (event.summary && event.summary.trim()) ? event.summary.trim() : 'Busy';

      var organizerEmail = '';
      var organizerDisplay = '';

      if (event.organizer && !CALENDAR_ID_TO_ROOM[event.organizer.email || '']) {
        if (event.organizer.email) {
          organizerEmail = String(event.organizer.email).trim();
        }
        if (event.organizer.displayName) {
          organizerDisplay = event.organizer.displayName;
        }
      }

      if (!organizerEmail && event.creator && !CALENDAR_ID_TO_ROOM[event.creator.email || '']) {
        if (event.creator.email) {
          organizerEmail = String(event.creator.email).trim();
        }
        if (!organizerDisplay && event.creator.displayName) {
          organizerDisplay = event.creator.displayName;
        }
      }

      if (!organizerEmail && event.attendees && event.attendees.length) {
        var humanAttendee = event.attendees.find(function(attendee) {
          if (!attendee || !attendee.email) return false;
          if (attendee.resource) return false;
          if (attendee.responseStatus === 'declined') return false;
          return !CALENDAR_ID_TO_ROOM[attendee.email];
        });
        if (humanAttendee) {
          if (humanAttendee.email) {
            organizerEmail = String(humanAttendee.email).trim();
          }
          if (!organizerDisplay && humanAttendee.displayName) {
            organizerDisplay = humanAttendee.displayName;
          }
        }
      }

      if (organizerDisplay) {
        organizerDisplay = String(organizerDisplay).trim();
      }
      if (!organizerDisplay && organizerEmail) {
        var friendly = humanizeEmail(organizerEmail);
        organizerDisplay = friendly || organizerEmail;
      }
      if (!organizerEmail && organizerDisplay) {
        organizerEmail = organizerDisplay;
      }
      var organizerName = organizerDisplay || humanizeEmail(organizerEmail) || organizerEmail || '';

      return {
        start: new Date(event.start.dateTime || event.start.date).getTime(),
        end: new Date(event.end.dateTime || event.end.date).getTime(),
        summary: summary,
        organizerEmail: organizerEmail,
        organizerDisplay: organizerDisplay,
        organizerName: organizerName
      };
    });
  });

  var rooms = Object.keys(ROOM_CALENDARS).map(function(roomKey) {
    var calendarId = ROOM_CALENDARS[roomKey];
    var busyBlocks = (freebusy.calendars[calendarId] && freebusy.calendars[calendarId].busy)
      ? freebusy.calendars[calendarId].busy.map(function(block) {
          return { start: new Date(block.start).getTime(), end: new Date(block.end).getTime() };
        })
      : [];
    var events = eventsByRoom[calendarId];

    var cells = columns.map(function(column) {
      var isBusy = busyBlocks.some(function(block) { return !(column.endMs <= block.start || column.startMs >= block.end); });
      var peek = '';
      var hover = '';
      if (isBusy) {
        var match = events.find(function(event) { return !(column.endMs <= event.start || column.startMs >= event.end); });
        peek = (match && match.summary) ? match.summary : 'Busy';
        if (match) {
          hover = match.organizerName || match.organizerDisplay || match.organizerEmail || '';
        }
        if (!peek || peek === '(no title)') peek = 'Busy';
      }
      return {
        startISO: column.startISO,
        endISO: column.endISO,
        busy: isBusy,
        peek: peek,
        hoverUser: hover
      };
    });

    return {
      room: roomKey,
      label: ROOM_LABELS[roomKey] || roomKey,
      calendarId: calendarId,
      cells: cells
    };
  });

  return {
    weekStartISO: Utilities.formatDate(weekStart, tz, 'yyyy-MM-dd'),
    slotMin: slotMin,
    workStart: workStart,
    workEnd: workEnd,
    dayLabels: dayLabels,
    columns: columns,
    rooms: rooms,
    suggestions: buildSuggestions(columns, rooms),
    slotsPerDay: slotsPerDay
  };
}

/** Build up to six suggested free ranges across rooms. */
function buildSuggestions(columns, rooms) {
  var suggestions = [];
  rooms.forEach(function(room) {
    var cells = room.cells;
    var segmentStart = null;
    for (var index = 0; index < cells.length; index++) {
      var cell = cells[index];
      if (!cell.busy && segmentStart === null) {
        segmentStart = index;
      }
      var segmentEnded = cell.busy || index === cells.length - 1;
      if (segmentStart !== null && segmentEnded) {
        var endIndex = cell.busy ? index - 1 : index;
        if (endIndex >= segmentStart) {
          suggestions.push({
            room: room.room,
            label: room.label,
            startISO: cells[segmentStart].startISO,
            endISO: cells[endIndex].endISO,
            slots: endIndex - segmentStart + 1
          });
        }
        segmentStart = null;
      }
    }
  });

  suggestions.sort(function(a, b) {
    if (a.startISO < b.startISO) return -1;
    if (a.startISO > b.startISO) return 1;
    return a.label.localeCompare(b.label);
  });

  return suggestions.slice(0, 6);
}

/** Find the next contiguous free block for the same room. */
function findNextGap(payload) {
  var room = payload && payload.room;
  var weekStartISO = payload && payload.weekStartISO;
  var steps = payload && payload.steps;
  var startCol = payload && payload.startCol;
  if (!room || !ROOM_CALENDARS[room] || !weekStartISO || !steps) {
    throw new Error('Missing parameters when looking for the next gap.');
  }

  var grid = getWeekGrid({ weekStartISO: weekStartISO });
  var row = grid.rooms.find(function(entry) { return entry.room === room; });
  if (!row) return null;

  for (var index = Math.max(0, startCol); index <= grid.columns.length - steps; index++) {
    var available = true;
    for (var offset = 0; offset < steps; offset++) {
      if (row.cells[index + offset].busy) {
        available = false;
        break;
      }
    }
    if (available) {
      return {
        index: index,
        startISO: row.cells[index].startISO,
        endISO: row.cells[index + steps - 1].endISO
      };
    }
  }
  return null;
}

/** Create a booking after revalidating availability. */
function bookRoom(payload) {
  var room = payload && payload.room;
  var title = (payload && payload.title) ? payload.title.trim() : '';
  var startISO = payload && payload.startISO;
  var endISO = payload && payload.endISO;
  var guestEmail = (payload && payload.guestEmail) ? payload.guestEmail.trim() : '';
  var weekStartISO = payload && payload.weekStartISO;
  var startCol = payload && payload.startCol;
  var steps = payload && payload.steps;

  if (!room || !ROOM_CALENDARS[room]) throw new Error('Invalid room key.');
  if (!title) throw new Error('Missing meeting title.');
  if (!startISO || !endISO) throw new Error('Missing start or end time.');

  var calendarId = ROOM_CALENDARS[room];
  var start = new Date(startISO);
  var end = new Date(endISO);
  var organizerEmail = getActiveUserEmail();

  var freebusy = Calendar.Freebusy.query({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    items: [{ id: calendarId }]
  });
  var busyEntries = (freebusy.calendars[calendarId] && freebusy.calendars[calendarId].busy) ? freebusy.calendars[calendarId].busy : [];
  var hasOverlap = busyEntries.some(function(block) {
    var blockStart = new Date(block.start).getTime();
    var blockEnd = new Date(block.end).getTime();
    return !(end.getTime() <= blockStart || start.getTime() >= blockEnd);
  });

  if (hasOverlap) {
    var alternative = (weekStartISO && steps != null && startCol != null)
      ? findNextGap({ room: room, weekStartISO: weekStartISO, steps: steps, startCol: startCol + 1 })
      : null;
    return { conflict: true, alternative: alternative };
  }

  var userCalendar = CalendarApp.getDefaultCalendar();
  var attendees = [calendarId];
  if (guestEmail) attendees.push(guestEmail);

  // Strip capacity info from label for calendar event title
  var roomLabel = ROOM_LABELS[room] || room;
  if (roomLabel.indexOf(' · ') > -1) {
    roomLabel = roomLabel.split(' · ')[0];
  }
  var summary = '[' + roomLabel + '] ' + title;
  var event = userCalendar.createEvent(summary, start, end, {
    guests: attendees.join(','),
    sendInvites: true
  });

  var notifyEventData = null;
  try {
    var guests = event.getGuestList(true);
    var attendeeSummaries = guests.map(function(guest) {
      var responseStatus = '';
      if (typeof mapGuestStatusToResponseStatus === 'function') {
        try {
          responseStatus = mapGuestStatusToResponseStatus(guest.getGuestStatus ? guest.getGuestStatus() : '');
        } catch (mapError) {
          responseStatus = '';
        }
      }
      return {
        email: guest.getEmail(),
        displayName: (guest.getName && guest.getName()) ? guest.getName() : guest.getEmail(),
        responseStatus: responseStatus || '',
        resource: guest.isResource ? guest.isResource() : false,
        optional: guest.isOptional ? guest.isOptional() : false
      };
    });
    if (organizerEmail) {
      attendeeSummaries.push({
        email: organizerEmail,
        displayName: organizerEmail,
        responseStatus: 'accepted',
        resource: false,
        optional: false
      });
    }
    notifyEventData = {
      id: event.getId(),
      summary: summary,
      start: { dateTime: event.getStartTime().toISOString() },
      end: { dateTime: event.getEndTime().toISOString() },
      description: (event.getDescription && event.getDescription()) ? event.getDescription() : '',
      organizer: {
        email: organizerEmail || '',
        displayName: organizerEmail || ''
      },
      creator: {
        email: organizerEmail || '',
        displayName: organizerEmail || ''
      },
      attendeesOmitted: false,
      guestsCanSeeOtherGuests: true,
      attendees: attendeeSummaries
    };
  } catch (buildError) {
    console.error('Failed to build notification payload for booking:', buildError.toString());
  }

  try {
    if (typeof notifyRoomBookingConfirmation === 'function') {
      notifyRoomBookingConfirmation(room, calendarId, event.getId(), organizerEmail, notifyEventData);
    }
    if (typeof logAdminActivity === 'function') {
      logAdminActivity('✅ *Booking Created* by ' + organizerEmail + '\nRoom: ' + roomLabel + '\nEvent: ' + summary);
    }
  } catch (error) {
    console.error('Failed to send Slack booking confirmation:', error.toString());
  }

  return {
    conflict: false,
    id: event.getId(),
    startISO: toISO(event.getStartTime()),
    endISO: toISO(event.getEndTime()),
    organizer: (humanizeEmail(organizerEmail) || organizerEmail || 'You')
  };
}

/**
 * Assign a room resource to an existing personal calendar event.
 * @param {{eventId: string, room: string}} payload
 */
function assignRoomToExistingEvent(payload) {
  var eventId = payload && payload.eventId;
  var room = payload && payload.room;

  if (!eventId) throw new Error('Missing eventId.');
  if (!room || !ROOM_CALENDARS[room]) throw new Error('Invalid room key.');

  var calendarId = ROOM_CALENDARS[room];
  var event;
  try {
    event = Calendar.Events.get('primary', eventId, {
      fields: 'id,summary,start,end,attendees(email,displayName,responseStatus,optional,resource),description'
    });
  } catch (error) {
    throw new Error('Could not access the event. Please refresh and try again.');
  }

  if (!event || !event.start || !event.end) {
    throw new Error('Event is missing start or end time.');
  }

  var startValue = event.start.dateTime || null;
  var endValue = event.end.dateTime || null;
  if (!startValue || !endValue) {
    throw new Error('Only timed events can be assigned a room.');
  }

  var start = new Date(startValue);
  var end = new Date(endValue);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Event has invalid dates.');
  }

  var attendees = (event.attendees || []).map(function(attendee) {
    return {
      email: attendee.email,
      displayName: attendee.displayName,
      responseStatus: attendee.responseStatus,
      optional: attendee.optional,
      resource: attendee.resource
    };
  });

  var alreadyAssigned = attendees.some(function(attendee) {
    return attendee && attendee.email === calendarId;
  });
  if (alreadyAssigned) {
    return {
      conflict: false,
      alreadyAssigned: true,
      eventId: event.id,
      startISO: toISO(start),
      endISO: toISO(end)
    };
  }

  var freebusy = Calendar.Freebusy.query({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    items: [{ id: calendarId }]
  });
  var busyEntries = (freebusy.calendars[calendarId] && freebusy.calendars[calendarId].busy) ? freebusy.calendars[calendarId].busy : [];
  var hasOverlap = busyEntries.some(function(block) {
    var blockStart = new Date(block.start).getTime();
    var blockEnd = new Date(block.end).getTime();
    return !(end.getTime() <= blockStart || start.getTime() >= blockEnd);
  });

  if (hasOverlap) {
    return { conflict: true, reason: 'Room is no longer available.' };
  }

  attendees.push({
    email: calendarId,
    resource: true,
    responseStatus: 'needsAction'
  });

  var updatedEvent = Calendar.Events.patch(
    { attendees: attendees },
    'primary',
    eventId,
    {
      sendUpdates: 'all',
      fields: 'id,summary,start,end,organizer,creator,attendees(email,displayName,responseStatus,resource,optional),attendeesOmitted,guestsCanSeeOtherGuests,description'
    }
  );

  var updatedStart = updatedEvent && updatedEvent.start && (updatedEvent.start.dateTime || updatedEvent.start.date);
  var updatedEnd = updatedEvent && updatedEvent.end && (updatedEvent.end.dateTime || updatedEvent.end.date);
  var startISO = updatedStart ? toISO(new Date(updatedStart)) : toISO(start);
  var endISO = updatedEnd ? toISO(new Date(updatedEnd)) : toISO(end);

  var organizerEmail = getActiveUserEmail();

  try {
    if (typeof notifyRoomBookingConfirmation === 'function') {
      var finalEventId = (updatedEvent && updatedEvent.id) ? updatedEvent.id : event.id;
      notifyRoomBookingConfirmation(room, calendarId, finalEventId, organizerEmail, updatedEvent);
    }
    if (typeof logAdminActivity === 'function') {
      logAdminActivity('✅ *Room Assigned* by ' + organizerEmail + '\nRoom: ' + room + '\nEvent: ' + (event.summary || 'Untitled'));
    }
  } catch (error) {
    console.error('Failed to send Slack booking confirmation after assignment:', error.toString());
  }

  return {
    conflict: false,
    booked: true,
    eventId: (updatedEvent && updatedEvent.id) ? updatedEvent.id : event.id,
    startISO: startISO,
    endISO: endISO,
    organizer: organizerEmail || 'You'
  };
}

/**
 * Fetch upcoming personal events that do not already include a room resource.
 * Returns at most `maxEvents` entries sorted by start time.
 */
function getUpcomingPersonalEventsWithoutRoom(maxEvents) {
  var lookaheadDays = EVENT_SUGGESTION_LOOKAHEAD_DAYS || 7;
  var now = new Date();
  var rangeEnd = new Date(now.getTime() + lookaheadDays * 24 * 60 * 60 * 1000);
  var workStartMinutes = WORK_START * 60;
  var workEndMinutes = WORK_END * 60;

  var response = Calendar.Events.list('primary', {
    timeMin: now.toISOString(),
    timeMax: rangeEnd.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    showDeleted: false,
    maxResults: 200,
    fields: 'items(id,summary,start,end,attendees(email,displayName,responseStatus,optional,resource),hangoutLink,description,location,eventType,transparency,status)',
    alwaysIncludeEmail: true
  });

  var events = (response && response.items) ? response.items : [];

  var upcoming = [];
  events.forEach(function(event) {
    if (!event || event.status === 'cancelled') return;
    var startValue = event.start && event.start.dateTime;
    var endValue = event.end && event.end.dateTime;
    if (!startValue || !endValue) return;

    var start = new Date(startValue);
    var end = new Date(endValue);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return;

    if (event.eventType && event.eventType !== 'default') return;

    var summary = (event.summary && event.summary.trim()) ? event.summary.trim() : '(sin título)';
    if (/^(office|home)$/i.test(summary)) return;

    var durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
    if (durationMin <= 0) return;
    var startMinutes = start.getHours() * 60 + start.getMinutes();
    var endMinutes = end.getHours() * 60 + end.getMinutes();
    if (startMinutes < workStartMinutes || endMinutes > workEndMinutes) return;
    var dayOfWeek = start.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return;

    if (durationMin < EVENT_SUGGESTION_MIN_DURATION_MIN) return;

    var attendees = event.attendees || [];
    var hasRoom = attendees.some(function(attendee) {
      return attendee && attendee.email && CALENDAR_ID_TO_ROOM[attendee.email];
    });
    if (hasRoom) return;

    upcoming.push({
      id: event.id,
      summary: summary,
      start: start,
      end: end,
      durationMin: durationMin,
      attendees: attendees,
      hangoutLink: event.hangoutLink || '',
      location: event.location || '',
      description: event.description || ''
    });
  });

  upcoming.sort(function(a, b) {
    return a.start.getTime() - b.start.getTime();
  });

  if (maxEvents && upcoming.length > maxEvents) {
    upcoming = upcoming.slice(0, maxEvents);
  }

  return upcoming;
}

/**
 * Check availability for the provided event window across the configured rooms.
 * Returns an array of `{ room, roomLabel, available, conflictReason }`.
 */
function findAvailableRoomsForWindow(start, end) {
  var results = [];
  Object.keys(ROOM_CALENDARS).forEach(function(roomKey) {
    var calendarId = ROOM_CALENDARS[roomKey];
    var freebusy = Calendar.Freebusy.query({
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      items: [{ id: calendarId }]
    });
    var busyEntries = (freebusy.calendars[calendarId] && freebusy.calendars[calendarId].busy) ? freebusy.calendars[calendarId].busy : [];
    var hasOverlap = busyEntries.some(function(block) {
      var blockStart = new Date(block.start).getTime();
      var blockEnd = new Date(block.end).getTime();
      return !(end.getTime() <= blockStart || start.getTime() >= blockEnd);
    });

    results.push({
      room: roomKey,
      roomLabel: ROOM_LABELS[roomKey] || roomKey,
      available: !hasOverlap,
      conflictReason: hasOverlap ? 'Busy' : ''
    });
  });

  return results.filter(function(entry) { return entry.available; });
}

/**
 * Suggest rooms for upcoming personal events without a room resource.
 * Returns up to `limit` suggestions ordered by event start.
 */
function getRoomSuggestionsForUpcomingEvents(limit) {
  var upcomingEvents = getUpcomingPersonalEventsWithoutRoom(limit || 5);
  if (!upcomingEvents.length) {
    return { suggestions: [] };
  }

  var suggestions = [];
  upcomingEvents.forEach(function(event) {
    var availableRooms = findAvailableRoomsForWindow(event.start, event.end);
    if (!availableRooms.length) {
      suggestions.push({
        eventId: event.id,
        eventTitle: event.summary,
        eventStartISO: toISO(event.start),
        eventEndISO: toISO(event.end),
        durationMin: event.durationMin,
        rooms: [],
        status: 'No rooms available'
      });
      return;
    }

    suggestions.push({
      eventId: event.id,
      eventTitle: event.summary,
      eventStartISO: toISO(event.start),
      eventEndISO: toISO(event.end),
      durationMin: event.durationMin,
      rooms: availableRooms,
      status: 'Rooms available'
    });
  });

  return { suggestions: suggestions };
}

/** Fetch the active user's bookings for today that include a room resource. */
function getTodayBookings() {
  var email = getActiveUserEmail();
  if (!email) return { bookings: [] };

  var tz = Session.getScriptTimeZone();
  var now = new Date();
  var startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  var endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  var response = Calendar.Events.list('primary', {
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    showDeleted: false,
    maxResults: 100,
    fields: 'items(id,summary,start,end,status,attendees(email,displayName),hangoutLink)',
    alwaysIncludeEmail: true
  });

  var bookings = [];
  var items = (response && response.items) || [];
  items.forEach(function(event) {
    if (!event || event.status === 'cancelled') return;
    var attendees = event.attendees || [];
    var roomAttendee = attendees.find(function(attendee) {
      return attendee && attendee.email && CALENDAR_ID_TO_ROOM[attendee.email];
    });
    if (!roomAttendee) return;

    var roomKey = CALENDAR_ID_TO_ROOM[roomAttendee.email];
    var startDate = new Date(event.start.dateTime || event.start.date);
    var endDate = new Date(event.end.dateTime || event.end.date);
    var durationMin = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
    
    // Strip capacity info from label for display
    var roomLabel = ROOM_LABELS[roomKey] || roomKey;
    if (roomLabel.indexOf(' · ') > -1) {
      roomLabel = roomLabel.split(' · ')[0];
    }

    bookings.push({
      id: event.id,
      room: roomKey,
      roomLabel: roomLabel,
      summary: (event.summary && event.summary.trim()) ? event.summary.trim() : 'Room booking',
      startISO: toISO(startDate),
      endISO: toISO(endDate),
      startLabel: Utilities.formatDate(startDate, tz, 'HH:mm'),
      endLabel: Utilities.formatDate(endDate, tz, 'HH:mm'),
      hangoutLink: event.hangoutLink || '',
      calendarUrl: event.htmlLink || '',
      organizerEmail: email,
      durationMin: durationMin
    });
  });

  return { bookings: bookings };
}

/** Cancel a booking created on the user's primary calendar. */
function cancelBooking(payload) {
  var eventId = payload && payload.eventId;
  var source = (payload && payload.source) ? String(payload.source) : '';
  if (!eventId) throw new Error('Missing eventId.');
  
  // Try to get event details before cancelling for logging
  var eventTitle = '';
  var eventRoom = '';
  try {
    var event = Calendar.Events.get('primary', eventId);
    eventTitle = event.summary || '';
    var attendees = event.attendees || [];
    var roomAttendee = attendees.find(function(attendee) {
      return attendee && attendee.email && CALENDAR_ID_TO_ROOM[attendee.email];
    });
    if (roomAttendee) {
      eventRoom = CALENDAR_ID_TO_ROOM[roomAttendee.email];
    }
  } catch (e) {
    // If we can't get the event details, continue with cancellation
  }
  
  Calendar.Events.remove('primary', eventId, { sendUpdates: 'all' });
  
  try {
    if (typeof logAdminActivity === 'function') {
      var userEmail = getActiveUserEmail();
      logAdminActivity('❌ *Booking Cancelled* by ' + userEmail + '\nEvent: ' + eventTitle + (eventRoom ? ' (' + eventRoom + ')' : ''));
    }
  } catch (e) {
    console.error('Failed to log cancellation:', e.toString());
  }

  return { cancelled: true };
}

function getActiveUserEmail() {
  var user = Session.getActiveUser();
  if (!user || !user.getEmail) return '';
  var email = user.getEmail();
  return email || '';
}

/** Get current availability data for the dashboard. */
function getDashboardData() {
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  var mondayDate = new Date(today);
  var dayOfWeek = (mondayDate.getDay() + 6) % 7;
  mondayDate.setDate(mondayDate.getDate() - dayOfWeek);
  
  var weekStartISO = Utilities.formatDate(mondayDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var tz = Session.getScriptTimeZone();
  var todayISO = Utilities.formatDate(today, tz, 'yyyy-MM-dd');
  
  var gridData = getWeekGrid({ weekStartISO: weekStartISO });
  var roomsToday = gridData.rooms.map(function(room) {
    var filteredCells = room.cells.filter(function(cell) {
      return cell.startISO.slice(0, 10) === todayISO;
    });
    return {
      room: room.room,
      label: room.label,
      calendarId: room.calendarId,
      cells: filteredCells
    };
  });
  
  return {
    rooms: roomsToday,
    timestamp: now.toISOString(),
    todayISO: todayISO,
    todayLabel: Utilities.formatDate(today, tz, 'EEE dd MMM'),
    slotMin: gridData.slotMin,
    workStart: gridData.workStart,
    workEnd: gridData.workEnd,
    slotsPerDay: gridData.slotsPerDay,
    columnLabels: gridData.columns
      .filter(function(column) { return column.startISO.slice(0, 10) === todayISO; })
      .map(function(column) { return column.label; })
  };
}


function debugCancelEvent(eventId) {
  if (!eventId) {
    console.log('Usage: debugCancelEvent("your_event_id_here")');
    return;
  }

  console.log('Attempting to cancel event:', eventId);

  try {
    console.log('1. Fetching event...');
    var event = Calendar.Events.get('primary', eventId);
    console.log('Event found:', event.summary);
    console.log('  Status:', event.status);
    console.log('  Start:', event.start.dateTime || event.start.date);

    console.log('\n2. Attempting cancellation...');
    var result = cancelBooking({ eventId: eventId, source: 'Debug' });
    console.log('Cancellation result:', JSON.stringify(result));

    console.log('\n3. Verifying cancellation...');
    try {
      var checkEvent = Calendar.Events.get('primary', eventId);
      console.log('Event still exists with status:', checkEvent.status);
    } catch (e) {
      console.log('Event successfully deleted (no longer accessible)');
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

function debugListUpcomingBookings(hoursAhead) {
  var lookahead = hoursAhead || 4;
  var now = new Date();
  var end = new Date(now.getTime() + lookahead * 60 * 60000);
  var tz = Session.getScriptTimeZone();

  console.log('Listing room bookings between',
    Utilities.formatDate(now, tz, 'yyyy-MM-dd HH:mm'), 'and',
    Utilities.formatDate(end, tz, 'yyyy-MM-dd HH:mm'));

  for (var roomId in ROOM_CALENDARS) {
    if (!ROOM_CALENDARS.hasOwnProperty(roomId)) {
      continue;
    }

    var calendarId = ROOM_CALENDARS[roomId];
    var label = ROOM_LABELS && ROOM_LABELS[roomId] ? ROOM_LABELS[roomId] : roomId;

    console.log('\nRoom:', label, '(' + calendarId + ')');

    try {
      var response = Calendar.Events.list(calendarId, {
        timeMin: now.toISOString(),
        timeMax: end.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 20
      });

      var events = (response && response.items) || [];
      if (!events.length) {
        console.log('  No upcoming bookings in this window.');
        continue;
      }

      events.forEach(function(event) {
        var startIso = event.start.dateTime || event.start.date;
        var start = startIso ? new Date(startIso) : null;
        var formattedStart = start ? Utilities.formatDate(start, tz, 'yyyy-MM-dd HH:mm') : startIso;
        console.log('  •', formattedStart, '-', event.summary || '(no title)');
        console.log('    Event ID:', event.id);
        if (event.status && event.status !== 'confirmed') {
          console.log('    Status:', event.status);
        }
      });

    } catch (error) {
      console.error('  Failed to list events for room:', label, '-', error.message);
    }
  }
}

function getDashboardUrl() {
  try {
    var service = ScriptApp.getService();
    if (!service || !service.getUrl) {
      throw new Error('Web app URL is not available. Deploy the script and try again.');
    }
    var url = service.getUrl();
    if (!url) {
      throw new Error('Web app URL is empty. Deploy the script and try again.');
    }
    return url;
  } catch (error) {
    throw new Error(error && error.message ? error.message : 'Unable to resolve dashboard URL.');
  }
}

/**
 * Log a client-side interaction (button click, feature usage) to the admin feed.
 * @param {string} actionName - e.g. "Clicked View Bookings"
 */
function logClientInteraction(actionName) {
  try {
    if (typeof logAdminActivity === 'function') {
      var user = getActiveUserEmail() || 'Unknown User';
      logAdminActivity('🖱️ *Interaction*: ' + user + ' ' + actionName);
    }
  } catch (e) {
    console.error('Failed to log client interaction:', e);
  }
  return { logged: true };
}

function doPost() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

//////////////////////
// UI (single file)
//////////////////////

function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) || 'ui';

  try {
    if (typeof logAdminActivity === 'function') {
      var user = getActiveUserEmail();
      // Only log main page visits, not every dashboard refresh if possible, but for now log all
      if (page === 'ui') {
        logAdminActivity('📱 *App Opened* by ' + (user || 'Unknown User'));
      }
    }
  } catch (err) {
    console.error('Failed to log app open', err);
  }

  if (page === 'dashboard') {
    return HtmlService.createTemplateFromFile('Dashboard')
      .evaluate()
      .setTitle('Room Availability · Room Booking Demo')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  
  return HtmlService.createTemplateFromFile('UI')
    .evaluate()
    .setTitle('Room Booking Demo')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}