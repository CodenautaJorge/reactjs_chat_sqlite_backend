import express from "express";
import http from "http";
import { Server as SocketServer } from "socket.io";
import sqlite3 from "sqlite3";
import cors from "cors";
import bcrypt from "bcrypt";
import 'dotenv/config'

//Creamos un servidor http para vincularlo a socket.io y poder establecer una comunicación a tiempo real.

const PORT = process.env.PORT;
const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// Abrir la conexión a la base de datos
const db = new sqlite3.Database(path.resolve(__dirname, "chat.db"));

// Crear una tabla para almacenar las salas si no existe
db.run(
  "CREATE TABLE IF NOT EXISTS chatrooms (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, date TEXT)"
);

//Crear una tabla para almacenar los mensajes si no existe
db.run(
  "CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user TEXT, message VARCHAR(1000), room TEXT, created_at TEXT)"
);

//Crear una tabla para almacenar los usuarios si no existe
db.run(
  "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, email TEXT, password TEXT)"
);

//Indicamos la dirección del servidor donde se ejecuta el cliente
//Con * vale cualquier dirección

const io = new SocketServer(server, {
  cors: {
    origin: "*",
  },
});

//Establecemos una escucha para comprobar cuando se conecta un cliente:
io.on("connection", (socket) => {
  console.log("client connected");

  //Escucha de los mensajes de chat
  socket.on("message", (data) => {
    console.log(data);

    //Enviamos el mensaje a todos los clientes menos al que lo ha enviado:
    socket.broadcast.emit("message", {
      user: data.user,
      message: data.message,
      room: data.room,
      created_at: data.created_at,
    });

    //Insertamos los mensajes del chat en la bdd:
    db.run(
      "INSERT INTO messages (user, message, room, created_at) VALUES (?,?,?,?)",
      [data.user, data.message, data.room, data.created_at],
      function (err) {
        if (err) {
          return res.status(500).json({ err: "Error al guardar el mensaje" });
        }
      }
    );
  });

  //Escucha de los clientes (salas):
  socket.on("chatroom", (data) => {
    console.log(data);
    //Enviamos el mensaje al resto de clientes menos al que lo ha enviado:
    socket.broadcast.emit("chatroom", {
      name: data.name,
      date: data.date,
    });

    db.run(
      "INSERT INTO chatrooms (name, date) VALUES (?, ?)",
      [data.name, data.date],
      function (err) {
        if (err) {
          return res
            .status(500)
            .json({ error: "Error al guardar la sala de chat" });
        }
      }
    );
  });

});

//Función para devolver las salas a los clientes

app.get("/api/chatrooms", (req, res) => {
  db.all("SELECT * FROM chatrooms ORDER BY id DESC", (err, rows) => {
    if (err) {
      return res
        .status(500)
        .json({ error: "Error al obtener las salas de chat" });
    }
    res.json(rows);
  });
});

//Función para devolver las salas a los clientes

app.get("/api/messages", (req, res) => {
  db.all("SELECT * FROM messages ORDER BY id ASC", (err, rows) => {
    if (err) {
      return res.status(500).json({ error: "Error al obtener los mensajes" });
    }
    res.json(rows);
  });
});

// Ruta para guardar un usuario
app.post("/api/saveuser", async (req, res) => {
  const { username, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  db.run(
    "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
    [username, email, hashedPassword],
    function (err) {
      if (err) {
        return res.status(500).json({ error: "Error al crear el usuario" });
      }
      res.json({ success: "Usuario creado con éxito" });
    }
  );
});

// Ruta para iniciar sesión
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  db.get(
    "SELECT * FROM users WHERE email = ?", [email], async (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!row) {
        return res.status(401).json({ error: "Usuario no encontrado" });
      }
      try {
        if (await bcrypt.compare(password, row.password)) {
          return res.json({ success: "Inicio de sesión correcto", username: row.username });
        } else {
          return res.status(401).json({ error: "Contraseña incorrecta" });
        }
      } catch (error) {
        console.error("Error al comparar contraseñas:", error);
        return res.status(500).json({ error: "Error al iniciar sesión" });
      }
    }
  );
});

app.listen(PORT, () => {
  console.log(`port runing in http://localhost:${PORT}`);
}); 
