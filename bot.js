/**
 * Slack Reminder System for Room Bookings
 * Add these functions to your existing Apps Script project
 * 
 * Setup:
 * 1. Get a Slack Bot Token from https://api.slack.com/apps
 * 2. Add it to Script Properties: File > Project Settings > Script Properties
 *    Key: SLACK_BOT_TOKEN, Value: xoxb-your-token-here
 * 3. Set up time-based triggers in Apps Script:
 *    - remindUpcomingBookings: Every 1 minute
 *    - remindEndingBookings: Every 1 minute
 */

// ========================================
// SECURITY WARNING
// ========================================
// DO NOT hardcode sensitive information here!
// All credentials, IDs, and user mappings should be stored in Script Properties.
//
// Setup Instructions:
// 1. Go to Apps Script Editor > Project Settings > Script Properties
// 2. Add the following properties:
//    - SLACK_BOT_TOKEN: Your Slack bot token
//    - SLACK_ADMIN_ID: Admin Slack user ID
//    - SLACK_DEFAULT_CHANNEL: Default channel ID
//    - WEB_APP_URL: Your deployed web app URL
//
// 3. For Slack user mappings, use Config.js functions:
//    - importSlackUserMappings({ 'user@company.com': 'UXXXXXXXXXX', ... })
//    - This stores mappings securely in Script Properties
//
// See Config.js and Migration.js for secure configuration management.
// ========================================

// Global container to avoid redeclaration across script files
this.RoomBotGlobals = this.RoomBotGlobals || {
  SLACK_CONFIG: {
    reminderMinutesBefore: 5,
    endReminderMinutesBefore: 5,
    // DO NOT hardcode channel IDs - use Script Properties
    defaultChannel: PropertiesService.getScriptProperties().getProperty('SLACK_DEFAULT_CHANNEL') || '',
    botName: 'Room Booking Bot',
    startIcon: ':calendar:',
    endIcon: ':hourglass_flowing_sand:',
    // DO NOT hardcode URLs - use Script Properties
    bookingAppUrl: PropertiesService.getScriptProperties().getProperty('WEB_APP_URL') || '',
    // DO NOT hardcode admin IDs - use Script Properties
    adminSlackId: PropertiesService.getScriptProperties().getProperty('SLACK_ADMIN_ID') || ''
  },
  OFFICE_HOURS: {
    startHour: 6,
    endHour: 17
  },
  // ========================================
  // DEPRECATED: DEFAULT_SLACK_USER_OVERRIDES
  // ========================================
  // This object is DEPRECATED and should NOT be used.
  // User mappings should be stored in Script Properties using Config.js functions.
  //
  // Migration instructions:
  // 1. Add Config.js and Migration.js to your project
  // 2. Run migrateAllSecuritySettings() once
  // 3. This will move all user mappings to Script Properties
  // 4. Update this code to use getSlackUserMapping(email) instead
  //
  // DO NOT add new entries here!
  // ========================================
  DEFAULT_SLACK_USER_OVERRIDES: {
    // REMOVED FOR SECURITY
    // Use getSlackUserMapping(email) from Config.js instead
    // Example: var slackId = getSlackUserMapping('user@company.com');
  }
};

var _globals = this.RoomBotGlobals;
var SLACK_CONFIG = _globals.SLACK_CONFIG;
var DEFAULT_SLACK_USER_OVERRIDES = _globals.DEFAULT_SLACK_USER_OVERRIDES;

function isWithinOfficeHours(date) {
  var now = date ? new Date(date) : new Date();
  var tz = Session.getScriptTimeZone();
  var hour = parseInt(Utilities.formatDate(now, tz, 'H'), 10);
  var isoDay = parseInt(Utilities.formatDate(now, tz, 'u'), 10); // 1=Mon ... 7=Sun
  var isWeekday = isoDay >= 1 && isoDay <= 5;
  var office = _globals.OFFICE_HOURS || { startHour: 0, endHour: 24 };
  return isWeekday && hour >= office.startHour && hour < office.endHour;
}

/**
 * Merge override mappings from Script Properties if present.
 * Script property key: SLACK_USER_OVERRIDES_JSON (JSON object of email -> userId)
 */
var SLACK_USER_OVERRIDES = (function buildSlackOverrides() {
  var overrides = Object.assign({}, DEFAULT_SLACK_USER_OVERRIDES);
  try {
    var propValue = PropertiesService.getScriptProperties().getProperty('SLACK_USER_OVERRIDES_JSON');
    if (propValue) {
      var parsed = JSON.parse(propValue);
      Object.keys(parsed || {}).forEach(function(key) {
        if (parsed[key]) {
          overrides[key.toLowerCase()] = parsed[key];
        }
      });
    }
  } catch (error) {
    console.error('Failed to load SLACK_USER_OVERRIDES_JSON:', error.toString());
  }
  return overrides;
})();

function isNotifiableEmail(email) {
  if (!email) return false;
  var normalized = String(email).trim().toLowerCase();
  if (!normalized) return false;
  return !!SLACK_USER_OVERRIDES[normalized];
}

/**
 * Log activity to the admin via Slack DM.
 * This functions as a real-time "spy" feed for the admin.
 */
function logAdminActivity(message) {
  var adminId = SLACK_CONFIG.adminSlackId;
  if (!adminId || !message) return;
  
  // Avoid infinite loops if we are logging about the admin themselves getting a message
  // by not logging the log message itself (this function calls sendSlackMessage)
  
  // Use a generic bot token call to send the DM
  sendSlackMessage(adminId, message);
}

function buildBookingAppLink(calendarId, eventId, action) {
  if (!SLACK_CONFIG.bookingAppUrl) return null;
  if (!eventId) return SLACK_CONFIG.bookingAppUrl;
  var params = [];
  params.push('calendarId=' + encodeURIComponent(calendarId));
  params.push('eventId=' + encodeURIComponent(eventId));
  if (action) {
    params.push('action=' + encodeURIComponent(action));
  }
  var separator = SLACK_CONFIG.bookingAppUrl.indexOf('?') === -1 ? '?' : '&';
  return SLACK_CONFIG.bookingAppUrl + separator + params.join('&');
}
  
  /**
   * Send a message to Slack
   */
  function sendSlackMessage(channel, text, blocks) {
    var token = PropertiesService.getScriptProperties().getProperty('SLACK_BOT_TOKEN');
    if (!token) {
      console.error('SLACK_BOT_TOKEN not configured in Script Properties');
      return null;
    }
  
    var payload = {
      channel: channel,
      text: text,
      username: SLACK_CONFIG.botName
    };
  
    if (blocks) {
      payload.blocks = blocks;
    }
  
    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': 'Bearer ' + token
      },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
    };
  
    try {
      var response = UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', options);
      var result = JSON.parse(response.getContentText());
      
      if (!result.ok) {
      console.error('Slack API error:', result.error || 'unknown error', 'payload:', JSON.stringify(payload));
        return null;
      }
      
      return result;
    } catch (error) {
      console.error('Error sending Slack message:', error.toString());
      return null;
    }
  }
  
/**
 * Get user's Slack ID from their email
 * Uses Slack's users.lookupByEmail API with caching
 */
function getSlackUserIdByEmail(email) {
  if (!email) return null;

  var cache = CacheService.getScriptCache();
  var cacheKey = 'slack_uid_' + email;
  var cachedId = cache.get(cacheKey);
  if (cachedId) {
    return cachedId;
  }

  var normalizedEmail = email.toLowerCase();
  if (SLACK_USER_OVERRIDES[normalizedEmail]) {
    var overrideId = SLACK_USER_OVERRIDES[normalizedEmail];
    cache.put(cacheKey, overrideId, 60 * 60);
    return overrideId;
  }
  
  var token = PropertiesService.getScriptProperties().getProperty('SLACK_BOT_TOKEN');
  if (!token) return null;

  var url = 'https://slack.com/api/users.lookupByEmail?email=' + encodeURIComponent(email);
  
  var options = {
    method: 'get',
    headers: {
      'Authorization': 'Bearer ' + token
    },
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var result = JSON.parse(response.getContentText());
    
    if (result.ok && result.user && result.user.id) {
      cache.put(cacheKey, result.user.id, 60 * 60); // cache for 1 hour
      return result.user.id;
    }
    
    console.error('Slack lookup failed for', email, '-', result.error || 'unknown error');
    return null;
  } catch (error) {
    console.error('Error looking up Slack user:', email, error.toString());
    return null;
  }
}

/**
 * Resolve or create a DM channel ID for a given email
 */
function getSlackDmChannelId(email) {
  if (!email) return null;

  var cache = CacheService.getScriptCache();
  var cacheKey = 'slack_dm_' + email;
  var cachedChannel = cache.get(cacheKey);
  if (cachedChannel) {
    return cachedChannel;
  }

  var token = PropertiesService.getScriptProperties().getProperty('SLACK_BOT_TOKEN');
  if (!token) {
    console.error('SLACK_BOT_TOKEN not configured when opening DM for', email);
    return null;
  }

  var slackUserId = getSlackUserIdByEmail(email);
  if (!slackUserId) {
    console.error('Could not resolve Slack user ID for', email);
    return null;
  }

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + token
    },
    payload: JSON.stringify({
      users: slackUserId
    }),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch('https://slack.com/api/conversations.open', options);
    var data = JSON.parse(response.getContentText());
    if (data.ok && data.channel && data.channel.id) {
      cache.put(cacheKey, data.channel.id, 60 * 60); // cache channel for 1 hour
      return data.channel.id;
    }
    console.error('Failed to open DM for', email, '-', data.error || 'unknown error');
    return null;
  } catch (error) {
    console.error('Error opening DM for', email, error.toString());
    return null;
  }
}

