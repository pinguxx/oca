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

        // Tile 0: Start / Nido de Salida (outside tile 1)
        tiles.push(TileInfo {
            number: 0,
            tile_type: TileType::Normal,
            name: "Salida (Nido de Ocas)".to_string(),
            rhyme: None,
            target_tile: None,
            extra_turn: false,
            skip_turns: 0,
            col: 0,
            row: 4,
            x_pct: 6.5,
            y_pct: 58.4,
            angle_deg: 275.0,
        });

        // Nautilus spiral coordinates mapping 1..=63
        let coords = Self::generate_spiral_coordinates();

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

    /// Generates smooth oval nautilus spiral coordinates parameterized by arc length
    pub fn generate_spiral_coordinates() -> Vec<(u8, u8, f32, f32, f32)> {
        const CX: f32 = 500.0;
        const CY: f32 = 445.0;
        const A0: f32 = 430.0;
        const B0: f32 = 360.0;
        const TOTAL_LOOPS: f32 = 3.12;
        const START_ANGLE: f32 = std::f32::consts::PI * 0.96;
        const N: usize = 2000;

        // 1. Generate dense curve points
        let mut samples = Vec::with_capacity(N + 1);
        for s in 0..=N {
            let t = s as f32 / N as f32;
            let theta = START_ANGLE + t * TOTAL_LOOPS * 2.0 * std::f32::consts::PI;
            let a = A0 - t * 310.0;
            let b = B0 - t * 255.0;
            let x = CX + a * theta.cos();
            let y = CY + b * theta.sin();
            samples.push((x, y));
        }

        // 2. Cumulative arc length
        let mut cum_lens = Vec::with_capacity(N + 1);
        cum_lens.push(0.0);
        let mut total_len = 0.0;
        for i in 1..=N {
            let (x0, y0) = samples[i - 1];
            let (x1, y1) = samples[i];
            let seg_len = ((x1 - x0).powi(2) + (y1 - y0).powi(2)).sqrt();
            total_len += seg_len;
            cum_lens.push(total_len);
        }

        // 3. Sample 62 tiles along curve, and tile 63 in center garden
        let mut list = Vec::with_capacity(TOTAL_TILES as usize);
        for i in 1..=62 {
            let target_dist = ((i as f32 - 0.5) / 62.5) * total_len;
            let mut idx = 0;
            while idx < N && cum_lens[idx] < target_dist {
                idx += 1;
            }
            let prev_idx = if idx > 0 { idx - 1 } else { 0 };
            let (x0, y0) = samples[prev_idx];
            let (x1, y1) = samples[idx];
            let d_prev = cum_lens[prev_idx];
            let d_curr = cum_lens[idx];
            let span = (d_curr - d_prev).max(0.001);
            let frac = (target_dist - d_prev) / span;

            let x = x0 + frac * (x1 - x0);
            let y = y0 + frac * (y1 - y0);

            let dx = x1 - x0;
            let dy = y1 - y0;
            let angle_rad = dy.atan2(dx);
            let mut angle_deg = angle_rad.to_degrees();
            if angle_deg < 0.0 {
                angle_deg += 360.0;
            }

            let x_pct = ((x / 1000.0) * 100.0 * 10.0).round() / 10.0;
            let y_pct = ((y / 890.0) * 100.0 * 10.0).round() / 10.0;

            let ring = (i as f32 / 20.0).floor() as u8;
            let quadrant = (((angle_deg + 45.0) / 90.0).floor() as u8) % 4;

            list.push((ring, quadrant, x_pct, y_pct, (angle_deg * 10.0).round() / 10.0));
        }

        // Tile 63: Center Grand Garden
        list.push((3, 0, 50.0, 50.0, 0.0));

        list
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
