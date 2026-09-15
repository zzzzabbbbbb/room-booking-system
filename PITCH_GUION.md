# Guion de grabación — video de 4–5 min

Material **interno**, para ti. Lo que el prospecto ve es el video y el deck.

---

## Antes de grabar

**Prepara el escenario** (15 min, no lo hagas con las prisas encima):

- [ ] Siembra **6–8 eventos** repartidos en las 3 salas, hoy y mañana, entre 06:00 y 17:00.
      Un grid vacío se ve roto aunque funcione bien.
- [ ] Ponles nombres creíbles: `Weekly de ventas`, `1:1 Ana / Luis`, `Demo cliente`.
      Nada de `asdf` ni `prueba 3`.
- [ ] Crea **una junta en tu calendario personal, sin sala**, para mañana. Es la que
      dispara la sección de salas recomendadas (`App.js:611`). **Sin esto no puedes
      grabar la mejor parte.**
- [ ] Deja un hueco libre visible donde vas a reservar en vivo.
- [ ] Ten Slack abierto en otra ventana, en **tu DM con el bot** (ahí llegan los avisos).
- [ ] Corre `setupReminderTriggers` una hora antes (ver cuota en DEMO_SETUP.md § B7).

**Higiene de pantalla:**

- [ ] Cierra la pestaña del editor de Apps Script. Que no se vea el andamio.
- [ ] Ventana del navegador limpia: sin marcadores personales, sin otras pestañas.
- [ ] Zoom del navegador al **110–125%**. El grid tiene texto chico y en video se pierde.
- [ ] Silencia notificaciones del sistema.
- [ ] Graba en **1080p**. Loom, o QuickTime si estás en Mac.

**Consejo:** graba 2 o 3 tomas. La primera siempre sale tiesa. No busques perfección,
busca que se entienda.

---

## El guion

> Los tiempos son referencia. Si te pasas a 6 min no importa; si te pasas de 8, corta.

### 0:00 – 0:20 · El problema

**Se ve:** el grid ya cargado, semana completa.

> "Esto es el planner de salas. Antes de entrar a lo que hace, el problema que
> resuelve: la gente da vueltas buscando sala libre, llegan juntas sin sala asignada,
> y hay salas apartadas que nadie usa. Todo esto corre sobre los calendarios de
> Google que ustedes ya tienen — no es un sistema aparte."

**No digas** "es una herramienta muy completa". Di qué duele.

---

### 0:20 – 1:10 · Reservar arrastrando

**Haces:** arrastras sobre un hueco libre → se abre el panel → llenas título → **Book room**.

> "Ves la semana completa de las tres salas. Para reservar, arrastras sobre el hueco
> que quieres. Le pongo título… y listo."

**Pausa 2 segundos** con el bloque ya pintado. Deja que se vea.

> "Eso ya es un evento real en Google Calendar, con la sala como invitada. Si alguien
> lo abre desde su celular, ahí está."

---

### 1:10 – 1:40 · Conflicto resuelto solo

**Haces:** intentas reservar encima de un bloque ocupado.

> "Si intento apartar algo que ya está ocupado…"

**Se ve:** la app detecta el choque y propone el siguiente hueco libre.

> "…no me deja y me propone el siguiente espacio disponible. No tengo que ponerme a
> buscar a mano."

*(Esto es `findNextGap`, `App.js:329`.)*

---

### 1:40 – 2:30 · La parte que los va a convencer

**Haces:** bajas a **"Salas recomendadas para mis juntas"**.

> "Aquí está la diferencia con cualquier otro sistema de salas. La app revisa mis
> juntas de los próximos 7 días y encuentra las que **no tienen sala asignada**.
> Para cada una, me dice qué salas están libres a esa hora exacta."

**Haces:** asignas una sala a esa junta con un clic.

> "Un clic y queda. No tuve que entrar a buscar, el sistema me lo trajo."

> **Esta es tu mejor toma. No la apresures.** El resto son mesas de billar que
> cualquiera tiene; esto es lo que no tienen.

---

### 2:30 – 3:00 · Mis reservas y el dashboard

