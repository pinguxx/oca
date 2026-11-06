use rand::RngExt;
use serde::{Deserialize, Serialize};

use crate::board::{BoardDefinition, TileType, TOTAL_TILES};

pub const DEFAULT_COLORS: [&str; 8] = [
    "#E63946", // Rojo Caramelo
    "#1A1A1A", // Negro Azabache
    "#457B9D", // Azul Talavera
    "#2A9D8F", // Verde Jade
    "#E76F51", // Naranja Barro
    "#9B5DE5", // Morado Bugambilia
    "#F15BB5", // Rosa Mexicano
    "#E09F3E", // Dorado Oaxaqueño
];

pub const DEFAULT_AVATARS: [&str; 8] = ["🪿", "🦆", "🎩", "👑", "🌵", "🌮", "🎸", "🌶️"];

pub const BOT_NAMES: [&str; 8] = [
    "Don Ganso",
    "Oca Veloz",
    "Gansito",
    "Doña Plumas",
    "El Mariachi",
    "La Calaca",
    "Pato Lucas",
    "Oca Sabia",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GameStatus {
    Waiting,
    Playing,
    Finished,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Player {
    pub id: String,
    pub name: String,
    pub color: String,
    pub avatar: String,
    pub position: u8,
    pub is_bot: bool,
    pub turns_to_wait: u8,
    pub in_well: bool,
    pub rolls_count: u32,
    pub is_connected: bool,
}

impl Player {
    pub fn new(id: String, name: String, color: String, avatar: String, is_bot: bool) -> Self {
        Self {
            id,
            name,
            color,
            avatar,
            position: 0,
            is_bot,
            turns_to_wait: 0,
            in_well: false,
            rolls_count: 0,
            is_connected: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomSettings {
    pub two_dice: bool,
    pub exact_bounce: bool,
    pub well_rescue: bool,
}

impl Default for RoomSettings {
    fn default() -> Self {
        Self {
            two_dice: true,
            exact_bounce: true,
            well_rescue: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TurnEvent {
    pub player_id: String,
    pub player_name: String,
    pub dice: [u8; 2],
    pub total: u8,
    pub from_pos: u8,
    pub intermediate_pos: u8,
    pub final_pos: u8,
    pub tile_type: TileType,
    pub message: String,
    pub rhyme: Option<String>,
    pub extra_turn: bool,
    pub path: Vec<u8>,
    pub is_win: bool,
    pub rescued_player: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub sender_id: String,
    pub sender_name: String,
    pub text: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameRoom {
    pub code: String,
    pub host_id: String,
    pub status: GameStatus,
    pub players: Vec<Player>,
    pub current_turn: usize,
    pub dice: [u8; 2],
    pub last_event: Option<TurnEvent>,
    pub history: Vec<TurnEvent>,
    pub chat: Vec<ChatMessage>,
    pub winner_id: Option<String>,
    pub winner_name: Option<String>,
    pub settings: RoomSettings,
    pub created_at: u64,
    pub last_activity: u64,
}

impl GameRoom {
    pub fn new(code: String, host_id: String, host_name: String, color: Option<String>, avatar: Option<String>, two_dice: bool) -> Self {
        let chosen_color = color.unwrap_or_else(|| DEFAULT_COLORS[0].to_string());
        let chosen_avatar = avatar.unwrap_or_else(|| DEFAULT_AVATARS[0].to_string());

        let host = Player::new(host_id.clone(), host_name, chosen_color, chosen_avatar, false);
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let mut settings = RoomSettings::default();
        settings.two_dice = two_dice;

        Self {
            code,
            host_id,
            status: GameStatus::Waiting,
            players: vec![host],
            current_turn: 0,
            dice: [1, 1],
            last_event: None,
            history: Vec::new(),
            chat: Vec::new(),
            winner_id: None,
            winner_name: None,
            settings,
            created_at: now,
            last_activity: now,
        }
    }

    pub fn add_player(&mut self, id: String, name: String, color: Option<String>, avatar: Option<String>, is_bot: bool) -> Result<(), &'static str> {
        if self.players.len() >= 8 {
            return Err("La sala está llena (máximo 8 jugadores)");
        }
        if self.status != GameStatus::Waiting {
            return Err("La partida ya ha comenzado");
        }

        let idx = self.players.len();
        let chosen_color = color.unwrap_or_else(|| DEFAULT_COLORS[idx % DEFAULT_COLORS.len()].to_string());
        let chosen_avatar = avatar.unwrap_or_else(|| DEFAULT_AVATARS[idx % DEFAULT_AVATARS.len()].to_string());

        self.players.push(Player::new(id, name, chosen_color, chosen_avatar, is_bot));
        self.touch();
        Ok(())
    }

    pub fn add_bot(&mut self) -> Result<String, &'static str> {
        if self.players.len() >= 8 {
            return Err("La sala está llena (máximo 8 jugadores)");
        }
        let count = self.players.iter().filter(|p| p.is_bot).count();
        let bot_name = BOT_NAMES[count % BOT_NAMES.len()].to_string();
        let bot_id = format!("bot_{}", rand::rng().random_range(1000..9999));
        let color = DEFAULT_COLORS[self.players.len() % DEFAULT_COLORS.len()].to_string();
        let avatar = DEFAULT_AVATARS[self.players.len() % DEFAULT_AVATARS.len()].to_string();

        self.add_player(bot_id.clone(), bot_name, Some(color), Some(avatar), true)?;
        Ok(bot_id)
    }

    pub fn remove_player(&mut self, player_id: &str) -> bool {
        if let Some(pos) = self.players.iter().position(|p| p.id == player_id) {
            self.players.remove(pos);
            if self.players.is_empty() {
                return true;
            }
            if self.host_id == player_id {
                // Promote first human or first player to host
                let new_host = self.players.iter().find(|p| !p.is_bot).unwrap_or(&self.players[0]);
                self.host_id = new_host.id.clone();
            }
            if self.current_turn >= self.players.len() {
                self.current_turn = 0;
            }
            self.touch();
        }
        false
    }

    pub fn start_game(&mut self, requester_id: &str) -> Result<(), &'static str> {
        if self.host_id != requester_id {
            return Err("Solo el anfitrión puede iniciar la partida");
        }
        if self.players.len() < 2 {
            return Err("Se necesitan al menos 2 jugadores para jugar (puedes agregar bots)");
        }
        self.status = GameStatus::Playing;
        self.current_turn = 0;
        self.winner_id = None;
        self.winner_name = None;
        self.history.clear();
        for p in &mut self.players {
            p.position = 0;
            p.turns_to_wait = 0;
            p.in_well = false;
            p.rolls_count = 0;
        }
        self.touch();
        Ok(())
    }

    pub fn restart_game(&mut self, requester_id: &str) -> Result<(), &'static str> {
        if self.host_id != requester_id {
            return Err("Solo el anfitrión puede reiniciar la partida");
        }
        self.start_game(requester_id)
    }

    pub fn current_player(&self) -> Option<&Player> {
        self.players.get(self.current_turn)
    }

    pub fn current_player_mut(&mut self) -> Option<&mut Player> {
        self.players.get_mut(self.current_turn)
    }

    pub fn touch(&mut self) {
        self.last_activity = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
    }

    /// Roll dice and process full turn logic
    pub fn roll_dice(&mut self, player_id: &str) -> Result<TurnEvent, &'static str> {
        if self.status != GameStatus::Playing {
            return Err("La partida no está en curso");
        }

        let curr_idx = self.current_turn;
        let player = match self.players.get(curr_idx) {
            Some(p) if p.id == player_id => p,
            _ => return Err("No es tu turno"),
        };

        // If player is trapped / waiting turns
        if player.turns_to_wait > 0 {
            let p_mut = self.players.get_mut(curr_idx).unwrap();
            p_mut.turns_to_wait -= 1;
            let turns_left = p_mut.turns_to_wait;
            let p_name = p_mut.name.clone();
            let pos = p_mut.position;

            let reason = if p_mut.in_well {
                if turns_left == 0 {
                    p_mut.in_well = false;
                    format!("{} cumple su castigo en el Pozo y queda libre para el próximo turno.", p_name)
                } else {
                    format!("{} sigue atrapado en el Pozo. Le quedan {} turno(s).", p_name, turns_left)
                }
            } else if pos == 19 {
                format!("{} descansó en la Posada. ¡Listo para el próximo turno!", p_name)
            } else if pos == 52 {
                if turns_left == 0 {
                    format!("{} cumplió su condena en la Cárcel y queda libre.", p_name)
                } else {
                    format!("{} sigue preso en la Cárcel. Le quedan {} turno(s).", p_name, turns_left)
                }
            } else {
                format!("{} pierde este turno.", p_name)
            };

            // Advance turn to next player
            self.advance_turn();
            self.touch();

            return Ok(TurnEvent {
                player_id: player_id.to_string(),
                player_name: p_name,
                dice: [0, 0],
                total: 0,
                from_pos: pos,
                intermediate_pos: pos,
                final_pos: pos,
                tile_type: TileType::Normal,
                message: reason,
                rhyme: None,
                extra_turn: false,
                path: vec![pos],
                is_win: false,
                rescued_player: None,
            });
        }

        // Generate dice roll
        let mut rng = rand::rng();
        let (d1, d2) = if self.settings.two_dice {
            (rng.random_range(1..=6), rng.random_range(1..=6))
        } else {
            (rng.random_range(1..=6), 0)
        };
        let total = d1 + d2;
        self.dice = [d1, d2];

        let p_mut = self.players.get_mut(curr_idx).unwrap();
        p_mut.rolls_count += 1;
        let start_pos = p_mut.position;
        let p_name = p_mut.name.clone();

        // Check traditional 9 rule on initial turn
        let mut path = Vec::new();
        let intermediate_pos;
        let mut final_pos;
        let mut special_type = TileType::Normal;
        let mut rhyme = None;
        let mut message;
        let mut extra_turn = false;
        let mut is_win = false;
        let mut rescued_player = None;

        if start_pos == 0 && total == 9 && self.settings.two_dice {
            if (d1 == 5 && d2 == 4) || (d1 == 4 && d2 == 5) {
                // Rule 5+4 on start: jump to 53 (Dados)
                intermediate_pos = 53;
                final_pos = 53;
                special_type = TileType::Dados;
                extra_turn = true;
                rhyme = Some("¡Tiro inicial de 5+4! ¡Directo a los Dados (53) y repite turno!".to_string());
                message = format!("¡Tirada inicial de 9 (5 y 4)! {} vuela directo a la casilla 53 y vuelve a tirar.", p_name);
                path.push(0);
                path.push(53);
            } else if (d1 == 6 && d2 == 3) || (d1 == 3 && d2 == 6) {
                // Rule 6+3 on start: jump to 26 (Dados)
                intermediate_pos = 26;
                final_pos = 26;
                special_type = TileType::Dados;
                extra_turn = true;
                rhyme = Some("¡Tiro inicial de 6+3! ¡Directo a los Dados (26) y repite turno!".to_string());
                message = format!("¡Tirada inicial de 9 (6 y 3)! {} vuela directo a la casilla 26 y vuelve a tirar.", p_name);
                path.push(0);
                path.push(26);
            } else {
                // Should not happen for 9 with 2d6, but fallback to regular advance
                let raw_target = start_pos + total;
                intermediate_pos = raw_target;
                final_pos = raw_target;
                message = format!("{} avanza {} casillas.", p_name, total);
                for step in (start_pos + 1)..=raw_target {
                    path.push(step);
                }
            }
        } else {
            // Standard step calculation with bounce-back
            let raw_target = start_pos + total;
            if raw_target > TOTAL_TILES {
                // Overshot 63! Bounce backwards
                let overshoot = raw_target - TOTAL_TILES;
                intermediate_pos = TOTAL_TILES - overshoot;

                // Path forwards to 63, then backwards to intermediate_pos
                for step in (start_pos + 1)..=TOTAL_TILES {
                    path.push(step);
                }
                for step in (intermediate_pos..TOTAL_TILES).rev() {
                    path.push(step);
                }

                message = format!(
                    "{} tiró {} pero se pasó por {}. ¡Rebota hacia atrás hasta la casilla {}!",
                    p_name, total, overshoot, intermediate_pos
                );
            } else if raw_target == TOTAL_TILES {
                // Direct landing on 63: WINNER!
                intermediate_pos = TOTAL_TILES;
                special_type = TileType::Meta;
                is_win = true;
                for step in (start_pos + 1)..=TOTAL_TILES {
                    path.push(step);
                }
                message = format!("🎉 ¡{} ha llegado a la Gran Oca con la tirada exacta y GANA LA PARTIDA! 🎉", p_name);
            } else {
                intermediate_pos = raw_target;
                for step in (start_pos + 1)..=raw_target {
                    path.push(step);
                }
                message = format!("{} avanza {} casillas hasta la {}.", p_name, total, intermediate_pos);
            }

            final_pos = intermediate_pos;
        }

        // If not already won, evaluate special tile rules at intermediate position
        if !is_win {
            let (t_type, _, t_rhyme, target_tile, _t_extra, skip_turns) = BoardDefinition::tile_rule(intermediate_pos);
            special_type = t_type;

            match t_type {
                TileType::Oca => {
                    let next_oca = target_tile.unwrap_or(63);
                    final_pos = next_oca;
                    extra_turn = true;
                    rhyme = t_rhyme;
                    path.push(next_oca);
                    if next_oca == TOTAL_TILES {
                        is_win = true;
                        message = format!("🦆 ¡De oca a oca y tiro porque me toca! {} salta a la Gran Oca (63) y ¡GANA LA PARTIDA!", p_name);
                    } else {
                        message = format!("🦆 ¡De oca a oca y tiro porque me toca! {} salta a la casilla {} y vuelve a tirar.", p_name, next_oca);
                    }
                }
                TileType::Puente => {
                    let dest = target_tile.unwrap_or(intermediate_pos);
                    final_pos = dest;
                    extra_turn = true;
                    rhyme = t_rhyme;
                    path.push(dest);
                    message = format!("🌉 ¡De puente a puente y tiro porque me lleva la corriente! {} salta a la casilla {} y vuelve a tirar.", p_name, dest);
                }
                TileType::Dados => {
                    let dest = target_tile.unwrap_or(intermediate_pos);
                    final_pos = dest;
                    extra_turn = true;
                    rhyme = t_rhyme;
                    path.push(dest);
                    message = format!("🎲 ¡De dados a dados y tiro porque me ha tocado! {} salta a la casilla {} y vuelve a tirar.", p_name, dest);
                }
                TileType::Posada => {
                    let p = self.players.get_mut(curr_idx).unwrap();
                    p.turns_to_wait = skip_turns;
                    rhyme = t_rhyme;
                    message = format!("🏨 ¡{} llega a la Posada a descansar y pierde 1 turno!", p_name);
                }
                TileType::Pozo => {
                    // Check if another player was already trapped in the well (31)
                    if self.settings.well_rescue {
                        for other in &mut self.players {
                            if other.id != player_id && other.in_well && other.position == 31 {
                                other.in_well = false;
                                other.turns_to_wait = 0;
                                rescued_player = Some(other.name.clone());
                                break;
                            }
                        }
                    }

                    let p = self.players.get_mut(curr_idx).unwrap();
                    p.in_well = true;
                    p.turns_to_wait = skip_turns;
                    rhyme = t_rhyme;

                    if let Some(ref rescued) = rescued_player {
                        message = format!("🕳️ ¡{} cae al Pozo y rescata a {}! Ahora {} queda atrapado.", p_name, rescued, p_name);
                    } else {
                        message = format!("🕳️ ¡{} cae al Pozo! Queda atrapado hasta ser rescatado o por 3 turnos.", p_name);
                    }
                }
                TileType::Laberinto => {
                    let dest = target_tile.unwrap_or(30);
                    final_pos = dest;
                    rhyme = t_rhyme;
                    path.push(dest);
                    message = format!("🌀 ¡Del laberinto al 30! {} se desorienta y retrocede a la casilla 30.", p_name);
                }
                TileType::Carcel => {
                    let p = self.players.get_mut(curr_idx).unwrap();
                    p.turns_to_wait = skip_turns;
                    rhyme = t_rhyme;
                    message = format!("⛓️ ¡A la Cárcel! {} queda detenido y pierde 2 turnos.", p_name);
                }
                TileType::Muerte => {
                    final_pos = 1;
                    rhyme = t_rhyme;
                    path.push(1);
                    message = format!("💀 ¡LA MUERTE! {} debe volver al inicio: casilla 1.", p_name);
                }
                TileType::Meta => {
                    is_win = true;
                    message = format!("🏆 ¡{} alcanza el Gran Jardín de la Oca y se corona CAMPEÓN!", p_name);
                }
                TileType::Normal => {}
            }
        }

        // Apply final position to player
        {
            let p = self.players.get_mut(curr_idx).unwrap();
            p.position = final_pos;
        }

        // If win, update room status
        if is_win {
            self.status = GameStatus::Finished;
            self.winner_id = Some(player_id.to_string());
            self.winner_name = Some(p_name.clone());
        } else if !extra_turn {
            self.advance_turn();
        }

        let event = TurnEvent {
            player_id: player_id.to_string(),
            player_name: p_name,
            dice: [d1, d2],
            total,
            from_pos: start_pos,
            intermediate_pos,
            final_pos,
            tile_type: special_type,
            message,
            rhyme,
            extra_turn,
            path,
            is_win,
            rescued_player,
        };

        self.last_event = Some(event.clone());
        self.history.push(event.clone());
        self.touch();

        Ok(event)
    }

    pub fn advance_turn(&mut self) {
        if self.players.is_empty() {
            return;
        }
        self.current_turn = (self.current_turn + 1) % self.players.len();
    }

    pub fn add_chat(&mut self, sender_id: String, text: String) -> Option<ChatMessage> {
        let name = self.players.iter().find(|p| p.id == sender_id).map(|p| p.name.clone())?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let msg = ChatMessage {
            sender_id,
            sender_name: name,
            text,
            timestamp: now,
        };

        if self.chat.len() >= 50 {
            self.chat.remove(0);
        }
        self.chat.push(msg.clone());
        self.touch();
        Some(msg)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_initial_start_rules_9() {
        let mut room = GameRoom::new("TEST".to_string(), "p1".to_string(), "Host".to_string(), None, None, true);
        room.add_player("p2".to_string(), "Guest".to_string(), None, None, false).unwrap();
        room.start_game("p1").unwrap();

        assert_eq!(room.status, GameStatus::Playing);
        assert_eq!(room.players[0].position, 0);
    }

    #[test]
    fn test_oca_chain_and_win() {
        let (t_type, _, _, target, extra, _) = BoardDefinition::tile_rule(59);
        assert_eq!(t_type, TileType::Oca);
        assert_eq!(target, Some(63));
        assert!(extra);
    }

    #[test]
    fn test_labyrinth_and_death() {
        let (t_lab, _, _, target_lab, _, _) = BoardDefinition::tile_rule(42);
        assert_eq!(t_lab, TileType::Laberinto);
        assert_eq!(target_lab, Some(30));

        let (t_death, _, _, target_death, _, _) = BoardDefinition::tile_rule(58);
        assert_eq!(t_death, TileType::Muerte);
        assert_eq!(target_death, Some(1));
    }
}