function getSlackDmChannelIdForUser(email, slackUserId) {
  var cache = CacheService.getScriptCache();
  if (slackUserId) {
    var cacheKey = 'slack_dm_id_' + slackUserId;
    var cachedChannel = cache.get(cacheKey);
    if (cachedChannel) {
      return cachedChannel;
    }

    var token = PropertiesService.getScriptProperties().getProperty('SLACK_BOT_TOKEN');
    if (!token) {
      console.error('SLACK_BOT_TOKEN not configured when opening DM for Slack ID', slackUserId);
    } else {
      var options = {
        method: 'post',
        contentType: 'application/json',
        headers: {
          'Authorization': 'Bearer ' + token
        },
        payload: JSON.stringify({
          users: slackUserId
        }),
        muteHttpExceptions: true
      };

      try {
        var response = UrlFetchApp.fetch('https://slack.com/api/conversations.open', options);
        var data = JSON.parse(response.getContentText());
        if (data.ok && data.channel && data.channel.id) {
          cache.put(cacheKey, data.channel.id, 60 * 60);
          return data.channel.id;
        }
        console.error('Failed to open DM using Slack ID', slackUserId, '-', data.error || 'unknown error');
      } catch (error) {
        console.error('Error opening DM using Slack ID', slackUserId, error.toString());
      }
    }
  }

  return getSlackDmChannelId(email);
}

/**
 * Determine if an email corresponds to one of the room resource calendars
 */
function isRoomResourceEmail(email) {
  if (!email) return false;
  var normalized = String(email).trim();
  if (!normalized) return false;
  return !!(CALENDAR_ID_TO_ROOM[normalized] || CALENDAR_ID_TO_ROOM[normalized.toLowerCase()]);
}

function extractEmailsFromTextBlock(text) {
  if (!text) return [];
  var emails = [];
  var regex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig;
  var match;
  while ((match = regex.exec(text)) !== null) {
    emails.push(match[0]);
  }
  return emails;
}

function dedupeEmails(emailList) {
  var seen = {};
  var unique = [];
  (emailList || []).forEach(function(raw) {
    if (!raw) return;
    var trimmed = String(raw).trim();
    if (!trimmed) return;
    var lower = trimmed.toLowerCase();
    if (seen[lower]) return;
    seen[lower] = true;
    unique.push(trimmed);
  });
  return unique;
}

function getListedOwnerParticipantEmails(event) {
  if (!event || !event.description) return [];
  var description = String(event.description);
  var collected = [];

  // Capture inline references such as "Owners: email1, email2"
  var inlineRegex = /(owners?|participants?)\s*:\s*([^\n]+)/ig;
  var inlineMatch;
  while ((inlineMatch = inlineRegex.exec(description)) !== null) {
    collected = collected.concat(extractEmailsFromTextBlock(inlineMatch[2] || ''));
  }

  // Capture bullet lists following a heading
  var lines = description.split(/\r?\n/);
  var activeSection = null;
  lines.forEach(function(line) {
    var trimmed = line.trim();
    if (!trimmed) {
      activeSection = null;
      return;
    }

    var headingMatch = trimmed.match(/^(owners?|participants?)\s*:(.*)$/i);
    if (headingMatch) {
      activeSection = headingMatch[1].toLowerCase().indexOf('owner') === 0 ? 'owner' : 'participant';
      collected = collected.concat(extractEmailsFromTextBlock(headingMatch[2] || ''));
      return;
    }

    if (activeSection && /^[-•*]/.test(trimmed)) {
      var bulletContent = trimmed.replace(/^[-•*]+\s*/, '');
      collected = collected.concat(extractEmailsFromTextBlock(bulletContent));
      return;
    }

    if (activeSection) {
      collected = collected.concat(extractEmailsFromTextBlock(trimmed));
    }
  });

  return dedupeEmails(collected);
}

function buildParticipantsFromEmailList(emails, event) {
  if (!emails || !emails.length) return [];
  var metadata = {};
  var addMetadata = function(entry) {
    if (!entry || !entry.email) return;
    var key = String(entry.email).trim().toLowerCase();
    if (!key) return;
    if (!metadata[key]) {
      metadata[key] = entry.displayName || entry.email;
    }
  };

  (event && event.attendees || []).forEach(addMetadata);
  addMetadata(event && event.organizer);
  addMetadata(event && event.creator);

  var seen = {};
  return emails.reduce(function(list, email) {
    var trimmed = String(email).trim();
    if (!trimmed) return list;
    var key = trimmed.toLowerCase();
    if (seen[key]) return list;
    if (!isNotifiableEmail(trimmed)) return list;
    seen[key] = true;
    list.push({
      email: trimmed,
      displayName: metadata[key] || trimmed
    });
    return list;
  }, []);
}

/**
 * Collect human participants (organizer, creator, attendees) to notify for an event.
 * Filters out room resources, declined attendees, and duplicates. If the event
 * description explicitly lists Owners or Participants (by email), those entries
 * take precedence over the general attendee list.
 * @param {Object} event - Google Calendar event object
 * @returns {Array<{email: string, displayName: string}>}
 */
function getEventParticipantsToNotify(event) {
  var participants = [];
  var seen = {};
  if (!event) return participants;

  var listedEmails = getListedOwnerParticipantEmails(event);
  if (listedEmails.length) {
    var listedParticipants = buildParticipantsFromEmailList(listedEmails, event);
    if (listedParticipants.length) {
      return listedParticipants;
    }
  }

  function addParticipant(candidate) {
    if (!candidate || !candidate.email) return false;
    var trimmed = String(candidate.email).trim();
    if (!trimmed) return false;
    if (isRoomResourceEmail(trimmed)) return false;
    if (candidate.resource) return false;
    if (!isNotifiableEmail(trimmed)) return false;

    var status = (candidate.responseStatus || '').toLowerCase();
    if (status === 'declined') return false;

    var key = trimmed.toLowerCase();
    if (seen[key]) return false;

    participants.push({
      email: trimmed,
      displayName: candidate.displayName || trimmed
    });
    seen[key] = true;
    return true;
  }

  (event.attendees || []).forEach(function(attendee) {
    addParticipant(attendee);
  });

  if (event.organizer) {
    addParticipant(event.organizer);
  }
  if (event.creator) {
    addParticipant(event.creator);
  }

  return participants;
}

function mapGuestStatusToResponseStatus(status) {
  if (!status) return '';
  switch (status) {
    case CalendarApp.GuestStatus.YES:
      return 'accepted';
    case CalendarApp.GuestStatus.NO:
      return 'declined';
    case CalendarApp.GuestStatus.MAYBE:
      return 'tentative';
    case CalendarApp.GuestStatus.INVITED:
    default:
      return 'needsAction';
  }
}

function normalizeEventId(eventId) {
  if (!eventId) return '';
  var value = String(eventId).trim();
  if (!value) return '';
  if (value.indexOf('@') === -1) {
    return value + '@google.com';
  }
  return value;
}

function getBaseEventId(eventId) {
  if (!eventId) return eventId;
  var idStr = String(eventId);
  // Check for recurrence suffix _YYYYMMDD[T...Z]
  var match = idStr.match(/^(.*)_\d{8}(?:T\d{6}Z)?$/);
  return match ? match[1] : idStr;
}

function buildEventIdVariants(eventId) {
  var canonical = normalizeEventId(eventId);
  if (!canonical) return [];
  var variants = [canonical];
  var atIndex = canonical.indexOf('@');
  if (atIndex > 0) {
    var apiId = canonical.substring(0, atIndex);
    if (apiId && variants.indexOf(apiId) === -1) {
      variants.push(apiId);
    }
  }
  return variants;
}

function tryFetchEventFromAdvancedService(calendarId, eventIdVariants, options) {
  if (!eventIdVariants || !eventIdVariants.length) return null;
  var lastError = null;
  for (var index = 0; index < eventIdVariants.length; index++) {
    var candidate = eventIdVariants[index];
    if (!candidate) continue;
    try {
      return Calendar.Events.get(calendarId, candidate, options);
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) {
    throw lastError;
  }
  return null;
}

function buildBookingConfirmationCacheKey(eventId) {
  var normalized = normalizeEventId(eventId);
  if (!normalized) return '';
  return 'booking_confirmation_' + normalized;
}

var BOOKING_CONFIRMATION_STATE_KEY = 'BOOKING_CONFIRMATION_STATE_V1';
var BOOKING_CONFIRMATION_LOCK_TIMEOUT_MS = 5000;
var BOOKING_CONFIRMATION_RETENTION_MS = 6 * 60 * 60 * 1000; // 6 hours

function loadBookingConfirmationState() {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty(BOOKING_CONFIRMATION_STATE_KEY);
  if (!raw) {
    return { props: props, state: {} };
  }

  try {
    var parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return { props: props, state: parsed };
    }
  } catch (error) {
    console.warn('Unable to parse booking confirmation state, resetting:', error.toString());
  }

  return { props: props, state: {} };
}

