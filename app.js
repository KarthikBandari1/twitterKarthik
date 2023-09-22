const express = require("express");
const app = express();
app.use(express.json());
const bcrypt = require("bcrypt");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const path = require("path");
const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http:/localhost:3000/");
    });
  } catch (e) {
    console.log(e.message);
  }
};

initializeDBAndServer();

//Registering (api 1)
app.post("/register/", async (request, response) => {
  const { username, name, password, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (password.length >= 6 && dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO 
        user (username, name, password, gender) 
      VALUES 
        (
          '${username}', 
          '${name}',
          '${hashedPassword}', 
          '${gender}',
        )`;
    const dbResponse = await db.run(createUserQuery);
    response.send(`User created succesfully`);
  } else if (password.length < 6 && dbUser === undefined) {
    response.status = 400;
    response.send("Password is too short");
  } else {
    response.status = 400;
    response.send("User already exists");
  }
});
