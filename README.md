# 🦆 El Juego de la Oca Online 🎲

Un juego de mesa tradicional mexicano e hispano desarrollado en **Rust** (con **Axum** y **WebSockets**) y un cliente web interactivo con tablero espiral responsivo en **SVG**.

Forma parte de la colección de juegos tradicionales clásicos junto a **Lotería Mexicana**, **Serpientes y Escaleras** y **La Pirinola (Toma Todo)**.

---

## 🌟 Características Principales

* 🌀 **Tablero Tradicional de 63 Casillas en Espiral:**
  * 🦆 **Las Ocas (5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59):** *«De oca a oca y tiro porque me toca»*.
  * 🌉 **El Puente (6 y 12):** *«De puente a puente y tiro porque me lleva la corriente»*.
  * 🎲 **Los Dados (26 y 53):** *«De dados a dados y tiro porque me ha tocado»*.
  * 🏨 **La Posada (19):** Descansas y pierdes 1 turno.
  * 🕳️ **El Pozo (31):** Atrapado hasta ser rescatado por otro jugador o pasar 3 turnos.
  * 🌀 **El Laberinto (42):** *«Del laberinto al 30»* (retrocedes a la 30).
  * ⛓️ **La Cárcel (52):** Pierdes 2 turnos detenido.
  * 💀 **La Muerte (58):** Vuelves al inicio: casilla 1.
  * 🏆 **Gran Jardín de la Oca (63):** Llegada con número exacto o **rebote hacia atrás**.
  * 🎯 **Regla Clásica del 9 Inicial:** 5+4 te lleva a los Dados (53); 6+3 te lleva a los Dados (26).
* ⏱️ **Temporizador de Turno y Protección AFK:** Configurable (15s, 20s recomendado, 30s o sin límite manual). Si un jugador se ausenta, el servidor tira automáticamente para mantener la partida activa y fluida.
* 🔄 **Persistencia de Sesión y Reconexión Automática:** Si recargas el navegador o pierdes la conexión momentáneamente, te reconectas de inmediato a tu sala y conservas tu turno y ficha.
* 🎲 **Dados 3D Optimizados para Móviles:** Rotación 3D realista con acabado nítido sin bordes ni artefactos en Android o iOS.
* 🌐 **Multijugador en Tiempo Real:** Salas privadas con código de 4 letras y código QR para unirse desde el celular.
* 🤖 **Modo Solitario con Bots IA:** Juega contra *Don Ganso*, *Oca Veloz*, *Gansito*, *Doña Plumas*, etc.
* 🎵 **Efectos de Sonido WebAudio API:** Dados, graznidos de oca (*honk!*), agua en el puente, fanfarria triunfal mexicana, sin necesidad de archivos de audio pesados.
* 📱 **PWA & Responsive:** Diseñado para jugar tanto en móviles como en pantallas de escritorio.

---

## 🚀 Cómo Ejecutar Localmente

### Requisitos
* [Rust](https://www.rust-lang.org/) (versión 1.75 o superior)

### Pasos
```bash
# 1. Clonar o entrar a la carpeta
cd c:\dev\oca

# 2. Compilar y correr pruebas unitarias
cargo test

# 3. Iniciar el servidor
cargo run
```

Abre tu navegador en:  
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🐳 Despliegue con Docker

El proyecto incluye un `Dockerfile` multi-stage ligero optimizado para **Render**, **Fly.io**, **Railway** y **Google Cloud Run**:

```bash
docker build -t el-juego-de-la-oca .
docker run -p 3000:3000 el-juego-de-la-oca
```

---

## 📁 Estructura del Código

```
c:\dev\oca\
├── Cargo.toml               # Dependencias de Rust (axum, tokio, serde, rand)
├── Dockerfile               # Multi-stage build para despliegue
├── render.yaml              # Configuración de despliegue en Render.com
├── src/
│   ├── main.rs              # Servidor HTTP/WebSocket y enrutamiento
│   ├── board.rs             # Coordenadas espirales y reglas de las 63 casillas
│   ├── game.rs              # Motor de estado, turnos, rebotes, trampas e IA
│   └── ws.rs                # Gestión de WebSockets, salas y sincronización
└── public/
    ├── index.html           # Interfaz del juego y tablero SVG
    ├── style.css            # Estilos y animación de dados 3D
    ├── app.js               # Lógica del cliente y renderizado de fichas
    ├── audio.js             # Sintetizador WebAudio API
    ├── icon.svg             # Ícono del juego
    ├── manifest.json        # Manifiesto PWA
    └── qrcode.min.js        # Generador de códigos QR
```