function saveBookingConfirmationState(props, state) {
  try {
    props.setProperty(BOOKING_CONFIRMATION_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to persist booking confirmation state:', error.toString());
  }
}

function cleanupBookingConfirmationState(state, nowMs) {
  var changed = false;
  for (var eventId in state) {
    if (!state.hasOwnProperty(eventId)) continue;
    var record = state[eventId];
    if (!record) {
      delete state[eventId];
      changed = true;
      continue;
    }
    var expiresAt = record.expiresAt ? Date.parse(record.expiresAt) : NaN;
    if (!expiresAt || expiresAt <= nowMs) {
      delete state[eventId];
      changed = true;
    }
  }
  return changed;
}

function parseEventDateToMillis(value) {
  if (!value) return null;
  var parsed = new Date(value);
  if (isNaN(parsed.getTime())) return null;
  return parsed.getTime();
}

function computeBookingConfirmationExpiry(nowMs, startMs) {
  if (!startMs) {
    return new Date(nowMs + BOOKING_CONFIRMATION_RETENTION_MS).toISOString();
  }
  var minRetention = nowMs + BOOKING_CONFIRMATION_RETENTION_MS;
  var startRetention = startMs + BOOKING_CONFIRMATION_RETENTION_MS;
  return new Date(Math.max(minRetention, startRetention)).toISOString();
}

function isBookingConfirmationSent(eventId, eventStartISO) {
  var key = buildBookingConfirmationCacheKey(eventId);
  if (!key) return false;

  var cache = CacheService.getScriptCache();
  if (cache.get(key) !== null) {
    return true;
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(BOOKING_CONFIRMATION_LOCK_TIMEOUT_MS)) {
    console.warn('Could not acquire booking confirmation lock, falling back to cache state only');
    return false;
  }

  try {
    var nowMs = new Date().getTime();
    var loader = loadBookingConfirmationState();
    var state = loader.state;
    var stateChanged = cleanupBookingConfirmationState(state, nowMs);
    var record = state[eventId] || null;

    if (record) {
      var shouldPersist = stateChanged;
      if (eventStartISO) {
        var startMs = parseEventDateToMillis(eventStartISO);
        if (startMs) {
          var recordedStartMs = record.start ? parseEventDateToMillis(record.start) : null;
          if (!recordedStartMs || recordedStartMs !== startMs) {
            record.start = eventStartISO;
            record.expiresAt = computeBookingConfirmationExpiry(nowMs, startMs);
            shouldPersist = true;
          }
        }
      }
      cache.put(key, '1', 6 * 60 * 60);
      if (shouldPersist) {
        saveBookingConfirmationState(loader.props, state);
      } else if (stateChanged) {
        saveBookingConfirmationState(loader.props, state);
      }
      return true;
    }

    if (stateChanged) {
      saveBookingConfirmationState(loader.props, state);
    }
  } finally {
    lock.releaseLock();
  }

  return false;
}

function markBookingConfirmationSent(eventId, eventStartISO, eventUpdatedISO) {
  var key = buildBookingConfirmationCacheKey(eventId);
  if (!key) return;

  var cache = CacheService.getScriptCache();
  cache.put(key, '1', 6 * 60 * 60);

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(BOOKING_CONFIRMATION_LOCK_TIMEOUT_MS)) {
    console.warn('Unable to acquire booking confirmation lock, cache entry set only');
    return;
  }

  try {
    var now = new Date();
    var nowMs = now.getTime();
    var loader = loadBookingConfirmationState();
    var state = loader.state;
    var stateChanged = cleanupBookingConfirmationState(state, nowMs);
    var startMs = eventStartISO ? parseEventDateToMillis(eventStartISO) : null;

    state[eventId] = {
      start: eventStartISO || null,
      lastUpdated: eventUpdatedISO || now.toISOString(),
      storedAt: now.toISOString(),
      expiresAt: computeBookingConfirmationExpiry(nowMs, startMs)
    };

    saveBookingConfirmationState(loader.props, state);
  } finally {
    lock.releaseLock();
  }
}
  
/**
 * Notify participants via Slack when a room booking is confirmed.
 * @param {string} roomKey
 * @param {string} calendarId
 * @param {string} eventId
 * @param {string=} organizerEmailHint
 * @param {Object=} eventData
 */
function notifyRoomBookingConfirmation(roomKey, calendarId, eventId, organizerEmailHint, eventData) {
  console.log('notifyRoomBookingConfirmation called', roomKey, calendarId, eventId, organizerEmailHint || '', eventData ? '[event data provided]' : '[no event data]');
  var rawEventId = eventId || (eventData && eventData.id) || '';
  if (!calendarId || !rawEventId) {
    console.warn('Missing calendarId or eventId for booking confirmation');
    return false;
  }

  eventId = rawEventId;
  var canonicalEventId = normalizeEventId(eventId);
  if (!canonicalEventId) {
    console.warn('Unable to normalize event id for booking confirmation', eventId);
    return false;
  }

  var eventIdVariants = buildEventIdVariants(eventId);

  var roomLabel = ROOM_LABELS[roomKey] || roomKey || 'Room';
  if (roomLabel.indexOf(' · ') > -1) {
    roomLabel = roomLabel.split(' · ')[0];
  }

  var event = eventData || null;
  if (!event) {
    var primaryFetchOptions = {
      fields: 'id,summary,start,end,organizer,creator,attendees(email,displayName,responseStatus,resource,optional),attendeesOmitted,guestsCanSeeOtherGuests,description',
      alwaysIncludeEmail: true,
      maxAttendees: 200
    };
    try {
      event = tryFetchEventFromAdvancedService('primary', eventIdVariants, primaryFetchOptions);
      if (event) {
        console.log('Fetched event from primary calendar for confirmation');
      }
    } catch (error) {
      console.warn('Failed to fetch event from primary calendar for confirmation:', canonicalEventId, error.toString());
    }
  }

  if (!event && calendarId) {
    var roomFetchOptions = {
      fields: 'id,summary,start,end,organizer,creator,attendees(email,displayName,responseStatus,resource,optional),attendeesOmitted,guestsCanSeeOtherGuests,description',
      alwaysIncludeEmail: true,
      maxAttendees: 200
    };
    try {
      event = tryFetchEventFromAdvancedService(calendarId, eventIdVariants, roomFetchOptions);
      if (event) {
        console.log('Fetched event from room calendar for confirmation');
      }
    } catch (error2) {
      console.error('Failed to fetch event from room calendar for confirmation:', calendarId, canonicalEventId, error2.toString());
    }
  }

  if (!event) {
    try {
      var calendarAppEvent = CalendarApp.getEventById(canonicalEventId);
      if (calendarAppEvent) {
        console.log('Fetched event via CalendarApp fallback');
        event = {
          id: calendarAppEvent.getId(),
          summary: calendarAppEvent.getTitle(),
          start: { dateTime: calendarAppEvent.getStartTime().toISOString() },
          end: { dateTime: calendarAppEvent.getEndTime().toISOString() },
          description: (calendarAppEvent.getDescription && calendarAppEvent.getDescription()) ? calendarAppEvent.getDescription() : '',
          organizer: { email: calendarAppEvent.getCreators()[0] || '', displayName: calendarAppEvent.getCreators()[0] || '' },
          attendeesOmitted: false,
          guestsCanSeeOtherGuests: true,
          attendees: calendarAppEvent.getGuestList().map(function(guest) {
            return {
              email: guest.getEmail(),
              displayName: guest.getName() || guest.getEmail(),
              responseStatus: mapGuestStatusToResponseStatus(guest.getGuestStatus()),
              resource: guest.isResource(),
              optional: guest.isOptional()
            };
          })
        };
      }
    } catch (fallbackError) {
      console.error('CalendarApp fallback failed for confirmation:', canonicalEventId, fallbackError.toString());
    }
  }

  if (!event || !event.start || !event.end) {
    console.error('Event data incomplete for Slack confirmation:', calendarId, eventId);
    return false;
  }

  var normalizedEventId = normalizeEventId((event && event.id) || canonicalEventId);
  var eventStartISO = event.start.dateTime || event.start.date || '';
  if (isBookingConfirmationSent(normalizedEventId, eventStartISO)) {
    console.log('Booking confirmation already recorded for', normalizedEventId);
    return false;
  }

  var start = new Date(eventStartISO);
  var end = new Date(event.end.dateTime || event.end.date);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    console.error('Invalid start/end in event for Slack confirmation:', calendarId, eventId);
    return false;
  }

  var summary = (event.summary && event.summary.trim()) ? event.summary.trim() : 'Room Booking';
  var participants = getEventParticipantsToNotify(event);

  if (organizerEmailHint) {
    var key = organizerEmailHint.toLowerCase();
    if (isNotifiableEmail(key)) {
      var alreadyIncluded = participants.some(function(p) { return p.email && p.email.toLowerCase() === key; });
      if (!alreadyIncluded) {
        participants.unshift({
          email: organizerEmailHint,
          displayName: organizerEmailHint
        });
      }
    }
  }

  if (event.attendeesOmitted) {
    console.log('Warning: attendees omitted for booking confirmation', event.id || summary);
  }

  if (!participants.length) {
    console.log('No notifiable participants for booking confirmation', event.id || summary);
    return false;
  }

  var tz = Session.getScriptTimeZone();
  var organizerName = (event.organizer && (event.organizer.displayName || event.organizer.email)) ||
    (participants.length ? (participants[0].displayName || participants[0].email) : 'Organizer');

  var messageText = '✅ Room booking confirmed: ' + roomLabel + ' · ' + Utilities.formatDate(start, tz, 'HH:mm');

  var blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '✅ Room Booking Confirmed',
        emoji: true
      }
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: '*Room:*\n' + roomLabel
        },
        {
          type: 'mrkdwn',
          text: '*Time:*\n' + Utilities.formatDate(start, tz, 'HH:mm') + ' - ' +
                Utilities.formatDate(end, tz, 'HH:mm')
        },
        {
          type: 'mrkdwn',
          text: '*Meeting:*\n' + summary
        },
        {
          type: 'mrkdwn',
          text: '*Organizer:*\n' + organizerName
        }
      ]
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: Utilities.formatDate(start, tz, 'EEE dd MMM yyyy') + ' · ' + Utilities.formatDate(start, tz, 'HH:mm') + ' - ' + Utilities.formatDate(end, tz, 'HH:mm')
        }
      ]
    }
  ];

  var viewUrl = buildBookingAppLink(calendarId, eventId, 'view');
  var manageUrl = buildBookingAppLink(calendarId, eventId, 'manage');
  if (viewUrl || manageUrl) {
    var actionElements = [];
    if (viewUrl) {
      actionElements.push({
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'Open Room Booking'
        },
        url: viewUrl
      });
    }
    if (manageUrl) {
      actionElements.push({
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'Manage Booking'
        },
        style: 'primary',
        url: manageUrl
      });
    }
    if (actionElements.length) {
      blocks.push({
        type: 'actions',
        elements: actionElements
      });
    }
  }

  var delivered = false;
  participants.forEach(function(participant) {
    var dmChannelId = getSlackDmChannelId(participant.email);
    if (dmChannelId) {
      var dmResult = sendSlackMessage(dmChannelId, messageText, blocks);
      if (dmResult && dmResult.ok) {
        delivered = true;
        console.log('Sent booking confirmation DM to', participant.displayName || participant.email, 'for', summary);
      } else {
        console.error('Failed to send booking confirmation DM to', participant.email, 'for', summary);
      }
    } else {
      console.log('Unable to open DM for booking confirmation recipient', participant.email);
    }
  });

  if (!delivered && SLACK_CONFIG.defaultChannel) {
    var channelResult = sendSlackMessage(SLACK_CONFIG.defaultChannel, messageText, blocks);
    if (channelResult && channelResult.ok) {
      console.log('Sent booking confirmation to default channel for', summary);
      delivered = true;
    } else {
      console.error('Failed to send booking confirmation to default channel for', summary);
    }
  }

  if (delivered) {
    markBookingConfirmationSent(normalizedEventId, eventStartISO, event.updated || null);
    var recipientLog = participants.map(function(p){ return p.email.split('@')[0]; }).join(', ');
    logAdminActivity('🤖 Bot sent *booking confirmation* to participants (' + recipientLog + ') for: ' + summary + ' (' + roomLabel + ')');
  }

  return delivered;
}

