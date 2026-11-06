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

        // Tile 0: Start / Nido de Salida
        tiles.push(TileInfo {
            number: 0,
            tile_type: TileType::Normal,
            name: "Salida (Nido de Ocas)".to_string(),
            rhyme: None,
            target_tile: None,
            extra_turn: false,
            skip_turns: 0,
            col: 0,
            row: 7,
            x_pct: 3.5,
            y_pct: 94.0,
        });

        // Spiral grid coordinates mapping 1..=63 in a 9x8 grid
        let coords = Self::generate_spiral_coordinates();

        for num in 1..=TOTAL_TILES {
            let (col, row, x_pct, y_pct) = coords[(num - 1) as usize];
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
            });
        }

        Self {
            total_tiles: TOTAL_TILES,
            tiles,
        }
    }

    /// Generates spiral grid coordinates (col 0..8, row 0..7) for tiles 1 to 63
    pub fn generate_spiral_coordinates() -> Vec<(u8, u8, f32, f32)> {
        let mut list = Vec::with_capacity(TOTAL_TILES as usize);

        // 9 columns (0..8) and 8 rows (0..7)
        // Ring 1 (outer): 30 tiles
        // Row 7 (bottom): (0,7) -> (8,7) [9 tiles, 1..=9]
        for c in 0..=8 {
            list.push((c, 7));
        }
        // Col 8 (right): (8,6) down to (8,0) [7 tiles, 10..=16]
        for r in (0..=6).rev() {
            list.push((8, r));
        }
        // Row 0 (top): (7,0) down to (0,0) [8 tiles, 17..=24]
        for c in (0..=7).rev() {
            list.push((c, 0));
        }
        // Col 0 (left): (0,1) to (0,6) [6 tiles, 25..=30]
        for r in 1..=6 {
            list.push((0, r));
        }

        // Ring 2: 22 tiles
        // Row 6: (1,6) to (7,6) [7 tiles, 31..=37]
        for c in 1..=7 {
            list.push((c, 6));
        }
        // Col 7: (7,5) down to (7,1) [5 tiles, 38..=42]
        for r in (1..=5).rev() {
            list.push((7, r));
        }
        // Row 1: (6,1) down to (1,1) [6 tiles, 43..=48]
        for c in (1..=6).rev() {
            list.push((c, 1));
        }
        // Col 1: (1,2) to (1,5) [4 tiles, 49..=52]
        for r in 2..=5 {
            list.push((1, r));
        }

        // Ring 3: 10 tiles
        // Row 5: (2,5) to (6,5) [5 tiles, 53..=57]
        for c in 2..=6 {
            list.push((c, 5));
        }
        // Col 6: (6,4) down to (6,2) [3 tiles, 58..=60]
        for r in (2..=4).rev() {
            list.push((6, r));
        }
        // Row 2: (5,2) down to (4,2) [2 tiles, 61..=62]
        list.push((5, 2));
        list.push((4, 2));

        // Tile 63: Center Garden (La Gran Oca)
        // Positioned centrally in cells (3,3)-(4,4)
        list.push((3, 3));

        // Convert (col, row) to percentage (0.0 to 100.0%)
        list.into_iter()
            .enumerate()
            .map(|(idx, (col, row))| {
                if idx + 1 == 63 {
                    // Center garden gets custom prominent center alignment
                    (col, row, 44.4, 43.8)
                } else {
                    let x_pct = ((col as f32 + 0.5) / 9.0) * 100.0;
                    let y_pct = ((row as f32 + 0.5) / 8.0) * 100.0;
                    (col, row, (x_pct * 10.0).round() / 10.0, (y_pct * 10.0).round() / 10.0)
                }
            })
            .collect()
    }

    /// Returns rules for a tile: (TileType, Name, Rhyme, TargetTile, ExtraTurn, SkipTurns)
    pub fn tile_rule(num: u8) -> (TileType, String, Option<String>, Option<u8>, bool, u8) {
        match num {
            // Ocas
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
                Some(63), // Jumps to winning garden!
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

            // Casillas normales
            _ => (TileType::Normal, format!("Casilla {}", num), None, None, false, 0),
        }
    }

    #[allow(dead_code)]
    pub fn get_tile(&self, number: u8) -> Option<&TileInfo> {
        self.tiles.iter().find(|t| t.number == number)
    }
}