**Haces:** señalas "Mis reservas de hoy", luego abres el dashboard (`?page=dashboard`).

> "Abajo veo mis reservas del día y puedo cancelar desde aquí. Y hay una vista de
> disponibilidad en vivo — esta es para poner en una pantalla junto a las salas o en
> recepción, para ver de un vistazo qué está libre ahora."

---

### 3:00 – 4:00 · Slack

**Haces:** cambias a la ventana de Slack.

> "Y todo esto avisa por Slack, que es donde la gente ya está."

Muestra, en este orden:

1. **El DM de confirmación de la reserva que acabas de hacer** (llega en ~1 min por `notifyRecentRoomBookings`)
2. **El Home tab del bot** — el panel con accesos rápidos
3. Si tienes un DM de recordatorio, muéstralo

> "Todo llega por mensaje directo, no a un canal que la gente silencia. Cuando apartas
> una sala te llega la confirmación. Cinco minutos antes de que empiece tu junta, un
> recordatorio. Y otro cinco minutos antes de que termine, para que liberes la sala a
> tiempo. En las mañanas, un resumen del día."

### La toma que cierra la venta

Después de lo anterior, agenda una junta **desde Google Calendar** (no desde la app)
e invita una sala como invitado.

> "Y ojo con esto: no agendé desde la app, agendé desde mi calendario de siempre.
> Aun así aparece en el planner y dispara el mismo aviso. El sistema se acopla a como
> ya trabajan; nadie tiene que cambiar de herramienta."

Es el argumento más fuerte que tienes: en la práctica la gente no entra a la app,
agenda desde el calendario. `notifyRecentRoomBookings` (`bot.js:1106`) escanea los
calendarios de las salas directamente, así que le da igual de dónde vino la reserva.

> ⚠️ Los recordatorios son de **5 minutos** antes de empezar y **5 minutos** antes de
> terminar (`bot.js:38-39`). El README viejo dice 15 y 10 — está desactualizado. No
> prometas números que el sistema no cumple.

**Truco:** si no quieres esperar al resumen diario, corre `debugSendDailyDigestToMe`
antes de grabar y ya lo tienes en el DM listo para mostrar.

---

### 4:00 – 4:30 · Cierre

**Se ve:** de regreso en el grid.

> "En resumen: corre sobre sus calendarios de Google, sin servidores que mantener y
> sin otro sistema que la gente tenga que aprender. Se configura en una tarde. Si les
> late, lo dejamos montado en su Workspace con sus salas reales."

**Termina ahí.** No agregues "cualquier duda quedo a sus órdenes" dentro del video —
eso va en el correo.

---

## Errores que arruinan demos

| No hagas esto | Haz esto |
|---|---|
| Narrar cada clic ("ahora le doy aquí, ahora acá") | Habla del resultado, deja que el clic se vea |
| Enseñar el editor de Apps Script | Que no se vea el andamio. Solo el producto |
| Pedir disculpas ("perdón, va lento") | Corta y vuelve a grabar |
| Grid vacío | Siembra datos antes |
| Mostrar todo lo que hace | Muestra las 4 cosas que importan |
| Prometer lo que no está | Si algo no lo probaste, no lo enseñes |

---

## El correo que acompaña el video

Corto. El video hace el trabajo.

> Asunto: **Sistema de reservas de salas — demo de 4 min**
>
> Hola [nombre]:
>
> Te dejo un video corto del sistema de reservas de salas del que platicamos: [link]
>
> Corre sobre los calendarios de Google que ya usan, así que no hay servidores que
> mantener ni otro sistema que aprender. Lo que más se nota en el día a día es que
> detecta las juntas que quedaron sin sala y propone las que están libres.
>
> Si te late, agendamos 20 minutos y lo dejamos montado con sus salas reales para
> que lo prueben.
>
> Saludos,
> [tu nombre]

---

## Si acepta

Avísame y preparamos el `PRODUCTION_SETUP.md`: despliegue en la cuenta **del cliente**
(no la tuya), recursos de sala reales de Workspace, modo de ejecución correcto,
cuotas y traspaso.
