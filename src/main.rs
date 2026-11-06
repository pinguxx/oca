mod board;
mod game;
mod ws;

use axum::extract::{State, WebSocketUpgrade};
use axum::http::{header, HeaderValue};
use axum::response::{IntoResponse, Json};
use axum::routing::get;
use axum::Router;
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;
use tower_http::set_header::SetResponseHeaderLayer;

use crate::board::BoardDefinition;
use crate::ws::{handle_ws_connection, start_background_maintenance, AppState};

async fn health_check_api(State(state): State<AppState>) -> impl IntoResponse {
    let rooms_count = state.rooms.read().await.len();
    let sockets_guard = state.sockets.read().await;
    let connections_count: usize = sockets_guard.values().map(|r| r.len()).sum();

    Json(serde_json::json!({
        "status": "ok",
        "service": "el-juego-de-la-oca-rust",
        "active_rooms": rooms_count,
        "active_connections": connections_count
    }))
}

async fn get_board_api() -> impl IntoResponse {
    let board = BoardDefinition::classic();
    Json(serde_json::json!({
        "total_tiles": board.total_tiles,
        "tiles": board.tiles
    }))
}

async fn ws_handler(ws: WebSocketUpgrade, State(state): State<AppState>) -> impl IntoResponse {
    ws.max_message_size(32 * 1024)
        .on_upgrade(move |socket| handle_ws_connection(socket, state))
}

pub fn create_app(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/health", get(health_check_api))
        .route("/healthz", get(health_check_api))
        .route("/api/health", get(health_check_api))
        .route("/api/board", get(get_board_api))
        .route("/ws", get(ws_handler))
        .fallback_service(ServeDir::new("public"))
        .layer(SetResponseHeaderLayer::overriding(
            header::CACHE_CONTROL,
            HeaderValue::from_static("no-cache, no-store, must-revalidate"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            header::PRAGMA,
            HeaderValue::from_static("no-cache"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            header::EXPIRES,
            HeaderValue::from_static("0"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            header::X_CONTENT_TYPE_OPTIONS,
            HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            header::X_FRAME_OPTIONS,
            HeaderValue::from_static("SAMEORIGIN"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            header::REFERRER_POLICY,
            HeaderValue::from_static("strict-origin-when-cross-origin"),
        ))
        .layer(cors)
        .with_state(state)
}

#[tokio::main]
async fn main() {
    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(3000);

    let state = AppState::new();
    start_background_maintenance(state.clone());

    let app = create_app(state);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));

    println!("====================================================");
    println!("🦆 ¡El Juego de la Oca - Servidor Iniciado!");
    println!("📍 Escuchando en http://localhost:{}", port);
    println!("🎲 Modo multijugador WebSockets activo");
    println!("====================================================");

    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("Error al enlazar el puerto {}: {}", port, e);
            std::process::exit(1);
        }
    };

    if let Err(e) = axum::serve(listener, app).await {
        eprintln!("Error en el servidor: {}", e);
    }
}
