use serde::{Deserialize, Serialize};

pub const TOTAL_TILES: u8 = 63;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TileType {
    Normal,
    Oca,
    Puente,
    Posada,
    Dados,
    Pozo,
    Laberinto,
    Carcel,
    Muerte,
    Meta,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TileInfo {
    pub number: u8,
    pub tile_type: TileType,
    pub name: String,
    pub rhyme: Option<String>,
    pub target_tile: Option<u8>,
    pub extra_turn: bool,
    pub skip_turns: u8,
    pub col: u8,
    pub row: u8,
    pub x_pct: f32,
    pub y_pct: f32,
    #[serde(default)]
    pub angle_deg: f32,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoardPosition {
    pub tile: u8,
    pub col: u8,
    pub row: u8,
    pub x_pct: f32,
    pub y_pct: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoardDefinition {
    pub total_tiles: u8,
    pub tiles: Vec<TileInfo>,
}

impl BoardDefinition {
    pub fn classic() -> Self {
        let mut tiles = Vec::with_capacity((TOTAL_TILES + 1) as usize);

        // Tile 0: Salida
        tiles.push(TileInfo {
            number: 0,
            tile_type: TileType::Normal,
            name: "Salida".to_string(),
            rhyme: None,
            target_tile: None,
            extra_turn: false,
            skip_turns: 0,
            col: 3,
            row: 8,
            x_pct: 31.0,
            y_pct: 91.5,
            angle_deg: 0.0,
        });

        // Coordinates mapping for authentic Montecarlo rectangular spiral
        let coords = Self::generate_montecarlo_coordinates();

        for num in 1..=TOTAL_TILES {
            let (col, row, x_pct, y_pct, angle_deg) = coords[(num - 1) as usize];
            let (tile_type, name, rhyme, target, extra, skip) = Self::tile_rule(num);

            tiles.push(TileInfo {
                number: num,
                tile_type,
                name,
                rhyme,
                target_tile: target,
                extra_turn: extra,
                skip_turns: skip,
                col,
                row,
                x_pct,
                y_pct,
                angle_deg,
            });
        }

        Self {
            total_tiles: TOTAL_TILES,
            tiles,
        }
    }

    /// Generates coordinates for the authentic continuous circular / oval spiral board
    pub fn generate_montecarlo_coordinates() -> Vec<(u8, u8, f32, f32, f32)> {
        const CX: f32 = 500.0;
        const CY: f32 = 460.0;
        const THETA_START: f32 = 105.0 * std::f32::consts::PI / 180.0;
        const TOTAL_ROT: f32 = 2.85 * 2.0 * std::f32::consts::PI;
        const R_START: f32 = 420.0;
        const R_END: f32 = 120.0;
        const N_SAMPLES: usize = 2000;

        let to_xpct = |x: f32| ((x / 1000.0) * 100.0 * 10.0).round() / 10.0;
        let to_ypct = |y: f32| ((y / 920.0) * 100.0 * 10.0).round() / 10.0;

        let mut samples = Vec::with_capacity(N_SAMPLES + 1);
        let mut total_length = 0.0f32;

        for s in 0..=N_SAMPLES {
            let u = s as f32 / N_SAMPLES as f32;
            let theta = THETA_START + u * TOTAL_ROT;
            let rx = R_START + (R_END - R_START) * u;
            let ry = rx * (380.0 / 420.0);
            let x = CX + rx * theta.cos();
            let y = CY + ry * theta.sin();

            if s > 0 {
                let (px, py, _): (f32, f32, f32) = samples[s - 1];
                let d = ((x - px).powi(2) + (y - py).powi(2)).sqrt();
                total_length += d;
            }
            samples.push((x, y, total_length));
        }

        let mut list = Vec::with_capacity(TOTAL_TILES as usize);
        let step_dist = total_length / 62.0;

        for i in 1..=62 {
            let target_dist = (i - 1) as f32 * step_dist;
            let mut best = samples[0];
            for sample in &samples {
                if sample.2 >= target_dist {
                    best = *sample;
                    break;
                }
            }
            let col = (best.0 / 100.0) as u8;
            let row = (best.1 / 100.0) as u8;
            list.push((col, row, to_xpct(best.0), to_ypct(best.1), 0.0));
        }

        // Casilla 63: Center of the spiral
        list.push((5, 5, to_xpct(CX), to_ypct(CY), 0.0));

        list
    }

    /// Returns rules for a tile: (TileType, Name, Rhyme, TargetTile, ExtraTurn, SkipTurns)
    pub fn tile_rule(num: u8) -> (TileType, String, Option<String>, Option<u8>, bool, u8) {
        match num {
            // Ocas (5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59)
            5 => (
                TileType::Oca,
                "Oca".to_string(),
                Some("¡De oca a oca y tiro porque me toca!".to_string()),
                Some(9),
                true,
                0,
            ),
            9 => (
                TileType::Oca,
                "Oca".to_string(),
                Some("¡De oca a oca y tiro porque me toca!".to_string()),
                Some(14),
                true,
                0,
            ),
            14 => (
                TileType::Oca,
                "Oca".to_string(),
                Some("¡De oca a oca y tiro porque me toca!".to_string()),
                Some(18),
                true,
                0,
            ),
            18 => (
                TileType::Oca,
                "Oca".to_string(),
                Some("¡De oca a oca y tiro porque me toca!".to_string()),
                Some(23),
                true,
                0,
            ),
            23 => (
                TileType::Oca,
                "Oca".to_string(),
                Some("¡De oca a oca y tiro porque me toca!".to_string()),
                Some(27),
                true,
                0,
            ),
            27 => (
                TileType::Oca,
                "Oca".to_string(),
                Some("¡De oca a oca y tiro porque me toca!".to_string()),
                Some(32),
                true,
                0,
            ),
            32 => (
                TileType::Oca,
                "Oca".to_string(),
                Some("¡De oca a oca y tiro porque me toca!".to_string()),
                Some(36),
                true,
                0,
            ),
            36 => (
                TileType::Oca,
                "Oca".to_string(),
                Some("¡De oca a oca y tiro porque me toca!".to_string()),
                Some(41),
                true,
                0,
            ),
            41 => (
                TileType::Oca,
                "Oca".to_string(),
                Some("¡De oca a oca y tiro porque me toca!".to_string()),
                Some(45),
                true,
                0,
            ),
            45 => (
                TileType::Oca,
                "Oca".to_string(),
                Some("¡De oca a oca y tiro porque me toca!".to_string()),
                Some(50),
                true,
                0,
            ),
            50 => (
                TileType::Oca,
                "Oca".to_string(),
                Some("¡De oca a oca y tiro porque me toca!".to_string()),
                Some(54),
                true,
                0,
            ),
            54 => (
                TileType::Oca,
                "Oca".to_string(),
                Some("¡De oca a oca y tiro porque me toca!".to_string()),
                Some(59),
                true,
                0,
            ),
            59 => (
                TileType::Oca,
                "Oca".to_string(),
                Some("¡De oca a oca y tiro porque me toca!".to_string()),
                Some(63),
                true,
                0,
            ),

            // Puentes
            6 => (
                TileType::Puente,
                "Puente".to_string(),
                Some("¡De puente a puente y tiro porque me lleva la corriente!".to_string()),
                Some(12),
                true,
                0,
            ),
            12 => (
                TileType::Puente,
                "Puente".to_string(),
                Some("¡De puente a puente y tiro porque me lleva la corriente!".to_string()),
                Some(6),
                true,
                0,
            ),

            // Posada
            19 => (
                TileType::Posada,
                "La Posada".to_string(),
                Some("¡Has llegado a la Posada! Descansas 1 turno.".to_string()),
                None,
                false,
                1,
            ),

            // Dados
            26 => (
                TileType::Dados,
                "Los Dados".to_string(),
                Some("¡De dados a dados y tiro porque me ha tocado!".to_string()),
                Some(53),
                true,
                0,
            ),
            53 => (
                TileType::Dados,
                "Los Dados".to_string(),
                Some("¡De dados a dados y tiro porque me ha tocado!".to_string()),
                Some(26),
                true,
                0,
            ),

            // Pozo
            31 => (
                TileType::Pozo,
                "El Pozo".to_string(),
                Some("¡Caíste en el Pozo! Atrapado hasta ser rescatado o por 3 turnos.".to_string()),
                None,
                false,
                3,
            ),

            // Laberinto
            42 => (
                TileType::Laberinto,
                "El Laberinto".to_string(),
                Some("¡Del laberinto al 30! Te desorientas y retrocedes a la casilla 30.".to_string()),
                Some(30),
                false,
                0,
            ),

            // Cárcel
            52 => (
                TileType::Carcel,
                "La Cárcel".to_string(),
                Some("¡A la Cárcel! Pierdes 2 turnos detenido.".to_string()),
                None,
                false,
                2,
            ),

            // Muerte
            58 => (
                TileType::Muerte,
                "La Muerte".to_string(),
                Some("¡La Muerte! Vuelves al inicio: casilla 1.".to_string()),
                Some(1),
                false,
                0,
            ),

            // Meta
            63 => (
                TileType::Meta,
                "Gran Jardín de la Oca".to_string(),
                Some("¡Llegaste al Jardín de la Oca! ¡VICTORIA!".to_string()),
                None,
                false,
                0,
            ),

            // Casillas normales ilustradas
            _ => (TileType::Normal, format!("Casilla {}", num), None, None, false, 0),
        }
    }

    #[allow(dead_code)]
    pub fn get_tile(&self, number: u8) -> Option<&TileInfo> {
        self.tiles.iter().find(|t| t.number == number)
    }
}
