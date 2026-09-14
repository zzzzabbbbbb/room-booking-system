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

  try {
    testEvent = CalendarApp.getDefaultCalendar().createEvent(
      '[DIAGNOSTICO] borrar', start, end,
      { guests: calendarId, sendInvites: true }
    );

    Utilities.sleep(8000); // dar tiempo a que Google propague la invitación

    var found = Calendar.Events.list(calendarId, {
      timeMin: new Date(start.getTime() - 60000).toISOString(),
      timeMax: new Date(end.getTime() + 60000).toISOString(),
      singleEvents: true,
      fields: 'items(id,summary,status)'
    });
    var items = (found && found.items) || [];

    if (items.length) {
      console.log('✅ FUNCIONA — la sala ' + roomKey + ' recibió el evento (status: ' +
                  (items[0].status || 'n/a') + ').');
      console.log('   El grid va a pintar las reservas. Sigue con el setup normal.');
    } else {
      console.log('❌ NO FUNCIONA — la sala ' + roomKey + ' no recibió el evento.');
      console.log('   Al reservar, el grid se quedaría vacío. Hay que ajustar App.js.');
    }
  } catch (error) {
    console.log('❌ Error durante la prueba: ' + error.message);
  } finally {
    if (testEvent) {
      try {
        testEvent.deleteEvent();
        console.log('\n🧹 Evento de prueba borrado.');
      } catch (error) {
        console.log('\n⚠️ Borra a mano el evento "[DIAGNOSTICO] borrar" de tu calendario.');
      }
    }
  }
}
