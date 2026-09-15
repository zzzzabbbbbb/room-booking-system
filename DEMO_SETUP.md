# DEMO_SETUP.md — Levantar la demo desde cero

Checklist en orden. Sigue los pasos de arriba hacia abajo.

**Leyenda**

| Marca | Significado |
|---|---|
| ✅ | **Obligatorio.** Sin esto la demo no levanta. |
| ⚪ | **Opcional.** Puedes saltártelo (ver [§ Demo sin Slack](#demo-sin-slack)). |

**Tiempo estimado**

- [Paso 0](#-paso-0--prueba-bloqueante-2-minutos-hazla-hoy) (prueba bloqueante): **2 min** — hazla hoy
- Solo Google Calendar (Parte A): **~20–30 min**
- Con Slack (Parte A + B): **~50–70 min**

> ### Demo con Gmail personal ≠ despliegue en casa del cliente
>
> | | Calendarios de sala | Estado |
> |---|---|---|
> | **Demo** (Gmail personal) | Calendarios secundarios `@group.calendar.google.com` | Hay que verificar el [Paso 0](#-paso-0--prueba-bloqueante-2-minutos-hazla-hoy) |
> | **Producción** (Workspace del cliente) | Recursos de sala reales `@resource.calendar.google.com`, desde Admin → Edificios y recursos | Funciona tal cual, sin cambios |
>
> El código es el mismo en los dos casos: solo cambias los IDs en `ROOM_CALENDARS`.
> Con Gmail personal hay además una [cuota de triggers](#-b7-crear-los-triggers-de-recordatorios)
> más baja.

> **¿Solo quieres enseñar la demo sin Slack?**
> Haz la **Parte A completa** y salta la **Parte B entera**. Nada más.
> Detalle de qué se pierde: [§ Demo sin Slack](#demo-sin-slack).

---

## ⛔ Paso 0 — Prueba bloqueante (2 minutos, hazla HOY)

**Si usas Gmail personal, haz esto antes que nada.** No requiere desplegar nada.

Al reservar, la app **no crea el evento en el calendario de la sala**. Hace esto
(`App.js:400`):

```javascript
var userCalendar = CalendarApp.getDefaultCalendar();  // TU calendario
var attendees = [calendarId];                         // la sala, como INVITADO
userCalendar.createEvent(summary, start, end, { guests: attendees.join(',') });
```

Crea el evento en **tu** calendario e **invita** al calendario de la sala. El grid
solo pinta el bloque si el evento efectivamente aterriza en el calendario de la sala.

- Con **recursos de sala de Google Workspace**: aceptan solos, está diseñado así ✅
- Con **calendarios secundarios de Gmail personal** (`@group.calendar.google.com`):
  **hay que comprobarlo.**

> **Nota buena:** el grid **no exige que la sala acepte** la invitación.
> `Calendar.Events.list` (`App.js:162`) trae todo lo que esté en el calendario de la
> sala, y el único chequeo de `declined` (`App.js:204`) solo sirve para elegir el
> nombre del organizador. Basta con que el evento **aterrice** ahí, aunque quede en
> `needsAction`.

### La prueba rápida (manual, sin instalar nada)

1. En [calendar.google.com](https://calendar.google.com), crea un calendario:
   **Otros calendarios → `+` → Crear calendario nuevo** → nómbralo `Demo · Room A`
2. Entra a su **Configuración → Integrar calendario** y copia el **ID de calendario**
3. Crea un **evento normal en tu calendario principal**
4. En **Invitados**, pega el ID que copiaste (`c_xxxx@group.calendar.google.com`) y guarda
5. Mira si el evento **aparece dibujado en el calendario `Demo · Room A`**

| Resultado | Qué significa |
|---|---|
| ✅ Aparece en `Demo · Room A` | Todo bien. Sigue con A1. |
| ❌ No aparece | Ve a [§ Si la prueba falla](#si-la-prueba-falla). |

### La prueba definitiva (desde Apps Script)

Cuando ya hayas hecho A1–A6, corre el diagnóstico incluido en el repo. Ejercita
**exactamente** el mismo camino que la app y te lo dice sin ambigüedad:

1. Copia `Diagnostic.js` al proyecto de Apps Script (archivo `.gs`, nómbralo `Diagnostic`)
2. En el selector de funciones elige **`diagnoseRoomCalendars`** → **Ejecutar**
3. Lee el registro de ejecución

Comprueba dos cosas: que los 3 Calendar IDs se pueden leer (detecta erratas al
pegarlos), y que al reservar como lo hace la app, la sala sí recibe el evento.
Crea un evento de prueba y **lo borra solo**.

> `Diagnostic.js` es solo para la demo. **Bórralo antes del despliegue real.**

### Si la prueba falla

No sigas con el resto del setup — avísame y ajustamos. La opción más limpia es un
cambio pequeño en `App.js` para crear el evento **directamente en el calendario de
la sala** en vez de invitarla. Es un cambio de lógica (afecta también "Mis reservas
de hoy" y cancelar, que leen de `'primary'`), así que **no lo hice sin tu visto bueno**.

---

## Parte A — Google Calendar + Web App (obligatoria)

### ✅ A1. Crear los 3 calendarios de prueba

En [calendar.google.com](https://calendar.google.com), en el panel izquierdo:
**Otros calendarios → `+` → Crear calendario nuevo**.

Crea tres, uno por sala:

| # | Nombre sugerido | Sala en la app |
|---|---|---|
| 1 | `Demo · Room A` | A |
| 2 | `Demo · Room B` | B |
| 3 | `Demo · Room C` | C |

> Usa calendarios **nuevos y vacíos**. No uses tu calendario personal ni
> calendarios con eventos reales — la demo los muestra en pantalla.

**Con Gmail personal** estos calendarios secundarios son tu única opción, y su ID
termina en `@group.calendar.google.com`. Asegúrate de haber pasado el
[Paso 0](#-paso-0--prueba-bloqueante-2-minutos-hazla-hoy) antes de crear los tres.

**Con Google Workspace** puedes usar *recursos de sala* reales (Admin console →
Edificios y recursos). Es la opción más robusta: aceptan las invitaciones
automáticamente. El ID termina en `@resource.calendar.google.com`.

---

### ✅ A2. Copiar los 3 Calendar IDs

Para **cada** calendario creado:

1. Pasa el cursor sobre el calendario → `⋮` → **Configuración y uso compartido**
2. Baja hasta la sección **Integrar calendario**
3. Copia el campo **ID de calendario**

Se ve así:

```
c_a1b2c3d4e5f6g7h8@group.calendar.google.com
```

Guarda los tres en un bloc de notas antes de seguir.

---

### ✅ A3. Crear el proyecto de Apps Script y subir los archivos

1. Ve a [script.google.com](https://script.google.com) → **Nuevo proyecto**
2. Ponle nombre: `Room Booking Demo`
3. Crea los archivos **con estos nombres exactos** y pega el contenido del repo:

| Archivo en el repo | En Apps Script | Tipo | Nombre exacto |
|---|---|---|---|
| `App.js` | Archivo de script | `.gs` | `App` |
| `bot.js` | Archivo de script | `.gs` | `bot` |
| `UI.html` | Archivo HTML | `.html` | `UI` |
| `Dashboard.html` | Archivo HTML | `.html` | `Dashboard` |
| `bot-home.html` | Archivo HTML | `.html` | `bot-home` |
| `Diagnostic.js` | ⚪ Archivo de script | `.gs` | `Diagnostic` |

> `Diagnostic.js` es opcional y **solo para la demo** — verifica el Paso 0 desde
> Apps Script. Bórralo antes del despliegue real en casa del cliente.

> ⚠️ **Los nombres `UI` y `Dashboard` son obligatorios y sensibles a mayúsculas.**
> El código los carga por nombre (`createTemplateFromFile('UI')`). Si los
> renombras, la app truena con *"File not found"*.

---

### ✅ A4. Activar la Calendar API (servicio avanzado)

En el editor de Apps Script:

1. Panel izquierdo → **Servicios** → `+`
2. Busca **Google Calendar API**
3. Identificador: `Calendar` · Versión: `v3` → **Añadir**

Sin esto, el grid semanal sale vacío.

---

### ✅ A5. Ajustar la zona horaria

**Configuración del proyecto (⚙️) → Zona horaria.**

El repo viene con `America/Mexico_City` (en `appsscript.json`). Cámbiala a la
tuya si la demo es en otro huso — si no, las horas del grid no van a cuadrar
con el reloj de quien está viendo la demo.

---

### ✅ A6. Pegar los 3 Calendar IDs en `App.js`

Abre `App.js`. **Hasta arriba del archivo** está el bloque
`DEMO CONFIGURATION`. Es lo único que tienes que tocar:

```javascript
const ROOM_CALENDARS = {
  A:   'PASTE_ROOM_A_CALENDAR_ID_HERE',
  B:   'PASTE_ROOM_B_CALENDAR_ID_HERE',
  C:   'PASTE_ROOM_C_CALENDAR_ID_HERE'
};
```

Sustituye cada `PASTE_..._HERE` por el ID que copiaste en **A2**.
**Conserva las comillas.** Debe quedar así:

```javascript
const ROOM_CALENDARS = {
  A:   'c_a1b2c3d4e5f6g7h8@group.calendar.google.com',
  B:   'c_b2c3d4e5f6g7h8i9@group.calendar.google.com',
  C:   'c_c3d4e5f6g7h8i9j0@group.calendar.google.com'
};
```

⚪ **Opcional:** en el mismo bloque puedes cambiar los nombres visibles de las
salas (`ROOM_LABELS`) y el horario del grid (`WORK_START` / `WORK_END`).
Los valores por defecto funcionan tal cual.

> Si añades una 4ª sala, agrégala **en los dos objetos** (`ROOM_CALENDARS` y
> `ROOM_LABELS`) usando la misma llave.

Guarda (`Ctrl/Cmd + S`).

---

### ✅ A7. Desplegar el Web App

1. Arriba a la derecha → **Implementar → Nueva implementación**
2. Icono de engrane ⚙️ → tipo **Aplicación web**
3. Configura:

| Campo | Valor |
|---|---|
| Descripción | `Demo v1` |
| **Ejecutar como** | **Yo** (`tu-correo@...`) |
| **Quién tiene acceso** | **Solo yo** ← si vas a compartir pantalla |

> ### ⚠️ Elige bien el acceso: cambia lo que ve tu prospecto
>
> `getActiveUserEmail()` (`App.js:856`) usa `Session.getActiveUser()`. Con acceso
> **"Cualquier usuario"**, Apps Script **no identifica a un visitante anónimo** y eso
> devuelve vacío.
>
> | Cómo enseñas la demo | Acceso | Qué pasa |
> |---|---|---|
> | **Compartes pantalla** (recomendado) | **Solo yo** | Estás logueado → funciona al 100% |
> | Le mandas el link al prospecto | Cualquier usuario | "Mis reservas de hoy" **siempre vacío** (`App.js:760` corta si no hay correo), reservas sin organizador, y los eventos caen en **tu** calendario |
>
> **Para una primera demo, comparte pantalla y usa "Solo yo".** Te ahorras además
> la pantalla de "app no verificada" y cualquier bloqueo de acceso público.

4. **Implementar** → Google te pedirá autorizar los permisos → **Revisar permisos**
   → elige tu cuenta → **Permitir**
   - Si sale **"Google no ha verificado esta aplicación"**: es normal, es tu propio
     script. **Configuración avanzada** → **Ir a Room Booking Demo (no seguro)**
5. **Copia la URL del Web App.** Termina en `/exec`:
   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```

> **`/exec` vs `/dev`:** en el editor también verás una URL que termina en `/dev`
> (siempre refleja el último código, solo para ti). **Usa `/exec` para la demo.**
>
> **Redesplegar:** si cambias el código después, `/exec` **sigue mostrando lo viejo**.
> Tienes que ir a **Implementar → Gestionar implementaciones → ✏️ →
> Versión: Nueva versión → Implementar.** Esto tumba a todo el mundo la primera vez.

---

### ⚪ A8. Guardar la URL en Script Properties — **solo si vas a usar Slack**

**Si no vas a usar Slack, salta este paso.** La app resuelve su propia URL sola:
`getDashboardUrl()` (`App.js:991`) usa `ScriptApp.getService().getUrl()`, así que el
botón "Ver dashboard" funciona sin configurar nada.

`WEB_APP_URL` la lee únicamente `bot.js`, para armar los enlaces de los mensajes de
Slack. Si harás la Parte B:

**Configuración del proyecto (⚙️) → Propiedades del script → Añadir propiedad:**

| Propiedad | Valor |
|---|---|
| `WEB_APP_URL` | la URL `/exec` del paso A7 |

> No hace falta redesplegar tras añadirla: las Script Properties se leen en tiempo
> de ejecución. Solo los **cambios de código** requieren nueva versión.

---

### ✅ A9. Probar que levanta

1. Abre la URL `/exec` → debe cargar el **grid semanal** con Room A, B y C
2. Arrastra sobre el grid → llena el formulario → **Book room**
3. Verifica en Google Calendar que el evento se creó en la sala correcta
4. Abre `TU_URL/exec?page=dashboard` → debe cargar el **dashboard en vivo**

---

### ⚪ A10. Sembrar datos para que la demo se vea viva

Antes de enseñarla, crea **4–6 eventos de prueba** repartidos en los tres
calendarios, en horas de **hoy y mañana** dentro de 06:00–17:00.

Un grid completamente vacío se ve roto aunque esté funcionando bien.

---

**⏹ Si vas a enseñar la demo sin Slack, aquí terminas.** Salta a
[§ Demo sin Slack](#demo-sin-slack).

---

## Parte B — Slack (opcional completa)

> Toda la Parte B es opcional. La app de reservas funciona al 100% sin ella.

### ⚪ B1. Crear el workspace de Slack de prueba

**El plan gratuito de Slack cubre todo lo que usa esta demo.** No necesitas pagar.
La app solo llama a 4 métodos, todos disponibles en el plan gratis:
`chat.postMessage`, `conversations.open`, `users.lookupByEmail` y `views.publish`.
El límite de 90 días de historial es irrelevante para una demo.

1. [slack.com/get-started#/createnew](https://slack.com/get-started#/createnew)
2. Crea un workspace nuevo, p. ej. `room-booking-demo`
3. Crea un canal `#room-bookings`

> Los avisos de reserva y los recordatorios llegan por **DM** a la persona
> involucrada, no al canal. El canal solo se usa como respaldo cuando el DM no se
> puede entregar (`bot.js:964`), para los reportes de sala usada sin reservar, y
> para `testSlackIntegration`. Aun así conviene crearlo: es donde compruebas que
> el token quedó bien.

> ### 🔑 El mapeo de correo → Slack es obligatorio
>
> El bot no descubre a nadie solo: `isNotifiableEmail` (`bot.js:111`) solo considera
> notificable a quien esté listado en `SLACK_USER_OVERRIDES_JSON`, y sin eso no se
> manda ningún DM. Lo configuras en el [paso B5](#-b5-mapear-tu-correo--tu-usuario-de-slack-obligatorio-si-usas-slack),
> y aplica aunque uses el mismo correo en Google y en Slack.

> Usa un workspace **nuevo y desechable**, no el de tu empresa ni el de un
> cliente. La demo manda DMs y mensajes de prueba.

---

### ⚪ B2. Crear la app de Slack

1. [api.slack.com/apps](https://api.slack.com/apps) → **Create New App → From scratch**
2. Nombre: `Room Booking Demo` · workspace: el de B1
3. **OAuth & Permissions → Bot Token Scopes**, añade exactamente:

| Scope | Para qué |
|---|---|
| `chat:write` | Mandar mensajes y recordatorios |
| `im:write` | Abrir DMs con los usuarios |
| `users:read` | Leer el directorio de usuarios |
| `users:read.email` | Relacionar correo de Calendar ↔ usuario de Slack |

---

### ⚪ B3. Instalar el bot en el workspace

1. **OAuth & Permissions → Install to Workspace** → **Permitir**
2. Copia el **Bot User OAuth Token** (empieza con `xoxb-`)
3. En Slack: invita el bot al canal → `/invite @Room Booking Demo`

> Si no invitas el bot al canal, `chat.postMessage` falla con `not_in_channel`.

---

### ⚪ B4. Guardar las credenciales en Script Properties

**Configuración del proyecto (⚙️) → Propiedades del script:**

| Propiedad | Valor | Dónde sacarlo |
|---|---|---|
| `SLACK_BOT_TOKEN` | `xoxb-...` | Paso B3 |
| `SLACK_DEFAULT_CHANNEL` | `C01234ABCDE` | Slack → canal → `⌄` → abajo del todo, **Channel ID** |
| `SLACK_ADMIN_ID` | `U01234ABCDE` | Slack → tu perfil → `⋮` → **Copiar ID de miembro** |
| `SLACK_USER_OVERRIDES_JSON` | `{"tu-correo@gmail.com":"U01234ABCDE"}` | Ver **B5** — sin esto no sale ningún DM |

> 🔒 **Nunca escribas el token dentro de los archivos `.js`.** Va solo en
> Script Properties. El `.gitignore` del repo ya bloquea archivos con
> `*token*` / `*secret*` / `*credentials*`, y `Config.js` / `Migration.js`.

---

### ✅ B5. Mapear tu correo → tu usuario de Slack (obligatorio si usas Slack)

**Sin esta propiedad no se envía ni un solo DM, y no verás ningún error.**

La cadena es: `getEventParticipantsToNotify` → `addParticipant` →
`if (!isNotifiableEmail(trimmed)) return false` (`bot.js:475`). Y
`isNotifiableEmail` (`bot.js:111`) devuelve `true` **solo** si el correo aparece en
`SLACK_USER_OVERRIDES`, que se arma a partir de esta propiedad —
`DEFAULT_SLACK_USER_OVERRIDES` viene vacío a propósito.

Es decir: aunque el correo de Google y el de Slack sean idénticos, la lista de
participantes sale vacía y `users.lookupByEmail` nunca llega a ejecutarse. El filtro
corta antes.

Añade la propiedad con tu correo de **Google** y tu ID de **Slack**:

| Propiedad | Valor |
|---|---|
| `SLACK_USER_OVERRIDES_JSON` | `{"tu-correo@gmail.com":"U01234ABCDE"}` |

Para varias personas, sepáralas con coma:

```json
{"ana@gmail.com":"U01234ABCDE","luis@gmail.com":"U05678FGHIJ"}
```

> ⚠️ Es JSON. Si le falta una comilla o una llave, `bot.js:105` se lo traga en un
> `catch` y te quedas sin DMs, otra vez en silencio. Pégalo con cuidado.

---

### ⚪ B6. Probar la conexión con Slack

En el editor de Apps Script, selecciona la función **`testSlackIntegration`** →
**Ejecutar**.

Debe llegar un mensaje al canal de B1. Si no llega, revisa
[§ Problemas comunes](#problemas-comunes).

---

### ⚪ B7. Crear los triggers de recordatorios

Selecciona la función **`setupReminderTriggers`** → **Ejecutar**.

Crea los 4 triggers de golpe (y borra duplicados previos):

| Función | Frecuencia | Qué hace |
|---|---|---|
| `remindUpcomingBookings` | cada 1 min | DM antes de que empiece la junta |
| `remindEndingBookings` | cada 1 min | DM antes de que termine |
| `notifyRecentRoomBookings` | cada 1 min | Avisa de reservas nuevas |
| `sendDailyDigest` | diario 8:00 AM | Resumen del día |

Verifica en **Activadores (⏰)** que aparezcan los 4.

> ### ⚠️ Gmail personal: crea los triggers poco antes de la demo, y bórralos después
>
> Una cuenta Gmail gratuita tiene **90 minutos/día** de tiempo de ejecución de
> triggers (Workspace tiene 6 horas). Estos 4 triggers corriendo cada minuto son
> ~5,760 ejecuciones al día: **te pasas de la cuota**, Google los empieza a fallar
> y te manda correos de error.
>
> Para la demo:
> 1. Corre `setupReminderTriggers` **una hora antes** de la reunión
> 2. Al terminar, ve a **Activadores (⏰)** y **bórralos** (`⋮` → Eliminar)
>
> No bajes la frecuencia a 5 minutos: `notifyRecentRoomBookings` es el que hace que
> el aviso aparezca en Slack segundos después de reservar en vivo, y es de los
> mejores momentos de la demo.

> ⚠️ Los recordatorios solo se disparan **en días hábiles, entre 06:00 y 17:00**
> (`OFFICE_HOURS` en `bot.js`). Fuera de ese rango no verás nada y **no es un
> error**. Si vas a ensayar la demo de noche, ajusta `OFFICE_HOURS` temporalmente.

---

### ⚪ B8. App Home del bot

**Slack app → App Home →** activa **Home Tab**.

`bot-home.html` es una **maqueta de referencia** del diseño del Home tab; no se
despliega ni se publica. El Home real lo pinta `bot.js` con `views.publish`.

---

## Demo sin Slack

**Qué hacer:** Parte A completa (A1 → A9, más A10 recomendado).
**Qué saltar:** **toda la Parte B** (B1 → B8).

### Qué sigue funcionando (todo lo visual)

- ✅ Grid semanal con las 3 salas
- ✅ Reservar arrastrando, redimensionar, cancelar
- ✅ Dashboard de disponibilidad en vivo (`?page=dashboard`)
- ✅ Sugerencias rápidas y salas recomendadas
- ✅ "Mis reservas de hoy"
- ✅ Los eventos se crean de verdad en Google Calendar

### Qué no vas a poder enseñar

- ❌ DMs de recordatorio (antes de empezar / antes de terminar)
- ❌ Resumen diario de las 8:00 AM
- ❌ Aviso de reservas nuevas en el canal
- ❌ El Home tab del bot en Slack

### ¿Se rompe algo?

No. Cada llamada a Slack está envuelta en `try/catch` y protegida con
`typeof ... === 'function'`. Si `SLACK_BOT_TOKEN` está vacío, el envío se
aborta y solo deja una línea en el **log de ejecución de Apps Script** — nada
visible para quien está viendo la demo. No hay errores en pantalla ni popups
rojos, y la reserva se crea igual en Google Calendar.

La interfaz se ve **exactamente igual** con o sin Slack.

**Sugerencia:** si la demo va sin Slack, menciónalo tú como "la integración de
Slack se conecta después" en vez de dejar que el cliente pregunte por qué no
llegó ningún recordatorio.

---

## Resumen: Script Properties

| Propiedad | ¿Obligatoria? | Ejemplo |
|---|---|---|
| `WEB_APP_URL` | ⚪ Solo con Slack | `https://script.google.com/macros/s/AKfycb.../exec` |
| `SLACK_BOT_TOKEN` | ⚪ Solo con Slack | `xoxb-...` |
| `SLACK_DEFAULT_CHANNEL` | ⚪ Solo con Slack | `C01234ABCDE` |
| `SLACK_ADMIN_ID` | ⚪ Solo con Slack | `U01234ABCDE` |
| `SLACK_USER_OVERRIDES_JSON` | ⚪ Solo con Slack — pero **imprescindible** si lo usas | `{"a@b.com":"U0123"}` |

---

## Guion sugerido de la demo

Un orden que enseña **todo** sin tiempos muertos. Comparte pantalla, logueado con
tu cuenta de Google, con Slack abierto en otra ventana.

| # | Qué haces | Qué se ve |
|---|---|---|
| 1 | Abres la URL `/exec` | Grid semanal con las 3 salas y los eventos sembrados |
| 2 | Arrastras sobre un hueco libre → **Book room** | La reserva se pinta al instante |
| 3 | Cambias a la ventana de Slack | En ~60s entra el **DM** de confirmación de la reserva |
| 4 | Abres `?page=dashboard` | Dashboard de disponibilidad en vivo |
| 5 | Vuelves al planner | "Mis reservas de hoy" y "Salas recomendadas" |
| 6 | Home tab del bot en Slack | El panel de Block Kit |

### Truco: no esperes a las 8:00 AM para el resumen diario

En el editor, selecciona la función **`debugSendDailyDigestToMe`** → **Ejecutar**.
Manda el resumen diario a tu DM **en el momento**, sin depender del trigger.

Igual con `testSlackIntegration` si necesitas reprobar la conexión en vivo.

### Antes de empezar

- Cierra las pestañas del editor de Apps Script (se ve a medio construir)
- Ten la URL `/exec` ya abierta en una pestaña limpia
- Verifica que estás dentro del horario 06:00–17:00 entre semana, o los
  recordatorios de Slack no se van a disparar

---

## Checklist final (antes de enseñarla)

- [ ] **Paso 0 pasado**: al invitar el calendario de sala, el evento sí aparece en él
- [ ] La URL `/exec` abre el grid estando logueado con tu cuenta
- [ ] Se ven las 3 salas con sus nombres correctos
- [ ] Puedes reservar arrastrando y el evento aparece en Google Calendar
- [ ] `?page=dashboard` carga bien
- [ ] Hay 4–6 eventos sembrados para que no se vea vacío (A10)
- [ ] La zona horaria cuadra con la hora de la reunión (A5)
- [ ] ⚪ Con Slack: llegó el mensaje de `testSlackIntegration` y hay 4 triggers

---

## Problemas comunes

| Síntoma | Causa probable | Arreglo |
|---|---|---|
| Grid vacío / no cargan salas | Calendar API no activada | Paso **A4** |
| `File not found: UI` | Archivo HTML mal nombrado | Paso **A3** — debe ser `UI`, no `ui` ni `UI.html` |
| Las salas salen pero sin eventos | Calendar IDs mal pegados | Paso **A6** — revisa comillas y que no falte nada |
| Quien ve la demo recibe "necesitas permiso" | Le mandaste el link con acceso *Solo yo* | Comparte pantalla (recomendado), o redespliega con *Cualquier usuario* — ver aviso en **A7** |
| Las horas no cuadran | Zona horaria del proyecto | Paso **A5** |
| Cambié el código y no se refleja | Falta redesplegar | **Implementar → Gestionar → ✏️ → Versión: Nueva → Implementar** |
| Slack no manda nada | Token o canal mal | Pasos **B3/B4** — y que el bot esté invitado al canal |
| `not_in_channel` | Bot no invitado | `/invite @Room Booking Demo` en el canal |
| Recordatorios nunca llegan | Fuera de 06:00–17:00 o fin de semana | Ver nota en **B7** |

---

## Nota sobre la URL de overflow

El botón **"Open overflow booking"** (en `UI.html`) y **"Book overflow"** (en el
Home de Slack) apuntan todavía a una URL de proveedor externo heredada del
despliegue anterior. Los textos visibles ya son neutros, pero **la URL sigue
siendo la de antes**.

Antes de enseñar la demo, decide una de estas:

- Cambiarla por la URL del proveedor del cliente nuevo
- Apuntarla a `#` si no aplica
- Dejarla (no rompe nada, pero abre un sitio de terceros si le dan clic)

Ubicaciones exactas: `UI.html:349` y `bot.js:2270`.