function processRecentRoomBookingsForRoom(roomKey, calendarId, updatedMinISO, now) {
  var processed = 0;
  var pageToken = null;
  var timeMin = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
  var timeMax = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
  var processedBaseIds = {};

  do {
    var response = Calendar.Events.list(calendarId, {
      timeMin: timeMin,
      timeMax: timeMax,
      updatedMin: updatedMinISO,
      singleEvents: true,
      orderBy: 'startTime',
      showDeleted: false,
      maxResults: 50,
      pageToken: pageToken,
      fields: 'items(id,summary,start,end,status,organizer,creator,attendees(email,displayName,responseStatus,resource,optional),attendeesOmitted,guestsCanSeeOtherGuests,created,updated,description),nextPageToken',
      alwaysIncludeEmail: true
    });

    var items = (response && response.items) || [];
    items.forEach(function(event) {
      if (!event) return;
      if (event.status === 'cancelled') {
        console.log('Skipping cancelled event', event.id);
        return;
      }
      var startValue = event.start && (event.start.dateTime || event.start.date);
      if (!startValue) {
        console.log('Skipping event without start time', event.id || '(no id)');
        return;
      }
      var startTime = new Date(startValue);
      if (isNaN(startTime.getTime())) {
        console.log('Skipping event with invalid start', event.id || '(no id)');
        return;
      }
      if (startTime.getTime() < now.getTime() - 15 * 60 * 1000) {
        console.log('Skipping old event outside window', event.id || '(no id)', 'start', startValue);
        return;
      }

      var attendees = event.attendees || [];
      var hasHumanParticipant = false;

      attendees.forEach(function(att) {
        if (!att || !att.email) return;
        if (CALENDAR_ID_TO_ROOM[att.email]) return;
        if (att.resource) return;
        if ((att.responseStatus || '').toLowerCase() === 'declined') return;
        hasHumanParticipant = true;
      });

      if (!hasHumanParticipant) {
        if (event.organizer && event.organizer.email && !CALENDAR_ID_TO_ROOM[event.organizer.email]) {
          hasHumanParticipant = true;
        }
      }

      if (!hasHumanParticipant && event.creator && event.creator.email && !CALENDAR_ID_TO_ROOM[event.creator.email]) {
        hasHumanParticipant = true;
      }

      if (!hasHumanParticipant) {
        console.log('Skipping event without human participant', event.id || '(no id)', event.summary || '');
        return;
      }

      var canonicalEventId = normalizeEventId(event.id);
      if (!canonicalEventId) {
        console.log('Skipping event with unusable id', event.id || '(no id)');
        return;
      }
      if (isBookingConfirmationSent(canonicalEventId, startValue)) {
        console.log('Skipping already-notified event', canonicalEventId);
        return;
      }

      // Deduplicate recurring event instances in the same batch
      var baseId = getBaseEventId(canonicalEventId);
      if (processedBaseIds[baseId]) {
        console.log('Skipping recurrence duplicate for base ID', baseId, 'instance', canonicalEventId);
        // Mark as sent so we don't process it again in future runs if updatedMin overlaps
        markBookingConfirmationSent(canonicalEventId, startValue, event.updated || null);
        return;
      }
      processedBaseIds[baseId] = true;

      console.log('Sending confirmation for event', canonicalEventId, 'summary:', event.summary || '(no title)', 'start:', startValue, 'updated:', event.updated || '(no update)');
      var delivered = notifyRoomBookingConfirmation(roomKey, calendarId, event.id, null, event);
      if (delivered) {
        processed++;
      } else {
        console.log('Notification not delivered for event', event.id || '(no id)');
      }
    });

    pageToken = (response && response.nextPageToken) ? response.nextPageToken : null;
  } while (pageToken);

  return processed;
}

function notifyRecentRoomBookings() {
  var props = PropertiesService.getScriptProperties();
  var lastScanISO = props.getProperty('LAST_ROOM_BOOKING_SCAN_ISO');
  var now = new Date();
  if (!isWithinOfficeHours(now)) {
    var tzSkip = Session.getScriptTimeZone();
    console.log('Skipping notifyRecentRoomBookings outside office hours at', Utilities.formatDate(now, tzSkip, 'EEE HH:mm'));
    return {
      processed: 0,
      updatedMin: lastScanISO || null,
      timestamp: now.toISOString(),
      skipped: true
    };
  }
  var fallbackLookback = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  var updatedMinISO = lastScanISO || fallbackLookback;

  props.setProperty('LAST_ROOM_BOOKING_SCAN_ISO', now.toISOString());

  var totalProcessed = 0;
  Object.keys(ROOM_CALENDARS).forEach(function(roomKey) {
    var calendarId = ROOM_CALENDARS[roomKey];
    totalProcessed += processRecentRoomBookingsForRoom(roomKey, calendarId, updatedMinISO, now);
  });

  console.log('notifyRecentRoomBookings processed', totalProcessed, 'events since', updatedMinISO);
  return {
    processed: totalProcessed,
    updatedMin: updatedMinISO,
    timestamp: now.toISOString()
  };
}

/**
 * Report an unbooked room usage and notify the occupant and/or default channel.
 * @param {Object|string} payload
 *   If object: { room: 'A', occupantEmail: 'user@example.com', note: 'Optional note', reporterEmail: 'reporter@example.com' }
 *   If string: treated as room key.
 */
