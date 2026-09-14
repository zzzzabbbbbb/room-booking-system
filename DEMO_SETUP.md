# DEMO_SETUP.md — Levantar la demo desde cero

Checklist en orden. Sigue los pasos de arriba hacia abajo.

**Leyenda**

| Marca | Significado |
|---|---|
| ✅ | **Obligatorio.** Sin esto la demo no levanta. |
| ⚪ | **Opcional.** Puedes saltártelo (ver [§ Demo sin Slack](#demo-sin-slack)). |

**Tiempo estimado**

- Solo Google Calendar (Parte A): **~20–30 min**
- Con Slack (Parte A + B): **~50–70 min**

> **¿Solo quieres enseñar la demo sin Slack?**
> Haz la **Parte A completa** y salta la **Parte B entera**. Nada más.
> Detalle de qué se pierde: [§ Demo sin Slack](#demo-sin-slack).

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

**Si tienes Google Workspace** puedes usar *recursos de sala* reales en vez de
calendarios normales (Admin console → Edificios y recursos). Funciona igual;
el ID solo cambia de dominio (`@resource.calendar.google.com`).

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

### ✅ A7. Desplegar el Web App con acceso público

1. Arriba a la derecha → **Implementar → Nueva implementación**
2. Icono de engrane ⚙️ → tipo **Aplicación web**
3. Configura:

| Campo | Valor |
|---|---|
| Descripción | `Demo v1` |
| **Ejecutar como** | **Yo** (`tu-correo@...`) |
| **Quién tiene acceso** | **Cualquier usuario** |

> **"Ejecutar como: Yo" es lo que hace que la demo funcione.** La app lee los
> calendarios con *tus* permisos, así que quien vea la demo no necesita tener
> acceso a los calendarios ni iniciar sesión.
>
> Si tu organización bloquea **"Cualquier usuario"**, usa
> *"Cualquier usuario de \<tu-dominio\>"* — pero entonces quien vea la demo
> tendrá que estar en tu dominio. Verifícalo **antes** de la reunión.

4. **Implementar** → Google te pedirá autorizar los permisos → acepta
   (pantalla "no verificada" → *Configuración avanzada* → *Ir a Room Booking Demo*)
5. **Copia la URL del Web App.** Termina en `/exec`:
   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```

---

### ✅ A8. Guardar la URL en Script Properties

**Configuración del proyecto (⚙️) → Propiedades del script → Añadir propiedad:**

| Propiedad | Valor |
|---|---|
| `WEB_APP_URL` | la URL `/exec` del paso A7 |

Esto alimenta los botones "Abrir planner" y "Ver dashboard".

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

1. [slack.com/get-started#/createnew](https://slack.com/get-started#/createnew)
2. Crea un workspace nuevo, p. ej. `room-booking-demo`
3. Crea un canal `#room-bookings`

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

> 🔒 **Nunca escribas el token dentro de los archivos `.js`.** Va solo en
> Script Properties. El `.gitignore` del repo ya bloquea archivos con
> `*token*` / `*secret*` / `*credentials*`, y `Config.js` / `Migration.js`.

---

### ⚪ B5. Mapear correos → usuarios de Slack

El bot resuelve el usuario por correo con `users.lookupByEmail`. **Si usas el
mismo correo en Google y en Slack de prueba, esto funciona solo y puedes
saltarte este paso.**

Si los correos no coinciden (muy común en un workspace desechable), añade
una propiedad más:

| Propiedad | Valor |
|---|---|
| `SLACK_USER_OVERRIDES_JSON` | `{"tu-correo@gmail.com":"U01234ABCDE"}` |

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
| `WEB_APP_URL` | ✅ Sí | `https://script.google.com/macros/s/AKfycb.../exec` |
| `SLACK_BOT_TOKEN` | ⚪ Solo con Slack | `xoxb-...` |
| `SLACK_DEFAULT_CHANNEL` | ⚪ Solo con Slack | `C01234ABCDE` |
| `SLACK_ADMIN_ID` | ⚪ Solo con Slack | `U01234ABCDE` |
| `SLACK_USER_OVERRIDES_JSON` | ⚪ Solo si los correos no coinciden | `{"a@b.com":"U0123"}` |

---

## Checklist final (antes de enseñarla)

- [ ] La URL `/exec` abre el grid **en una ventana de incógnito**
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
| Quien ve la demo recibe "necesitas permiso" | Deploy con acceso restringido | Paso **A7** — *Cualquier usuario* + *Ejecutar como: Yo* |
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
