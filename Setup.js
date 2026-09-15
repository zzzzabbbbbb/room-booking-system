/**
 * DEMO-ONLY helper. Delete this file before the real deployment.
 *
 * Sets every Script Property in one run instead of clicking through the UI,
 * and validates the values that fail silently at runtime.
 *
 * HOW TO USE
 *   1. Fill PROPERTIES below with your own values (in the Apps Script editor).
 *   2. Run pushScriptProperties() once.
 *   3. Put the placeholders back, or delete this file. A bot token must not
 *      live in a script file — Script Properties is where it belongs.
 *
 * Run showScriptProperties() at any time to see what is currently stored.
 */

var PROPERTIES = {
  WEB_APP_URL:               'PASTE_WEB_APP_URL_HERE',
  SLACK_BOT_TOKEN:           'PASTE_SLACK_BOT_TOKEN_HERE',
  SLACK_DEFAULT_CHANNEL:     'PASTE_SLACK_CHANNEL_ID_HERE',
  SLACK_ADMIN_ID:            'PASTE_SLACK_ADMIN_ID_HERE',
  SLACK_USER_OVERRIDES_JSON: '{"PASTE_YOUR_GOOGLE_EMAIL_HERE":"PASTE_SLACK_ADMIN_ID_HERE"}'
};

function pushScriptProperties() {
  var problems = [];
  var toWrite = {};

  Object.keys(PROPERTIES).forEach(function(key) {
    var value = String(PROPERTIES[key] || '').trim();

    if (!value) {
      problems.push('· ' + key + ': vacío, lo salto.');
      return;
    }
    if (value.indexOf('PASTE_') > -1) {
      problems.push('· ' + key + ': todavía tiene el placeholder, lo salto.');
      return;
    }

    var warning = validateProperty(key, value);
    if (warning) problems.push('· ' + key + ': ' + warning);

    toWrite[key] = value;
  });

  if (problems.length) {
    console.log('⚠️ Revisa esto:');
    problems.forEach(function(line) { console.log(line); });
    console.log('');
  }

  if (!Object.keys(toWrite).length) {
    console.log('❌ No había nada que guardar. Llena PROPERTIES arriba y vuelve a correr.');
    return;
  }

  PropertiesService.getScriptProperties().setProperties(toWrite, false);
  console.log('✅ Guardadas ' + Object.keys(toWrite).length + ' propiedades:');
  Object.keys(toWrite).forEach(function(key) {
    console.log('   ' + key + ' = ' + maskSecret(key, toWrite[key]));
  });
  console.log('\n🔒 Ahora borra tus valores de PROPERTIES (o borra este archivo).');
}

function validateProperty(key, value) {
  if (key === 'SLACK_BOT_TOKEN' && value.indexOf('xoxb-') !== 0) {
    return 'un bot token empieza con "xoxb-". ¿Copiaste el de usuario?';
  }
  if (key === 'SLACK_DEFAULT_CHANNEL' && value.charAt(0) !== 'C') {
    return 'un Channel ID empieza con "C".';
  }
  if (key === 'SLACK_ADMIN_ID' && value.charAt(0) !== 'U') {
    return 'un member ID empieza con "U".';
  }
  if (key === 'WEB_APP_URL' && value.slice(-5) !== '/exec') {
    return 'debe terminar en "/exec". La URL "/dev" solo funciona para ti.';
  }
  if (key === 'SLACK_USER_OVERRIDES_JSON') {
    var parsed;
    try {
      parsed = JSON.parse(value);
    } catch (error) {
      return 'NO es JSON válido (' + error.message + '). Sin esto no sale ningún DM.';
    }
    var emails = Object.keys(parsed || {});
    if (!emails.length) {
      return 'está vacío. Sin al menos un correo no sale ningún DM.';
    }
    for (var i = 0; i < emails.length; i++) {
      if (emails[i].indexOf('@') === -1) {
        return 'la llave "' + emails[i] + '" no parece un correo.';
      }
      if (String(parsed[emails[i]]).charAt(0) !== 'U') {
        return 'el valor de "' + emails[i] + '" debería ser un member ID que empieza con "U".';
      }
    }
  }
  return '';
}

function maskSecret(key, value) {
  if (key !== 'SLACK_BOT_TOKEN') return value;
  return value.slice(0, 9) + '…' + value.slice(-4);
}

/** Muestra lo que está guardado ahora mismo, con el token enmascarado. */
function showScriptProperties() {
  var stored = PropertiesService.getScriptProperties().getProperties();
  var expected = Object.keys(PROPERTIES);

  console.log('=== Propiedades guardadas ===');
  expected.forEach(function(key) {
    if (stored[key]) {
      console.log('✅ ' + key + ' = ' + maskSecret(key, stored[key]));
    } else {
      console.log('❌ ' + key + ' — sin definir');
    }
  });

  Object.keys(stored).forEach(function(key) {
    if (expected.indexOf(key) === -1) {
      console.log('·  ' + key + ' = ' + maskSecret(key, stored[key]) + '  (extra)');
    }
  });
}