function reportUnbookedRoomUsage(payload, occupantEmail, note, occupantSlackId) {
  var params = {};
  if (typeof payload === 'object') {
    params = payload || {};
  } else {
    params.room = payload;
    params.occupantEmail = occupantEmail;
    params.note = note;
    params.occupantSlackId = occupantSlackId;
  }

  var roomKey = params.room;
  var roomLabelRaw = ROOM_LABELS[roomKey] || roomKey || 'Unknown room';
  if (!roomKey || !ROOM_CALENDARS[roomKey]) {
    console.error('reportUnbookedRoomUsage: invalid room key', roomKey);
    return { success: false, reason: 'invalid_room' };
  }

  var occupantEmailValue = params.occupantEmail ? String(params.occupantEmail).trim() : '';
  var noteValue = params.note ? String(params.note).trim() : '';
  var occupantSlackIdValue = params.occupantSlackId ? String(params.occupantSlackId).trim() : '';

  var roomLabel = roomLabelRaw.indexOf(' · ') > -1 ? roomLabelRaw.split(' · ')[0] : roomLabelRaw;
  var tz = Session.getScriptTimeZone();
  var now = new Date();

  var channelMessageText = '⚠️ We detected ' + roomLabel + ' being used without a booking.';
  var channelBlocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '⚠️ Unbooked Room Detected',
        emoji: true
      }
    },
    {
      type: 'section',
      fields: (function() {
        var fields = [
          {
            type: 'mrkdwn',
            text: '*Room:*\n' + roomLabel
          },
          {
            type: 'mrkdwn',
            text: '*Detected:*\n' + Utilities.formatDate(now, tz, 'EEE dd MMM HH:mm')
          }
        ];
        if (occupantEmailValue) {
          fields.push({
            type: 'mrkdwn',
            text: '*Occupant:*\n' + occupantEmailValue
          });
        }
        if (noteValue) {
          fields.push({
            type: 'mrkdwn',
            text: '*Note:*\n' + noteValue
          });
        }
        return fields;
      })()
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: 'Please book the room before using it. ' + (SLACK_CONFIG.bookingAppUrl ? '<' + SLACK_CONFIG.bookingAppUrl + '|Book now>' : '')
        }
      ]
    }
  ];

  var dmSent = false;
  if (occupantEmailValue || occupantSlackIdValue) {
    var dmChannelId = getSlackDmChannelIdForUser(occupantEmailValue, occupantSlackIdValue);
    if (dmChannelId) {
      var dmText = 'We detected you using ' + roomLabel + ' without a booking. Please book it before you use it.';
      var dmBlocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🚪 Book Your Room',
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'It looks like *' + roomLabel + '* is in use without a reservation. Please add the booking right away so others can coordinate.'
              + (SLACK_CONFIG.bookingAppUrl ? '\n\n<' + SLACK_CONFIG.bookingAppUrl + '|Open the booking app>' : '')
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: 'Detected at ' + Utilities.formatDate(now, tz, 'HH:mm')
            }
          ]
        }
      ];

      var dmResult = sendSlackMessage(dmChannelId, dmText, dmBlocks);
      if (dmResult && dmResult.ok) {
        dmSent = true;
        console.log('Sent unbooked room DM to', occupantEmailValue || occupantSlackIdValue);
      } else {
        console.error('Failed to send unbooked room DM to', occupantEmailValue || occupantSlackIdValue);
      }
    } else if (occupantEmailValue) {
      console.warn('Could not open DM channel for unbooked room occupant', occupantEmailValue);
    }
  }

  var channelSent = false;
  if (SLACK_CONFIG.defaultChannel) {
    var channelResult = sendSlackMessage(SLACK_CONFIG.defaultChannel, channelMessageText, channelBlocks);
    if (channelResult && channelResult.ok) {
      channelSent = true;
      console.log('Posted unbooked room alert to default channel for', roomLabel);
    } else {
      console.error('Failed to post unbooked room alert to default channel for', roomLabel);
    }
  }

  if (dmSent || channelSent) {
    var culprit = occupantEmailValue || occupantSlackIdValue || 'Unknown User';
    logAdminActivity('⚠️ *Unbooked Room Detected*: ' + roomLabel + ' used by ' + culprit);
  }

  return {
    success: dmSent || channelSent,
    dmSent: dmSent,
    channelSent: channelSent,
    timestamp: now.toISOString()
  };
}

/**
 * Helper for quick manual testing inside Apps Script editor.
 */
function debugReportUnbookedRoomUsage() {
  return reportUnbookedRoomUsage({
    room: 'A',
    occupantEmail: 'example@yourcompany.com',
    occupantSlackId: 'U000000000',
    note: 'Demo trigger from debug function'
  });
}

function reportUnbookedRoomA() {
  var occupantEmail = 'replace_with_email@yourcompany.com';
  var occupantSlackId = 'U000000000'; // replace with Slack ID
  return reportUnbookedRoomUsage({
    room: 'A',
    occupantEmail: occupantEmail,
    occupantSlackId: occupantSlackId
  });
}

function reportUnbookedRoomB() {
  var occupantEmail = 'replace_with_email@yourcompany.com';
  var occupantSlackId = 'U000000000'; // replace with Slack ID
  return reportUnbookedRoomUsage({
    room: 'B',
    occupantEmail: occupantEmail,
    occupantSlackId: occupantSlackId
  });
}

function reportUnbookedRoomC() {
  var occupantEmail = 'replace_with_email@yourcompany.com';
  var occupantSlackId = 'U000000000'; // replace with Slack ID
  return reportUnbookedRoomUsage({
    room: 'C',
    occupantEmail: occupantEmail,
    occupantSlackId: occupantSlackId
  });
}

function reportUnbookedRoomD() {
  var occupantEmail = 'replace_with_email@yourcompany.com';
  var occupantSlackId = 'U000000000'; // replace with Slack ID
  return reportUnbookedRoomUsage({
    room: 'D',
    occupantEmail: occupantEmail,
    occupantSlackId: occupantSlackId
  });
}

function reportUnbookedRoomPB1() {
  var occupantEmail = 'replace_with_email@yourcompany.com';
  var occupantSlackId = 'U000000000'; // replace with Slack ID
  return reportUnbookedRoomUsage({
    room: 'PB1',
    occupantEmail: occupantEmail,
    occupantSlackId: occupantSlackId
  });
}

function reportUnbookedRoomPB2() {
  var occupantEmail = 'replace_with_email@yourcompany.com';
  var occupantSlackId = 'U000000000'; // replace with Slack ID
  return reportUnbookedRoomUsage({
    room: 'PB2',
    occupantEmail: occupantEmail,
    occupantSlackId: occupantSlackId
  });
}

