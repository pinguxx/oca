# ========================================================
# 🦆 Multi-stage Dockerfile for El Juego de la Oca Online
# Optimized for Render.com, Fly.io, Railway & Cloud Run
# ========================================================

# 1. Builder Stage
FROM rust:1-slim-bookworm AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends pkg-config && rm -rf /var/lib/apt/lists/*

# Cache dependencies
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -rf src

# Build actual application
COPY src ./src
RUN touch src/main.rs
RUN cargo build --release

# 2. Runtime Stage
FROM debian:bookworm-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy compiled binary and static assets
COPY --from=builder /app/target/release/oca /app/oca
COPY public /app/public

# Render dynamically passes PORT (defaults to 3000)
ENV PORT=3000
EXPOSE 3000

CMD ["/app/oca"]
