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
            row: 8,
            x_pct: 6.5,
            y_pct: 92.8,
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

    /// Generates coordinates for the authentic Montecarlo rectangular circuit board
    /// Concentric loops winding inward to Casilla 63 with zero tile collisions
    pub fn generate_montecarlo_coordinates() -> Vec<(u8, u8, f32, f32, f32)> {
        vec![
            // Ring 1 (Outer perimeter, bottom -> right -> top -> left)
            (1, 8, 17.4, 92.8, 0.0), // 1
            (2, 8, 26.7, 92.8, 0.0), // 2
            (3, 8, 36.0, 92.8, 0.0), // 3
            (4, 8, 45.3, 92.8, 0.0), // 4
            (5, 8, 54.7, 92.8, 0.0), // 5 (Oca)
            (6, 8, 64.0, 92.8, 0.0), // 6 (Puente)
            (7, 8, 73.3, 92.8, 0.0), // 7
            (8, 8, 82.6, 92.8, 0.0), // 8
            (9, 8, 93.5, 92.8, 0.0), // 9 (Oca - BR Corner)
            (9, 7, 93.5, 83.3, 0.0), // 10
            (9, 6, 93.5, 73.8, 0.0), // 11
            (9, 5, 93.5, 64.3, 0.0), // 12 (Puente)
            (9, 4, 93.5, 54.8, 0.0), // 13
            (9, 4, 93.5, 45.2, 0.0), // 14 (Oca)
            (9, 3, 93.5, 35.7, 0.0), // 15
            (9, 2, 93.5, 26.2, 0.0), // 16
            (9, 1, 93.5, 16.7, 0.0), // 17
            (9, 0, 93.5, 7.2, 0.0),  // 18 (Oca - TR Corner)
            (8, 0, 82.6, 7.2, 0.0),  // 19 (Posada)
            (7, 0, 73.3, 7.2, 0.0),  // 20
            (6, 0, 64.0, 7.2, 0.0),  // 21
            (5, 0, 54.7, 7.2, 0.0),  // 22
            (4, 0, 45.3, 7.2, 0.0),  // 23 (Oca)
            (3, 0, 36.0, 7.2, 0.0),  // 24
            (2, 0, 26.7, 7.2, 0.0),  // 25
            (1, 0, 17.4, 7.2, 0.0),  // 26 (Dados)
            (0, 0, 6.5, 7.2, 0.0),   // 27 (Oca - TL Corner)
            (0, 1, 6.5, 16.7, 0.0),  // 28
            (0, 2, 6.5, 26.2, 0.0),  // 29
            (0, 3, 6.5, 35.7, 0.0),  // 30
            (0, 4, 6.5, 45.2, 0.0),  // 31 (Pozo)
            (0, 4, 6.5, 54.8, 0.0),  // 32 (Oca)
            (0, 5, 6.5, 64.3, 0.0),  // 33
            (0, 6, 6.5, 73.8, 0.0),  // 34
            (0, 7, 6.5, 83.3, 0.0),  // 35

            // Ring 2 (Middle loop, bottom -> right -> top -> left)
            (1, 7, 19.5, 79.4, 0.0), // 36 (Oca)
            (2, 7, 29.5, 79.4, 0.0), // 37
            (3, 7, 37.7, 79.4, 0.0), // 38
            (4, 7, 45.9, 79.4, 0.0), // 39
            (5, 7, 54.1, 79.4, 0.0), // 40
            (6, 7, 62.3, 79.4, 0.0), // 41 (Oca)
            (7, 7, 70.5, 79.4, 0.0), // 42 (Laberinto)
            (8, 7, 80.5, 79.4, 0.0), // 43
            (8, 6, 80.5, 68.9, 0.0), // 44
            (8, 5, 80.5, 59.4, 0.0), // 45 (Oca)
            (8, 4, 80.5, 50.0, 0.0), // 46
            (8, 3, 80.5, 40.6, 0.0), // 47
            (8, 2, 80.5, 31.1, 0.0), // 48
            (8, 1, 80.5, 20.6, 0.0), // 49
            (7, 1, 70.5, 20.6, 0.0), // 50 (Oca)
            (6, 1, 62.3, 20.6, 0.0), // 51
            (5, 1, 54.1, 20.6, 0.0), // 52 (Cárcel)
            (4, 1, 45.9, 20.6, 0.0), // 53 (Dados)
            (3, 1, 37.7, 20.6, 0.0), // 54 (Oca)
            (1, 1, 19.5, 20.6, 0.0), // 55
            (1, 3, 19.5, 35.3, 0.0), // 56
            (1, 4, 19.5, 50.0, 0.0), // 57
            (1, 5, 19.5, 64.7, 0.0), // 58 (Muerte)

            // Ring 3 (Inner approach to center court)
            (3, 5, 32.5, 66.1, 0.0), // 59 (Oca)
            (4, 5, 44.0, 66.1, 0.0), // 60
            (5, 5, 55.5, 66.1, 0.0), // 61
            (6, 5, 67.0, 66.1, 0.0), // 62

            // Casilla 63: Gran Jardín de la Oca (Meta)
            (6, 3, 61.0, 43.3, 0.0), // 63
        ]
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