function reportUnbookedRoomPB3() {
  var occupantEmail = 'replace_with_email@yourcompany.com';
  var occupantSlackId = 'U000000000'; // replace with Slack ID
  return reportUnbookedRoomUsage({
    room: 'PB3',
    occupantEmail: occupantEmail,
    occupantSlackId: occupantSlackId
  });
}

  /**
   * Store reminder state to avoid duplicates
   * Uses Script Cache with a multi-hour TTL to allow future recurrences
   */
  function buildReminderCacheKey(eventId, type) {
    return 'reminder_' + type + '_' + eventId;
  }
  
  function isReminderSent(eventId, type) {
    if (!eventId) return false;
    var cache = CacheService.getScriptCache();
    return cache.get(buildReminderCacheKey(eventId, type)) !== null;
  }
  
  function markReminderSent(eventId, type) {
    if (!eventId) return;
    var cache = CacheService.getScriptCache();
    // 6 hours in seconds (max cache TTL is 21600)
    var ttlSeconds = 6 * 60 * 60;
    cache.put(buildReminderCacheKey(eventId, type), new Date().toISOString(), ttlSeconds);
  }
  
  /**
   * Main function: Send reminders for bookings starting in 5 minutes
   * Set this to run every 1 minute via Triggers
   */
  function remindUpcomingBookings() {
    var minutesAhead = SLACK_CONFIG.reminderMinutesBefore;
    var now = new Date();
    if (!isWithinOfficeHours(now)) {
      var tzSkip = Session.getScriptTimeZone();
      console.log('Skipping remindUpcomingBookings outside office hours at', Utilities.formatDate(now, tzSkip, 'EEE HH:mm'));
      return { skipped: true, timestamp: now.toISOString() };
    }
    var startWindow = new Date(now.getTime() + minutesAhead * 60000);
    var endWindow = new Date(now.getTime() + (minutesAhead + 1) * 60000);
    var tz = Session.getScriptTimeZone();
    
    var remindersSent = 0;
    
    console.log('Checking for bookings starting between',
      Utilities.formatDate(startWindow, tz, 'HH:mm'), 'and',
      Utilities.formatDate(endWindow, tz, 'HH:mm'));
  
    // Check each room calendar
    for (var roomKey in ROOM_CALENDARS) {
      if (!ROOM_CALENDARS.hasOwnProperty(roomKey)) continue;
      
      var calendarId = ROOM_CALENDARS[roomKey];
      var roomLabel = ROOM_LABELS[roomKey] || roomKey;
      
      // Extract capacity info
      var roomCapacity = '';
      if (roomLabel.indexOf(' · ') > -1) {
        var parts = roomLabel.split(' · ');
        roomLabel = parts[0];
        roomCapacity = parts[1];
      }
      
      try {
        var events = Calendar.Events.list(calendarId, {
          timeMin: startWindow.toISOString(),
          timeMax: endWindow.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 10,
          fields: 'items(id,summary,start,end,organizer,creator,attendees(email,displayName,responseStatus,resource,optional),attendeesOmitted,guestsCanSeeOtherGuests,description)',
          alwaysIncludeEmail: true,
          maxAttendees: 200
        });
        
        if (!events.items || events.items.length === 0) continue;
        
        events.items.forEach(function(event) {
          // Skip if already sent reminder for this event
          if (isReminderSent(event.id, 'start')) {
            console.log('Skipping (already sent):', event.summary);
            return;
          }
          
          var startTime = new Date(event.start.dateTime || event.start.date);
          var endTime = new Date(event.end.dateTime || event.end.date);
          var summary = (event.summary && event.summary.trim()) ? event.summary.trim() : 'Room Booking';

          var minutesUntilStart = (startTime.getTime() - now.getTime()) / 60000;
          if (minutesUntilStart < minutesAhead - 0.75 || minutesUntilStart > minutesAhead + 1.25) {
            console.log('Skipping event outside start reminder window', event.id || summary, 'starts in', minutesUntilStart.toFixed(2), 'minutes');
            return;
          }
          
          // Gather human participants (organizer, creator, attendees)
          var participants = getEventParticipantsToNotify(event);
          if (event.attendeesOmitted) {
            console.log('Warning: attendees omitted for event', event.id || summary, '- cannot reach hidden guests');
          } else if (!participants.length) {
            console.log('No notifiable participants found for event', event.id || summary);
          }
          var organizerEmail = (event.organizer && event.organizer.email) ||
            (participants.length ? participants[0].email : '');
          var organizerName = (event.organizer && (event.organizer.displayName || event.organizer.email)) ||
            (participants.length ? participants[0].displayName : (organizerEmail || 'Unknown'));
          
          // Build Slack message
          var messageText = '🔔 Room booking starting in ' + minutesAhead + ' minutes!';
          
          var blocks = [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: '🔔 Room Booking Starting Soon',
                emoji: true
              }
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: '*Room:*\n' + roomLabel + (roomCapacity ? '\n_(' + roomCapacity + ')_' : '')
                },
                {
                  type: 'mrkdwn',
                  text: '*Time:*\n' + Utilities.formatDate(startTime, tz, 'HH:mm') + ' - ' + 
                        Utilities.formatDate(endTime, tz, 'HH:mm')
                },
                {
                  type: 'mrkdwn',
                  text: '*Meeting:*\n' + summary
                },
                {
                  type: 'mrkdwn',
                  text: '*Organized by:*\n' + organizerName
                }
              ]
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: '⏰ Starts in *' + minutesAhead + ' minutes* at ' + 
                        Utilities.formatDate(startTime, tz, 'HH:mm')
                }
              ]
            }
          ];

          var viewUrl = buildBookingAppLink(calendarId, event.id, 'view');
          var manageUrl = buildBookingAppLink(calendarId, event.id, 'manage');
          if (viewUrl || manageUrl) {
            var actionElements = [];
            if (viewUrl) {
              actionElements.push({
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Open Room Booking'
                },
                url: viewUrl
              });
            }
            if (manageUrl) {
              actionElements.push({
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Manage Booking'
                },
                style: 'primary',
                url: manageUrl
              });
            }
            if (actionElements.length) {
              blocks.push({
                type: 'actions',
                elements: actionElements
              });
            }
          }
          
          // Try to DM all human participants we can resolve
          var delivered = false;
          if (participants.length) {
            participants.forEach(function(participant) {
              var dmChannelId = getSlackDmChannelId(participant.email);
              if (dmChannelId) {
                var dmResult = sendSlackMessage(dmChannelId, messageText, blocks);
                if (dmResult && dmResult.ok) {
                  delivered = true;
                  console.log('Sent DM to', participant.displayName || participant.email, 'for', summary);
                } else {
                  console.error('Failed to send DM to', participant.email, 'for', summary);
                }
              } else {
                console.log('Unable to open DM for', participant.email, '- skipping DM');
              }
            });
          }
          
          // Fall back to default channel if configured
          if (!delivered && SLACK_CONFIG.defaultChannel) {
            var channelResult = sendSlackMessage(SLACK_CONFIG.defaultChannel, messageText, blocks);
            if (channelResult && channelResult.ok) {
              delivered = true;
              console.log('Sent channel reminder for', summary, 'in', roomLabel);
            } else {
              console.error('Failed to send channel reminder for', summary);
            }
          }

          if (delivered) {
            markReminderSent(event.id, 'start');
            remindersSent++;
            
            // Log to admin
            var recipientLog = participants.map(function(p){ return p.email.split('@')[0]; }).join(', ');
            logAdminActivity('🔔 Bot sent *start reminder* for "' + summary + '" (' + roomLabel + ') to: ' + recipientLog);
          }
        });
        
      } catch (error) {
        console.error('Error checking calendar', roomKey + ':', error.toString());
      }
    }
    
    console.log('Sent', remindersSent, 'start reminders');
    return { sent: remindersSent, timestamp: new Date().toISOString() };
  }
  
  /**
   * Main function: Send reminders for bookings ending in 5 minutes
   * Set this to run every 1 minute via Triggers
   */
  function remindEndingBookings() {
    var minutesBefore = SLACK_CONFIG.endReminderMinutesBefore;
    var now = new Date();
    if (!isWithinOfficeHours(now)) {
      var tzSkip = Session.getScriptTimeZone();
      console.log('Skipping remindEndingBookings outside office hours at', Utilities.formatDate(now, tzSkip, 'EEE HH:mm'));
      return { skipped: true, timestamp: now.toISOString() };
    }
    var tz = Session.getScriptTimeZone();
    
    var remindersSent = 0;
    
    console.log('Checking for bookings ending soon at', Utilities.formatDate(now, tz, 'HH:mm'));
  
    // Check each room calendar
    for (var roomKey in ROOM_CALENDARS) {
      if (!ROOM_CALENDARS.hasOwnProperty(roomKey)) continue;
      
      var calendarId = ROOM_CALENDARS[roomKey];
      var roomLabel = ROOM_LABELS[roomKey] || roomKey;
      
      // Extract capacity info
      var roomCapacity = '';
      if (roomLabel.indexOf(' · ') > -1) {
        var parts = roomLabel.split(' · ');
        roomLabel = parts[0];
        roomCapacity = parts[1];
      }
      
      try {
        // Get events happening now or very recently
        var windowStart = new Date(now.getTime() - 4 * 60 * 60 * 1000); // 4 hours ago
        var windowEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);   // 2 hours ahead
        
        var events = Calendar.Events.list(calendarId, {
          timeMin: windowStart.toISOString(),
          timeMax: windowEnd.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 20,
          fields: 'items(id,summary,start,end,organizer,creator,attendees(email,displayName,responseStatus,resource,optional),attendeesOmitted,guestsCanSeeOtherGuests,description)',
          alwaysIncludeEmail: true,
          maxAttendees: 200
        });
        
        if (!events.items || events.items.length === 0) continue;
        
        events.items.forEach(function(event) {
          var endTime = new Date(event.end.dateTime || event.end.date);
          var minutesUntilEnd = Math.round((endTime.getTime() - now.getTime()) / 60000);
          
          // Check if this event ends in approximately 5 minutes (between 4.5 and 5.5 min)
          if (minutesUntilEnd < 4.5 || minutesUntilEnd > 5.5) {
            return; // Skip this event
          }
          
          // Skip if already sent reminder
          if (isReminderSent(event.id, 'end')) {
            console.log('Skipping end reminder (already sent):', event.summary);
            return;
          }
          
          var startTime = new Date(event.start.dateTime || event.start.date);
          var summary = (event.summary && event.summary.trim()) ? event.summary.trim() : 'Room Booking';
          
          // Gather human participants (organizer, creator, attendees)
          var participants = getEventParticipantsToNotify(event);
          if (event.attendeesOmitted) {
            console.log('Warning: attendees omitted for event', event.id || summary, '- cannot reach hidden guests');
          } else if (!participants.length) {
            console.log('No notifiable participants found for event', event.id || summary);
          }
          var organizerEmail = (event.organizer && event.organizer.email) ||
            (participants.length ? participants[0].email : '');
          var organizerName = (event.organizer && (event.organizer.displayName || event.organizer.email)) ||
            (participants.length ? participants[0].displayName : (organizerEmail || 'Unknown'));
          
          // Build Slack message
          var messageText = '⏰ Room booking ending in ' + minutesBefore + ' minutes!';

          // Check for next booking in the same room
          var nextEvent = null;
          var minStartDiff = Infinity;
          
          events.items.forEach(function(candidate) {
            if (candidate.id === event.id) return;
            var cStart = new Date(candidate.start.dateTime || candidate.start.date);
            if (cStart < endTime) return; // Overlaps or starts before current ends
            
            var diff = cStart.getTime() - endTime.getTime();
            if (diff >= 0 && diff < minStartDiff) {
              minStartDiff = diff;
              nextEvent = candidate;
            }
          });

          var trafficContext = '🏁 Please wrap up and prepare the room for the next booking';
          if (nextEvent) {
            var gapMinutes = Math.round(minStartDiff / 60000);
            var nextTimeStr = Utilities.formatDate(new Date(nextEvent.start.dateTime || nextEvent.start.date), tz, 'HH:mm');
            var nextSummary = (nextEvent.summary && nextEvent.summary.trim()) ? nextEvent.summary.trim() : 'Another Meeting';

            if (gapMinutes <= 15) {
               // Back-to-back: high urgency
               trafficContext = '⚠️ *Next up:* "' + nextSummary + '" starts at ' + nextTimeStr + '. Please wrap up!';
            } else {
               // Gap exists: moderate urgency / info
               trafficContext = '✅ Room is free until ' + nextTimeStr + '.';
            }
          } else {
             // No next event found in the fetched window (2 hours)
             trafficContext = '✅ Room is free for at least the next 2 hours.';
          }
          
          var blocks = [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: '⏰ Room Booking Ending Soon',
                emoji: true
              }
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: '*Room:*\n' + roomLabel + (roomCapacity ? '\n_(' + roomCapacity + ')_' : '')
                },
                {
                  type: 'mrkdwn',
                  text: '*Ends at:*\n' + Utilities.formatDate(endTime, tz, 'HH:mm')
                },
                {
                  type: 'mrkdwn',
                  text: '*Meeting:*\n' + summary
                },
                {
                  type: 'mrkdwn',
                  text: '*Organized by:*\n' + organizerName
                }
              ]
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: trafficContext
                }
              ]
            }
          ];

          var viewUrl = buildBookingAppLink(calendarId, event.id, 'view');
          var manageUrl = buildBookingAppLink(calendarId, event.id, 'manage');
          if (viewUrl || manageUrl) {
            var actionElements = [];
            if (viewUrl) {
              actionElements.push({
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Open Room Booking'
                },
                url: viewUrl
              });
            }
            if (manageUrl) {
              actionElements.push({
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Manage Booking'
                },
                style: 'primary',
                url: manageUrl
              });
            }
            if (actionElements.length) {
              blocks.push({
                type: 'actions',
                elements: actionElements
              });
            }
          }
          
          var delivered = false;
          if (participants.length) {
            participants.forEach(function(participant) {
              var dmChannelId = getSlackDmChannelId(participant.email);
              if (dmChannelId) {
                var dmResult = sendSlackMessage(dmChannelId, messageText, blocks);
                if (dmResult && dmResult.ok) {
                  delivered = true;
                  console.log('Sent end DM to', participant.displayName || participant.email, 'for', summary);
                } else {
                  console.error('Failed to send end DM to', participant.email, 'for', summary);
                }
              } else {
                console.log('Unable to open DM for', participant.email, '- skipping DM');
              }
            });
          }
          
          if (!delivered && SLACK_CONFIG.defaultChannel) {
            var result = sendSlackMessage(SLACK_CONFIG.defaultChannel, messageText, blocks);
            if (result && result.ok) {
              delivered = true;
              console.log('Sent end reminder for', summary, 'in', roomLabel);
            } else {
              console.error('Failed to send channel end reminder for', summary);
            }
          }

          if (delivered) {
            markReminderSent(event.id, 'end');
            remindersSent++;
            
            var recipientLog = participants.map(function(p){ return p.email.split('@')[0]; }).join(', ');
            logAdminActivity('⏰ Bot sent *end reminder* for "' + summary + '" (' + roomLabel + ') to: ' + recipientLog);
          }
        });
        
      } catch (error) {
        console.error('Error checking calendar', roomKey, 'for ending bookings:', error.toString());
      }
    }
    
    console.log('Sent', remindersSent, 'end reminders');
    return { sent: remindersSent, timestamp: new Date().toISOString() };
  }
  
  /**
   * Main function: Send a morning digest of the day's room bookings to each user.
   * Set this to run every day at 8:00 AM.
   * @param {string} [targetEmail] - Optional. If provided, sends digest ONLY to this email (for testing).
   */
  function sendDailyDigest(targetEmail) {
    var isTestRun = (targetEmail && typeof targetEmail === 'string');
    var now = new Date();
    // Only run on weekdays (Mon=1 ... Fri=5), unless it's a test run
    var day = now.getDay(); 
    if (!isTestRun && (day === 0 || day === 6)) {
      console.log('Skipping daily digest on weekend.');
      return;
    }

    var tz = Session.getScriptTimeZone();
    // Define "Today" from 00:00 to 23:59
    var startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    var endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    console.log('Generating daily digest for', Utilities.formatDate(startOfDay, tz, 'yyyy-MM-dd') + (isTestRun ? ' (Target: ' + targetEmail + ')' : ''));

    if (typeof ROOM_CALENDARS === 'undefined') {
      console.error('ROOM_CALENDARS is undefined. Make sure App.js is loaded.');
      return;
    }
    if (isTestRun) {
      console.log('Scanning calendars: ' + Object.keys(ROOM_CALENDARS).join(', '));
    }

    var userSchedules = {}; // { 'email': [ { start, end, summary, roomLabel } ] }

    // 1. Collect all events from all rooms
    for (var roomKey in ROOM_CALENDARS) {
      if (!ROOM_CALENDARS.hasOwnProperty(roomKey)) continue;

      var calendarId = ROOM_CALENDARS[roomKey];
      var roomLabelRaw = ROOM_LABELS[roomKey] || roomKey;
      var roomName = roomLabelRaw;
      var roomCapacity = '';
      if (roomLabelRaw.indexOf(' · ') > -1) {
        var parts = roomLabelRaw.split(' · ');
        roomName = parts[0];
        roomCapacity = parts[1];
      }

      try {
        var events = Calendar.Events.list(calendarId, {
          timeMin: startOfDay.toISOString(),
          timeMax: endOfDay.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 50,
          fields: 'items(id,summary,start,end,organizer,creator,attendees(email,displayName,responseStatus,resource,optional),attendeesOmitted,description)',
          alwaysIncludeEmail: true
        });

        if (!events.items) continue;
        
        if (isTestRun && events.items.length > 0) {
           console.log('Found ' + events.items.length + ' events in ' + roomKey);
        }

        events.items.forEach(function(event) {
          // Skip cancelled
          if (event.status === 'cancelled') return;

          // Identify who should be notified about this event
          var participants = getEventParticipantsToNotify(event);

          if (isTestRun) {
             var isTarget = participants.some(function(p) { return p.email.toLowerCase() === targetEmail.toLowerCase(); });
             if (!isTarget) {
               // Debug why
               var rawAttendees = (event.attendees || []).map(function(a) { return a.email; }).join(', ');
               if (rawAttendees.toLowerCase().indexOf(targetEmail.toLowerCase()) > -1) {
                 console.log('Target user found in attendees but not in notification list for "' + event.summary + '". Check SLACK_USER_OVERRIDES or response status.');
               }
             } else {
               console.log('Target user identified as participant for: ' + event.summary);
             }
          }

          if (participants.length) {
            var startTime = new Date(event.start.dateTime || event.start.date);
            var endTime = new Date(event.end.dateTime || event.end.date);
            var summary = (event.summary && event.summary.trim()) ? event.summary.trim() : 'Room Booking';

            var eventData = {
              start: startTime,
              end: endTime,
              summary: summary,
              roomName: roomName,
              roomCapacity: roomCapacity,
              eventId: event.id,
              calendarId: calendarId
            };

            participants.forEach(function(p) {
              // If in test run mode, skip users that don't match targetEmail
              if (isTestRun && p.email.toLowerCase() !== targetEmail.toLowerCase()) {
                return;
              }

              if (!userSchedules[p.email]) {
                userSchedules[p.email] = {
                  displayName: p.displayName,
                  events: []
                };
              }
              // Avoid duplicates if user is in multiple rooms for same event (rare but possible) or logic overlap
              var exists = userSchedules[p.email].events.some(function(e) { 
                return e.eventId === event.id && e.roomName === roomName; 
              });
              if (!exists) {
                userSchedules[p.email].events.push(eventData);
              }
            });
          }
        });
      } catch (e) {
        console.error('Error fetching digest events for room', roomKey, e.toString());
      }
    }
    
    // Inject sample data if test run and no events found
    if (isTestRun && (!userSchedules[targetEmail] || userSchedules[targetEmail].events.length === 0)) {
      console.log('No real events found for ' + targetEmail + '. Injecting sample data for preview.');
      var sampleStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0);
      var sampleEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 30, 0);
      
      // Ensure key exists
      if (!userSchedules[targetEmail]) {
        userSchedules[targetEmail] = {
           displayName: targetEmail.split('@')[0], // Fallback name
           events: []
        };
      }
      
      userSchedules[targetEmail].events.push({
          start: sampleStart,
          end: sampleEnd,
          summary: 'Sample Team Standup (Preview)',
          roomName: 'Room A - Ajolote',
          roomCapacity: '4 people',
          eventId: 'sample-preview-id',
          calendarId: 'sample-cal-id'
      });
    }

    // 2. Send Digest DMs
    var digestsSent = 0;
    
    Object.keys(userSchedules).forEach(function(email) {
      // Redundant check for safety, though filtering happened during collection
      if (isTestRun && email.toLowerCase() !== targetEmail.toLowerCase()) return;

      var userData = userSchedules[email];
      if (!userData.events.length) return;

      // Sort by start time
      userData.events.sort(function(a, b) {
        return a.start.getTime() - b.start.getTime();
      });

      var firstName = userData.displayName ? userData.displayName.split(' ')[0] : 'there';
      var eventCount = userData.events.length;
      
      var blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '☀️ Good Morning, ' + firstName + '!',
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'You have *' + eventCount + ' room booking' + (eventCount === 1 ? '' : 's') + '* scheduled for today:'
          }
        },
        {
          type: 'divider'
        }
      ];

      userData.events.forEach(function(ev) {
        var timeStr = Utilities.formatDate(ev.start, tz, 'HH:mm') + ' - ' + Utilities.formatDate(ev.end, tz, 'HH:mm');
        var capacityStr = ev.roomCapacity ? ' _(' + ev.roomCapacity + ')_' : '';
        
        blocks.push({
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: '*Time:* ' + timeStr + '\n*Room:* ' + ev.roomName + capacityStr
            },
            {
              type: 'mrkdwn',
              text: '*Event:*\n' + ev.summary
            }
          ]
        });
      });

      // Send the DM
      var dmChannelId = getSlackDmChannelId(email);
      if (dmChannelId) {
        console.log('Sending digest payload to ' + email + ':', JSON.stringify(blocks));
        var result = sendSlackMessage(dmChannelId, '☀️ Your Room Bookings for Today', blocks);
        if (result && result.ok) {
          digestsSent++;
          console.log('Sent daily digest to', email);
        } else {
          console.error('Failed to send daily digest to', email);
        }
      } else {
        console.log('Skipping digest for', email, '- no DM channel available.');
      }
    });

    console.log('Daily digest run complete. Sent to', digestsSent, 'users.');
    if (!isTestRun) {
      logAdminActivity('☀️ Bot sent *Daily Digest* to ' + digestsSent + ' users.');
    } else {
      console.log('Test digest run complete.');
    }
  }

  /**
   * Helper to manually test the daily digest for a specific user immediately.
   */
  function debugSendDailyDigestToMe() {
    var adminEmail = Session.getActiveUser().getEmail();
    console.log('Force running digest logic for ' + adminEmail + '...');
    sendDailyDigest(adminEmail); 
  }

  /**
   * Test function - send a test message to verify Slack integration
   */
  function testSlackIntegration() {
    var result = sendSlackMessage(
      SLACK_CONFIG.defaultChannel,
      '✅ Slack integration test successful!',
      [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Room Booking Bot is now active!*\n\nYou will receive reminders:\n• 5 minutes before bookings start\n• 5 minutes before bookings end'
          }
        }
      ]
    );
    
    if (result && result.ok) {
      console.log('✅ Test message sent successfully!');
      return { success: true, message: 'Test message sent to ' + SLACK_CONFIG.defaultChannel };
    } else {
      console.error('❌ Failed to send test message');
      return { success: false, message: 'Failed to send test message. Check SLACK_BOT_TOKEN.' };
    }
  }
  
  /**
   * Setup function - creates the time-based triggers
   * Run this once manually to set up the triggers
   */
  function setupReminderTriggers() {
    // Delete existing triggers first to avoid duplicates
    var triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(function(trigger) {
      var handler = trigger.getHandlerFunction();
      if (handler === 'remindUpcomingBookings' ||
          handler === 'remindEndingBookings' ||
          handler === 'notifyRecentRoomBookings' ||
          handler === 'sendDailyDigest') {
        ScriptApp.deleteTrigger(trigger);
      }
    });
    
    // Create new triggers - run every minute
    ScriptApp.newTrigger('remindUpcomingBookings')
      .timeBased()
      .everyMinutes(1)
      .create();
    
    ScriptApp.newTrigger('remindEndingBookings')
      .timeBased()
      .everyMinutes(1)
      .create();

    ScriptApp.newTrigger('notifyRecentRoomBookings')
      .timeBased()
      .everyMinutes(1)
      .create();
      
    // Daily Digest at 8:00 AM
    ScriptApp.newTrigger('sendDailyDigest')
      .timeBased()
      .atHour(8)
      .everyDays(1)
      .inTimezone(Session.getScriptTimeZone())
      .create();
    
    console.log('✅ Triggers created successfully!');
    console.log('• remindUpcomingBookings: Every 1 minute');
    console.log('• remindEndingBookings: Every 1 minute');
    console.log('• notifyRecentRoomBookings: Every 1 minute');
    console.log('• sendDailyDigest: Daily at 8:00 AM');
    
    return { 
      success: true, 
      message: 'Triggers created. Reminders every minute, Digest at 8:00 AM.' 
    };
  }

