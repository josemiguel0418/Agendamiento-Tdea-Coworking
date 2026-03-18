const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const session = require("express-session");
const SqliteStore = require("connect-sqlite3")(session);
const XLSX = require("xlsx");
const path = require("path");

const app = express();

// En Railway el filesystem vive en /app, usamos una carpeta /data para persistencia
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "database.db");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  store: new SqliteStore({ db: "sessions.db", dir: path.dirname(DB_PATH) }),
  secret: process.env.SESSION_SECRET || "tdea_coworking_2024",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 8 * 60 * 60 * 1000, // 8 horas
    httpOnly: true,
    secure: false  // Railway usa HTTPS pero termina el SSL en el proxy, dejarlo en false
  }
}));
app.use(express.static(__dirname));

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT,
    documento TEXT UNIQUE,
    email TEXT,
    password TEXT,
    rol TEXT DEFAULT 'usuario'
  )`);

  db.run(`ALTER TABLE usuarios ADD COLUMN email TEXT`, () => {});

  db.run(`CREATE TABLE IF NOT EXISTS reservas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT,
    documento TEXT,
    espacio INTEGER,
    fecha TEXT,
    hora_inicio TEXT,
    hora_fin TEXT
  )`);
});

app.post("/registro", async (req, res) => {
  const { nombre, email, documento, password } = req.body;
  if (!nombre || !documento || !password) return res.json({ mensaje: "Faltan datos" });
  const hash = await bcrypt.hash(password, 10);
  db.run("INSERT INTO usuarios(nombre,email,documento,password,rol) VALUES(?,?,?,?,'usuario')",
    [nombre, email || null, documento, hash],
    (err) => {
      if (err) res.json({ mensaje: "El documento ya está registrado" });
      else res.json({ mensaje: "Cuenta creada correctamente" });
    }
  );
});

app.post("/login", (req, res) => {
  const { documento, password } = req.body;
  if (!documento || !password) return res.json({ mensaje: "Faltan datos" });
  db.get("SELECT * FROM usuarios WHERE documento=?", [documento], async (err, user) => {
    if (err || !user) return res.json({ mensaje: "Documento o contraseña incorrectos" });
    const valido = await bcrypt.compare(password, user.password);
    if (!valido) return res.json({ mensaje: "Documento o contraseña incorrectos" });
    req.session.usuario = { id: user.id, nombre: user.nombre, documento: user.documento, rol: user.rol };
    req.session.save((err) => {
      if (err) return res.json({ mensaje: "Error al guardar sesión" });
      res.json({ mensaje: "ok", nombre: user.nombre, rol: user.rol });
    });
  });
});

app.post("/logout", (req, res) => {
  req.session.destroy();
  res.json({ mensaje: "Sesión cerrada" });
});

app.get("/sesion", (req, res) => {
  if (req.session.usuario) res.json({ activa: true, usuario: req.session.usuario });
  else res.json({ activa: false });
});

app.post("/reservar", (req, res) => {
  if (!req.session.usuario) return res.json({ mensaje: "Debes iniciar sesión" });
  const { espacio, fecha, hora_inicio } = req.body;
  const { nombre, documento } = req.session.usuario;
  if (!fecha || !hora_inicio) return res.json({ mensaje: "Faltan datos" });
  let inicio = new Date(`2000-01-01T${hora_inicio}:00`);
  let fin = new Date(inicio.getTime() + 90 * 60000);
  let hora_fin = fin.toTimeString().slice(0, 5);
  db.run("INSERT INTO reservas(usuario,documento,espacio,fecha,hora_inicio,hora_fin) VALUES(?,?,?,?,?,?)",
    [nombre, documento, espacio, fecha, hora_inicio, hora_fin],
    (err) => {
      if (err) res.json({ mensaje: "Error al reservar" });
      else res.json({ mensaje: `Reserva hecha hasta ${hora_fin}` });
    }
  );
});

app.get("/reservas/:fecha", (req, res) => {
  db.all("SELECT * FROM reservas WHERE fecha=?", [req.params.fecha], (err, rows) => {
    if (err) res.json([]);
    else res.json(rows);
  });
});

app.post("/cancelar", (req, res) => {
  if (!req.session.usuario) return res.json({ mensaje: "Debes iniciar sesión" });
  db.run("DELETE FROM reservas WHERE id=?", [req.body.id], (err) => {
    if (err) res.json({ mensaje: "Error al cancelar" });
    else res.json({ mensaje: "Reserva cancelada" });
  });
});

app.get("/admin/usuarios", (req, res) => {
  if (!req.session.usuario || req.session.usuario.rol !== "admin") return res.json({ mensaje: "No autorizado" });
  db.all("SELECT id, nombre, email, documento, rol FROM usuarios", [], (err, rows) => {
    if (err) res.json([]);
    else res.json(rows);
  });
});

app.post("/admin/eliminar-usuario", (req, res) => {
  if (!req.session.usuario || req.session.usuario.rol !== "admin") return res.json({ mensaje: "No autorizado" });
  db.run("DELETE FROM usuarios WHERE id=?", [req.body.id], (err) => {
    if (err) res.json({ mensaje: "Error al eliminar usuario" });
    else res.json({ mensaje: "Usuario eliminado" });
  });
});

app.get("/admin/reservas", (req, res) => {
  if (!req.session.usuario || req.session.usuario.rol !== "admin") return res.json({ mensaje: "No autorizado" });
  db.all("SELECT * FROM reservas ORDER BY fecha, hora_inicio", [], (err, rows) => {
    if (err) res.json([]);
    else res.json(rows);
  });
});

app.get("/admin/exportar", (req, res) => {
  if (!req.session.usuario || req.session.usuario.rol !== "admin") return res.json({ mensaje: "No autorizado" });
  db.all("SELECT * FROM reservas ORDER BY fecha, hora_inicio", [], (err, rows) => {
    if (err) return res.json({ mensaje: "Error al exportar" });
    const datos = rows.map(r => ({
      Nombre: r.usuario,
      Identificacion: r.documento,
      Espacio: `Espacio ${r.espacio}`,
      Fecha: r.fecha,
      "Hora Inicio": r.hora_inicio,
      "Hora Fin": r.hora_fin
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(datos);
    XLSX.utils.book_append_sheet(wb, ws, "Reservas");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Disposition", "attachment; filename=reservas.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
