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
            col: 0,
            row: 7,
            x_pct: 3.8,
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

    /// Generates coordinates for the classic Montecarlo / Fournier rectangular board
    pub fn generate_montecarlo_coordinates() -> Vec<(u8, u8, f32, f32, f32)> {
        const MIN_X: f32 = 72.0;
        const MAX_X: f32 = 928.0;
        const MIN_Y: f32 = 48.0;
        const MAX_Y: f32 = 744.0;

        let to_xpct = |x: f32| ((x / 1000.0) * 100.0 * 10.0).round() / 10.0;
        let to_ypct = |y: f32| ((y / 820.0) * 100.0 * 10.0).round() / 10.0;

        let mut list = Vec::with_capacity(TOTAL_TILES as usize);

        // --- Ring 1 (Outer Perimeter) ---
        // 1..=10: Bottom row (left to right)
        let w1 = (MAX_X - MIN_X) / 10.0;
        for i in 1..=10 {
            let x = MIN_X + (i as f32 - 0.5) * w1;
            let y = MAX_Y;
            list.push((i, 7, to_xpct(x), to_ypct(y), 0.0));
        }

        // 11..=17: Right column (bottom to top)
        let h1 = (MAX_Y - MIN_Y - 168.0) / 7.0;
        for i in 11..=17 {
            let x = MAX_X;
            let y = (MAX_Y - 84.0) - (i as f32 - 10.0 - 0.5) * h1;
            list.push((10, 7 - (i - 10), to_xpct(x), to_ypct(y), 270.0));
        }

        // 18..=28: Top row (right to left)
        let w2 = (MAX_X - MIN_X) / 11.0;
        for i in 18..=28 {
            let x = MAX_X - (i as f32 - 17.0 - 0.5) * w2;
            let y = MIN_Y;
            list.push((11 - (i - 17), 0, to_xpct(x), to_ypct(y), 180.0));
        }

        // 29..=33: Left column (top to bottom)
        let h2 = (MAX_Y - MIN_Y - 168.0) / 5.0;
        for i in 29..=33 {
            let x = MIN_X;
            let y = (MIN_Y + 84.0) + (i as f32 - 28.0 - 0.5) * h2;
            list.push((0, i - 28, to_xpct(x), to_ypct(y), 90.0));
        }

        // --- Ring 2 (Middle Loop) ---
        let min_x2 = MIN_X + 86.0;
        let max_x2 = MAX_X - 86.0;
        let min_y2 = MIN_Y + 86.0;
        let max_y2 = MAX_Y - 86.0;

        // 34..=40: Bottom inner row (left to right)
        let w3 = (max_x2 - min_x2) / 7.0;
        for i in 34..=40 {
            let x = min_x2 + (i as f32 - 33.0 - 0.5) * w3;
            let y = max_y2;
            list.push((i - 33, 6, to_xpct(x), to_ypct(y), 0.0));
        }

        // 41..=46: Right inner column (bottom to top)
        let h3 = (max_y2 - min_y2 - 152.0) / 6.0;
        for i in 41..=46 {
            let x = max_x2;
            let y = (max_y2 - 76.0) - (i as f32 - 40.0 - 0.5) * h3;
            list.push((9, 6 - (i - 40), to_xpct(x), to_ypct(y), 270.0));
        }

        // 47..=51: Top inner row (right to left)
        let w4 = (max_x2 - min_x2 - 78.0) / 5.0;
        for i in 47..=51 {
            let x = (max_x2 - 78.0) - (i as f32 - 46.0 - 0.5) * w4;
            let y = min_y2;
            list.push((8 - (i - 46), 1, to_xpct(x), to_ypct(y), 180.0));
        }

        // 52: Cárcel (Left inner)
        let x52 = min_x2;
        let y52 = min_y2 + 76.0;
        list.push((1, 2, to_xpct(x52), to_ypct(y52), 90.0));

        // --- Ring 3 (Innermost Loop) ---
        let min_x3 = min_x2 + 80.0;
        let max_x3 = max_x2 - 78.0;
        let max_y3 = max_y2 - 76.0;

        // 53..=62: Bottom innermost row (left to right)
        let w5 = (max_x3 - min_x3) / 10.0;
        for i in 53..=62 {
            let x = min_x3 + (i as f32 - 52.0 - 0.5) * w5;
            let y = max_y3;
            list.push((i - 52, 5, to_xpct(x), to_ypct(y), 0.0));
        }

        // 63: Gran Oca / Meta
        list.push((7, 3, 67.0, 44.0, 0.0));

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