/**
 * Updates the App Home for a specific user.
 * Called when the 'app_home_opened' event is received.
 * @param {string} userId - Slack User ID
 */
function updateSlackAppHome(userId) {
  if (!userId) return;
  
  var token = PropertiesService.getScriptProperties().getProperty('SLACK_BOT_TOKEN');
  if (!token) {
    console.error('SLACK_BOT_TOKEN missing for updateSlackAppHome');
    return;
  }

  var webAppUrl = '';
  // Try to use the config URL first as it's likely the stable published one
  if (SLACK_CONFIG && SLACK_CONFIG.bookingAppUrl) {
    webAppUrl = SLACK_CONFIG.bookingAppUrl;
  } else {
    // Fallback to dynamic resolution if config is missing
    try {
      if (typeof getDashboardUrl === 'function') {
        webAppUrl = getDashboardUrl();
      } else if (ScriptApp.getService().getUrl()) {
        webAppUrl = ScriptApp.getService().getUrl();
      }
    } catch (e) {
      console.warn('Could not resolve web app URL for App Home:', e);
    }
  }
  
  if (!webAppUrl) {
    console.warn('No Web App URL found. App Home buttons may be broken.');
    webAppUrl = 'https://script.google.com'; // Safe fallback to avoid empty URL error
  }
  
  var dashboardUrl = webAppUrl + (webAppUrl.indexOf('?') > -1 ? '&' : '?') + 'page=dashboard';

  var viewPayload = {
    type: 'home',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'Your Company · Room Booking Command Center',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Plan, book, and manage every room without leaving Slack.*\nPreview availability, launch the planner, or jump into the dashboard from this Home tab.'
        },
        accessory: {
          type: 'image',
          image_url: 'https://api.slack.com/img/blocks/bkb_template_images/notifications.png',
          alt_text: 'Room scheduling'
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Each teammate sees this view privately. Open the Home tab anytime to refresh suggestions.'
          }
        ]
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Pick what you need:*'
        },
        fields: [
          {
            type: 'mrkdwn',
            text: '*📅 Room planner*\nDrag-and-drop bookings on the weekly grid.'
          },
          {
            type: 'mrkdwn',
            text: '*📊 Live dashboard*\nGlance at what\'s free right now across rooms.'
          },
          {
            type: 'mrkdwn',
            text: '*⚡ Auto reminders*\nWe DM you before meetings start or end.'
          },
          {
            type: 'mrkdwn',
            text: '*🧭 Overflow options*\nRoute to WeWork rooms when HQ is full.'
          }
        ]
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Open planner',
              emoji: true
            },
            style: 'primary',
            url: webAppUrl,
            action_id: 'open_planner'
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View dashboard',
              emoji: true
            },
            url: dashboardUrl,
            action_id: 'open_dashboard'
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Book overflow',
              emoji: true
            },
            url: 'https://members.wework.com/workplaceone/content2/bookings/rooms',
            action_id: 'open_overflow'
          }
        ]
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*How it works*\n• Choose *Open planner* to reserve a room in seconds.\n• We\'ll DM reminders before meetings start and end.\n• Need visibility? Tap *View dashboard* for the live grid.\n• If HQ is packed, jump to WeWork overflow rooms.'
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: ':bulb: Tip: revisit this Home tab whenever you need a fresh snapshot—Slack fires an `app_home_opened` event every time you land here.'
          }
        ]
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Need help or want a new room added?*\nPing <@' + (SLACK_CONFIG && SLACK_CONFIG.adminSlackId ? SLACK_CONFIG.adminSlackId : 'ADMIN_ID') + '> or contact your IT team.'
        }
      }
    ]
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + token
    },
    payload: JSON.stringify({
      user_id: userId,
      view: viewPayload
    }),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch('https://slack.com/api/views.publish', options);
    var result = JSON.parse(response.getContentText());
    if (!result.ok) {
      console.error('Failed to update Slack App Home:', result.error, JSON.stringify(result));
    } else {
      console.log('Updated App Home for user', userId);
    }
  } catch (error) {
    console.error('Error calling views.publish:', error.toString());
  }
}

/**
 * Helper to manually refresh the App Home for the workspace admin.
 * Run this from Apps Script to validate the layout without waiting for an event.
 */
function refreshAppHomeForAdmin() {
  // Get admin ID from Script Properties
  var adminId = PropertiesService.getScriptProperties().getProperty('SLACK_ADMIN_ID');
  if (adminId) {
    updateSlackAppHome(adminId);
  } else {
    console.error('SLACK_ADMIN_ID not configured in Script Properties');
  }
}
