/**
 * DEMO-ONLY diagnostic. Delete this file before the real deployment.
 *
 * Checks the one mechanic that can silently break the demo on a personal Gmail
 * account: booking a room creates the event on the user's own calendar and
 * invites the room calendar as a guest. Workspace resource calendars accept
 * that invitation automatically; a secondary @group.calendar.google.com
 * calendar may not, and then the weekly grid stays empty.
 *
 * Run diagnoseRoomCalendars() from the Apps Script editor and read the log.
 */

function diagnoseRoomCalendars() {
  var keys = Object.keys(ROOM_CALENDARS);

  console.log('=== 1. Leyendo los calendarios de sala ===');
  var readable = [];
  keys.forEach(function(key) {
    var id = ROOM_CALENDARS[key];
    if (id.indexOf('PASTE_') === 0) {
      console.log('❌ ' + key + ': sigue con el placeholder. Pega el Calendar ID en App.js.');
      return;
    }
    try {
      Calendar.Events.list(id, { maxResults: 1 });
      console.log('✅ ' + key + ': OK — ' + id);
      readable.push(key);
    } catch (error) {
      console.log('❌ ' + key + ': no se pudo leer — ' + error.message);
    }
  });

  if (!readable.length) {
    console.log('\nArregla los Calendar IDs antes de seguir.');
    return;
  }

  console.log('\n=== 2. Probando que la sala reciba la reserva ===');
  var roomKey = readable[0];
  var calendarId = ROOM_CALENDARS[roomKey];
  var start = new Date(Date.now() + 2 * 60 * 60 * 1000);
  var end = new Date(start.getTime() + 30 * 60 * 1000);
  var testEvent = null;

  // La invitación a un calendario secundario no se propaga al instante, así que
  // hay que sondear un rato antes de concluir que no llegó.
  var ATTEMPTS = 9;
  var WAIT_MS = 10000;
  var landed = false;

  try {
    testEvent = CalendarApp.getDefaultCalendar().createEvent(
      '[DIAGNOSTICO] borrar', start, end,
      { guests: calendarId, sendInvites: true }
    );
    console.log('Evento de prueba creado. Esperando a que la sala lo reciba…');

    for (var attempt = 1; attempt <= ATTEMPTS && !landed; attempt++) {
      Utilities.sleep(WAIT_MS);

      var found = Calendar.Events.list(calendarId, {
        timeMin: new Date(start.getTime() - 60000).toISOString(),
        timeMax: new Date(end.getTime() + 60000).toISOString(),
        singleEvents: true,
        fields: 'items(id,summary,status)'
      });
      var items = (found && found.items) || [];

      if (items.length) {
        landed = true;
        console.log('✅ FUNCIONA — la sala ' + roomKey + ' recibió el evento después de ' +
                    (attempt * WAIT_MS / 1000) + ' s (status: ' + (items[0].status || 'n/a') + ').');
        console.log('   El grid va a pintar las reservas. Sigue con el setup normal.');
      } else {
        console.log('   …intento ' + attempt + '/' + ATTEMPTS + ' — todavía no llega.');
      }
    }

    if (!landed) {
      console.log('⚠️ La sala ' + roomKey + ' no recibió el evento en ' +
                  (ATTEMPTS * WAIT_MS / 1000) + ' s.');
      console.log('   NO lo borré, para que lo puedas revisar a mano.');
      console.log('   Abre Google Calendar, deja visible SOLO "Demo · Room A" y busca');
      console.log('   "[DIAGNOSTICO] borrar" el ' + start.toLocaleString() + '.');
      console.log('   Si aparece ahí, el mecanismo sí funciona y solo es lento.');
      console.log('   Cuando termines, corre cleanupDiagnosticEvents() para limpiar.');
    }
  } catch (error) {
    console.log('❌ Error durante la prueba: ' + error.message);
  } finally {
    if (testEvent && landed) {
      try {
        testEvent.deleteEvent();
        console.log('\n🧹 Evento de prueba borrado.');
      } catch (error) {
        console.log('\n⚠️ Borra a mano el evento "[DIAGNOSTICO] borrar" de tu calendario.');
      }
    }
  }
}

/** Borra los eventos "[DIAGNOSTICO]" que hayan quedado, en tu calendario y en las salas. */
function cleanupDiagnosticEvents() {
  var from = new Date(Date.now() - 24 * 60 * 60 * 1000);
  var to = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  var removed = 0;

  var calendars = ['primary'];
  Object.keys(ROOM_CALENDARS).forEach(function(key) {
    calendars.push(ROOM_CALENDARS[key]);
  });

  calendars.forEach(function(calendarId) {
    var items = [];
    try {
      var response = Calendar.Events.list(calendarId, {
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        singleEvents: true,
        maxResults: 100,
        q: '[DIAGNOSTICO]',
        fields: 'items(id,summary)'
      });
      items = (response && response.items) || [];
    } catch (error) {
      return;
    }

    items.forEach(function(event) {
      if (!event.summary || event.summary.indexOf('[DIAGNOSTICO]') === -1) return;
      try {
        Calendar.Events.remove(calendarId, event.id);
        removed++;
      } catch (error) {
        console.log('No se pudo borrar ' + event.id + ' de ' + calendarId + ': ' + error.message);
      }
    });
  });

  console.log(removed ? ('🧹 Borrados ' + removed + ' evento(s) de diagnóstico.')
                      : 'Nada que limpiar.');
}
