use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use rand::RngExt;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, RwLock};

use crate::game::{GameRoom, GameStatus};

pub type RoomSockets = HashMap<String, mpsc::UnboundedSender<Message>>;
pub const MAX_ACTIVE_ROOMS: usize = 500;

#[derive(Clone)]
pub struct AppState {
    pub rooms: Arc<RwLock<HashMap<String, GameRoom>>>,
    pub sockets: Arc<RwLock<HashMap<String, RoomSockets>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

impl AppState {
    pub fn new() -> Self {
        Self {
            rooms: Arc::new(RwLock::new(HashMap::new())),
            sockets: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

pub fn generate_room_code() -> String {
    const WORDS: [&str; 12] = [
        "OCAS", "GANS", "PATO", "LAGO", "PLUM", "VOLA", "PICO", "NIDO", "MAIZ", "AGUA", "RIOS",
        "ALAS",
    ];
    let mut rng = rand::rng();
    let word = WORDS[rng.random_range(0..WORDS.len())];
    let num = rng.random_range(10..99);
    format!("{}{}", &word[0..2], num)
}

pub fn sanitize_name(name: &str, fallback: &str) -> String {
    let clean: String = name
        .trim()
        .chars()
        .filter(|c| !c.is_control() && *c != '<' && *c != '>')
        .take(18)
        .collect();

    if clean.is_empty() {
        fallback.to_string()
    } else {
        clean
    }
}

pub fn sanitize_color(color: Option<String>, default_color: &str) -> String {
    if let Some(c) = color {
        let trimmed = c.trim();
        if trimmed.starts_with('#')
            && trimmed.len() == 7
            && trimmed[1..].chars().all(|h| h.is_ascii_hexdigit())
        {
            return trimmed.to_lowercase();
        }
    }
    default_color.to_string()
}

pub fn sanitize_avatar(avatar: Option<String>, default_avatar: &str) -> String {
    if let Some(a) = avatar {
        let trimmed = a.trim();
        if !trimmed.is_empty()
            && trimmed.chars().count() <= 4
            && !trimmed.contains('<')
            && !trimmed.contains('>')
        {
            return trimmed.to_string();
        }
    }
    default_avatar.to_string()
}

pub async fn broadcast_to_room(state: &AppState, room_code: &str, payload: &Value) {
    let sockets_guard = state.sockets.read().await;
    if let Some(room_map) = sockets_guard.get(room_code) {
        let text = payload.to_string();
        for tx in room_map.values() {
            let _ = tx.send(Message::Text(text.clone().into()));
        }
    }
}

pub fn send_direct(tx: &mpsc::UnboundedSender<Message>, payload: &Value) {
    let _ = tx.send(Message::Text(payload.to_string().into()));
}

pub fn maybe_schedule_bot_turn(state: AppState, room_code: String, delay_ms: u64) {
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(delay_ms)).await;

        let mut turn_event_payload: Option<Value> = None;
        let mut room_state_payload: Option<Value> = None;
        let mut next_bot_delay: Option<u64> = None;

        {
            let mut rooms_guard = state.rooms.write().await;
            let Some(room) = rooms_guard.get_mut(&room_code) else {
                return;
            };

            if room.status != GameStatus::Playing {
                return;
            }

            let Some(curr) = room.current_player() else {
                return;
            };

            if !curr.is_bot {
                return;
            }

            let bot_id = curr.id.clone();
            if let Ok(event) = room.roll_dice(&bot_id) {
                let wait_ms = (event.path.len() as u64 * 250) + 2600;
                turn_event_payload = Some(json!({
                    "type": "turn_event",
                    "event": event
                }));
                room_state_payload = Some(json!({
                    "type": "room_state",
                    "room": room
                }));

                if room.status == GameStatus::Playing {
                    if let Some(next) = room.current_player() {
                        if next.is_bot {
                            next_bot_delay = Some(wait_ms);
                        }
                    }
                }
            }
        }

        if let Some(event_pl) = turn_event_payload {
            broadcast_to_room(&state, &room_code, &event_pl).await;
        }
        if let Some(state_pl) = room_state_payload {
            broadcast_to_room(&state, &room_code, &state_pl).await;
        }
        if let Some(delay) = next_bot_delay {
            maybe_schedule_bot_turn(state, room_code, delay);
        }
    });
}

#[derive(Debug, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case")]
enum ClientMessage {
    CreateRoom {
        player_name: Option<String>,
        color: Option<String>,
        avatar: Option<String>,
        two_dice: Option<bool>,
        turn_timer_seconds: Option<u64>,
    },
    JoinRoom {
        room_code: String,
        player_name: Option<String>,
        color: Option<String>,
        avatar: Option<String>,
        player_id: Option<String>,
    },
    StartGame,
    RestartGame,
    AddBot,
    RemovePlayer {
        player_id: String,
    },
    RollDice,
    ToggleTimer {
        seconds: Option<u64>,
    },
    SendChat {
        text: String,
    },
    Ping,
}

pub async fn handle_ws_connection(socket: WebSocket, state: AppState) {
    let (mut ws_sender, mut ws_receiver) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();

    let conn_id = format!("conn_{:08x}", rand::rng().random_range(0..u32::MAX));
    let mut current_room_code: Option<String> = None;
    let mut current_player_id: Option<String> = None;

    let writer_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    while let Some(Ok(msg)) = ws_receiver.next().await {
        let Message::Text(text_bytes) = msg else {
            continue;
        };

        let Ok(parsed) = serde_json::from_str::<ClientMessage>(&text_bytes) else {
            send_direct(
                &tx,
                &json!({ "type": "error", "message": "Mensaje inválido" }),
            );
            continue;
        };

        match parsed {
            ClientMessage::CreateRoom {
                player_name,
                color,
                avatar,
                two_dice,
                turn_timer_seconds,
            } => {
                let code = {
                    let mut rooms_guard = state.rooms.write().await;
                    if rooms_guard.len() >= MAX_ACTIVE_ROOMS {
                        send_direct(
                            &tx,
                            &json!({ "type": "error", "message": "Límite de salas activas alcanzado." }),
                        );
                        continue;
                    }
                    let mut candidate = generate_room_code();
                    while rooms_guard.contains_key(&candidate) {
                        candidate = generate_room_code();
                    }

                    let p_id = format!("user_{:08x}", rand::rng().random_range(0..u32::MAX));
                    let p_name = sanitize_name(&player_name.unwrap_or_default(), "Jugador 1");
                    let p_color = sanitize_color(color, "#e63946");
                    let p_avatar = sanitize_avatar(avatar, "🪿");

                    let mut room = GameRoom::new(
                        candidate.clone(),
                        p_id.clone(),
                        p_name,
                        Some(p_color),
                        Some(p_avatar),
                        two_dice.unwrap_or(true),
                    );
                    if let Some(timer) = turn_timer_seconds {
                        room.settings.turn_timer_seconds = timer;
                    }

                    rooms_guard.insert(candidate.clone(), room);
                    current_room_code = Some(candidate.clone());
                    current_player_id = Some(p_id);
                    candidate
                };

                // Register socket
                {
                    let mut sockets_guard = state.sockets.write().await;
                    let room_map = sockets_guard.entry(code.clone()).or_default();
                    room_map.insert(conn_id.clone(), tx.clone());
                }

                // Send back state
                let rooms_guard = state.rooms.read().await;
                if let Some(r) = rooms_guard.get(&code) {
                    send_direct(
                        &tx,
                        &json!({
                            "type": "room_created",
                            "room": r,
                            "my_id": current_player_id
                        }),
                    );
                }
            }

            ClientMessage::JoinRoom {
                room_code,
                player_name,
                color,
                avatar,
                player_id,
            } => {
                let code = room_code.trim().to_uppercase();
                let mut is_reconnect = false;
                let actual_pid;

                {
                    let mut rooms_guard = state.rooms.write().await;
                    if let Some(room) = rooms_guard.get_mut(&code) {
                        if let Some(ref req_id) = player_id {
                            if room.players.iter().any(|p| p.id == *req_id) {
                                let clean_name =
                                    player_name.as_ref().map(|n| sanitize_name(n, "Jugador"));
                                let clean_color = color
                                    .as_ref()
                                    .map(|c| sanitize_color(Some(c.clone()), "#e63946"));
                                let clean_avatar = avatar
                                    .as_ref()
                                    .map(|a| sanitize_avatar(Some(a.clone()), "🪿"));

                                let _ = room.reconnect_player(
                                    req_id,
                                    clean_name,
                                    clean_color,
                                    clean_avatar,
                                );
                                actual_pid = req_id.clone();
                                is_reconnect = true;
                                current_room_code = Some(code.clone());
                                current_player_id = Some(actual_pid.clone());
                            } else {
                                actual_pid = req_id.clone();
                            }
                        } else {
                            actual_pid =
                                format!("user_{:08x}", rand::rng().random_range(0..u32::MAX));
                        }

                        if !is_reconnect {
                            let count = room.players.len() + 1;
                            let p_name = sanitize_name(
                                &player_name.unwrap_or_default(),
                                &format!("Jugador {}", count),
                            );
                            let p_color =
                                sanitize_color(color, crate::game::DEFAULT_COLORS[count % 6]);
                            let p_avatar =
                                sanitize_avatar(avatar, crate::game::DEFAULT_AVATARS[count % 6]);

                            match room.add_player(
                                actual_pid.clone(),
                                p_name,
                                Some(p_color),
                                Some(p_avatar),
                                false,
                            ) {
                                Ok(_) => {
                                    current_room_code = Some(code.clone());
                                    current_player_id = Some(actual_pid.clone());
                                }
                                Err(e) => {
                                    send_direct(&tx, &json!({ "type": "error", "message": e }));
                                    continue;
                                }
                            }
                        }
                    } else {
                        send_direct(
                            &tx,
                            &json!({ "type": "error", "message": "Sala no encontrada" }),
                        );
                        continue;
                    }
                }

                {
                    let mut sockets_guard = state.sockets.write().await;
                    let room_map = sockets_guard.entry(code.clone()).or_default();
                    room_map.insert(conn_id.clone(), tx.clone());
                }

                let rooms_guard = state.rooms.read().await;
                if let Some(r) = rooms_guard.get(&code) {
                    send_direct(
                        &tx,
                        &json!({
                            "type": "room_joined",
                            "room": r,
                            "my_id": actual_pid,
                            "is_reconnect": is_reconnect
                        }),
                    );
                    broadcast_to_room(
                        &state,
                        &code,
                        &json!({
                            "type": "room_state",
                            "room": r
                        }),
                    )
                    .await;
                }
            }

            ClientMessage::StartGame => {
                let Some(ref code) = current_room_code else {
                    continue;
                };
                let Some(ref p_id) = current_player_id else {
                    continue;
                };

                let mut started = false;
                {
                    let mut rooms_guard = state.rooms.write().await;
                    if let Some(room) = rooms_guard.get_mut(code) {
                        match room.start_game(p_id) {
                            Ok(_) => started = true,
                            Err(e) => {
                                send_direct(&tx, &json!({ "type": "error", "message": e }));
                            }
                        }
                    }
                }

                if started {
                    let rooms_guard = state.rooms.read().await;
                    if let Some(r) = rooms_guard.get(code) {
                        broadcast_to_room(
                            &state,
                            code,
                            &json!({
                                "type": "game_started",
                                "room": r
                            }),
                        )
                        .await;

                        if let Some(curr) = r.current_player() {
                            if curr.is_bot {
                                maybe_schedule_bot_turn(state.clone(), code.clone(), 1200);
                            }
                        }
                    }
                }
            }

            ClientMessage::RestartGame => {
                let Some(ref code) = current_room_code else {
                    continue;
                };
                let Some(ref p_id) = current_player_id else {
                    continue;
                };

                let mut restarted = false;
                {
                    let mut rooms_guard = state.rooms.write().await;
                    if let Some(room) = rooms_guard.get_mut(code) {
                        match room.restart_game(p_id) {
                            Ok(_) => restarted = true,
                            Err(e) => {
                                send_direct(&tx, &json!({ "type": "error", "message": e }));
                            }
                        }
                    }
                }

                if restarted {
                    let rooms_guard = state.rooms.read().await;
                    if let Some(r) = rooms_guard.get(code) {
                        broadcast_to_room(
                            &state,
                            code,
                            &json!({
                                "type": "game_started",
                                "room": r
                            }),
                        )
                        .await;

                        if let Some(curr) = r.current_player() {
                            if curr.is_bot {
                                maybe_schedule_bot_turn(state.clone(), code.clone(), 1200);
                            }
                        }
                    }
                }
            }

            ClientMessage::AddBot => {
                let Some(ref code) = current_room_code else {
                    continue;
                };
                let mut added = false;
                {
                    let mut rooms_guard = state.rooms.write().await;
                    if let Some(room) = rooms_guard.get_mut(code) {
                        match room.add_bot() {
                            Ok(_) => added = true,
                            Err(e) => {
                                send_direct(&tx, &json!({ "type": "error", "message": e }));
                            }
                        }
                    }
                }

                if added {
                    let rooms_guard = state.rooms.read().await;
                    if let Some(r) = rooms_guard.get(code) {
                        broadcast_to_room(
                            &state,
                            code,
                            &json!({
                                "type": "room_state",
                                "room": r
                            }),
                        )
                        .await;
                    }
                }
            }

            ClientMessage::RemovePlayer { player_id } => {
                let Some(ref code) = current_room_code else {
                    continue;
                };
                let mut should_delete = false;
                {
                    let mut rooms_guard = state.rooms.write().await;
                    if let Some(room) = rooms_guard.get_mut(code) {
                        should_delete = room.remove_player(&player_id);
                    }
                    if should_delete {
                        rooms_guard.remove(code);
                    }
                }

                if !should_delete {
                    let rooms_guard = state.rooms.read().await;
                    if let Some(r) = rooms_guard.get(code) {
                        broadcast_to_room(
                            &state,
                            code,
                            &json!({
                                "type": "room_state",
                                "room": r
                            }),
                        )
                        .await;
                    }
                }
            }

            ClientMessage::RollDice => {
                let Some(ref code) = current_room_code else {
                    continue;
                };
                let Some(ref p_id) = current_player_id else {
                    continue;
                };

                let mut turn_event_payload: Option<Value> = None;
                let mut room_state_payload: Option<Value> = None;
                let mut next_bot_delay: Option<u64> = None;

                {
                    let mut rooms_guard = state.rooms.write().await;
                    if let Some(room) = rooms_guard.get_mut(code) {
                        match room.roll_dice(p_id) {
                            Ok(event) => {
                                let wait_ms = (event.path.len() as u64 * 250) + 2600;
                                turn_event_payload = Some(json!({
                                    "type": "turn_event",
                                    "event": event
                                }));
                                room_state_payload = Some(json!({
                                    "type": "room_state",
                                    "room": room
                                }));

                                if room.status == GameStatus::Playing {
                                    if let Some(next) = room.current_player() {
                                        if next.is_bot {
                                            next_bot_delay = Some(wait_ms);
                                        }
                                    }
                                }
                            }
                            Err(e) => {
                                send_direct(&tx, &json!({ "type": "error", "message": e }));
                            }
                        }
                    }
                }

                if let Some(e) = turn_event_payload {
                    broadcast_to_room(&state, code, &e).await;
                }
                if let Some(s) = room_state_payload {
                    broadcast_to_room(&state, code, &s).await;
                }
                if let Some(delay) = next_bot_delay {
                    maybe_schedule_bot_turn(state.clone(), code.clone(), delay);
                }
            }

            ClientMessage::SendChat { text } => {
                let Some(ref code) = current_room_code else {
                    continue;
                };
                let Some(ref p_id) = current_player_id else {
                    continue;
                };

                let clean_text = text.trim();
                if clean_text.is_empty() || clean_text.len() > 160 {
                    continue;
                }

                let mut chat_msg = None;
                {
                    let mut rooms_guard = state.rooms.write().await;
                    if let Some(room) = rooms_guard.get_mut(code) {
                        chat_msg = room.add_chat(p_id.clone(), clean_text.to_string());
                    }
                }

                if let Some(msg) = chat_msg {
                    broadcast_to_room(
                        &state,
                        code,
                        &json!({
                            "type": "chat_message",
                            "chat": msg
                        }),
                    )
                    .await;
                }
            }

            ClientMessage::ToggleTimer { seconds } => {
                let Some(ref code) = current_room_code else {
                    continue;
                };
                let Some(ref p_id) = current_player_id else {
                    continue;
                };

                let mut updated_state = None;
                {
                    let mut rooms_guard = state.rooms.write().await;
                    if let Some(room) = rooms_guard.get_mut(code) {
                        if room.host_id == *p_id {
                            room.toggle_turn_timer(seconds);
                            updated_state = Some(json!({
                                "type": "room_state",
                                "room": room
                            }));
                        } else {
                            send_direct(
                                &tx,
                                &json!({ "type": "error", "message": "Solo el anfitrión puede cambiar el temporizador" }),
                            );
                        }
                    }
                }

                if let Some(s) = updated_state {
                    broadcast_to_room(&state, code, &s).await;
                }
            }

            ClientMessage::Ping => {
                send_direct(&tx, &json!({ "type": "pong" }));
            }
        }
    }

    // Cleanup on disconnect
    if let Some(ref code) = current_room_code {
        let mut sockets_guard = state.sockets.write().await;
        if let Some(room_map) = sockets_guard.get_mut(code) {
            room_map.remove(&conn_id);
            if room_map.is_empty() {
                sockets_guard.remove(code);
            }
        }
        if let Some(ref pid) = current_player_id {
            let mut rooms_guard = state.rooms.write().await;
            if let Some(room) = rooms_guard.get_mut(code) {
                if let Some(p) = room.players.iter_mut().find(|p| p.id == *pid) {
                    p.is_connected = false;
                }
            }
        }
    }

    writer_task.abort();
}

pub fn start_background_maintenance(state: AppState) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_millis(1000));
        let mut ticks: u64 = 0;
        loop {
            interval.tick().await;
            ticks = ticks.wrapping_add(1);

            let mut timeout_events = Vec::new();
            {
                let mut rooms_guard = state.rooms.write().await;
                for (code, room) in rooms_guard.iter_mut() {
                    if let Some(event) = room.check_turn_timeout() {
                        let next_bot = room.current_player().map(|p| p.is_bot).unwrap_or(false);
                        timeout_events.push((code.clone(), event, json!(room), next_bot));
                    }
                }
            }

            for (code, event, room_json, next_bot) in timeout_events {
                broadcast_to_room(
                    &state,
                    &code,
                    &json!({
                        "type": "turn_played",
                        "event": event,
                        "room": room_json,
                        "was_timeout": true
                    }),
                )
                .await;

                if next_bot {
                    maybe_schedule_bot_turn(state.clone(), code, 1200);
                }
            }

            // Stale cleanup every 60 seconds
            if ticks.is_multiple_of(60) {
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();

                let mut rooms_guard = state.rooms.write().await;
                let mut sockets_guard = state.sockets.write().await;

                // Remove rooms inactive for > 2 hours (7200 seconds)
                let stale_codes: Vec<String> = rooms_guard
                    .iter()
                    .filter(|(_, room)| now.saturating_sub(room.last_activity) > 7200)
                    .map(|(code, _)| code.clone())
                    .collect();

                for code in stale_codes {
                    rooms_guard.remove(&code);
                    sockets_guard.remove(&code);
                }
            }
        }
    });
}
