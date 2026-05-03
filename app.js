const dns = require("node:dns/promises");
dns.setServers(["1.1.1.1", "8.8.8.8"]);

require("dotenv").config();
const express = require("express");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const bcrypt = require("bcrypt");
const saltRounds = 12;
const Joi = require("joi");

const app = express();

app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));

const { getUserCollection } = require("./databaseConnection");

const expireTime = 60 * 60 * 1000;

// Session setup
app.use(
  session({
    secret: process.env.NODE_SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      crypto: { secret: process.env.NODE_SESSION_SECRET },
    }),
    cookie: { maxAge: expireTime },
  }),
);

// HOME
app.get("/", (req, res) => {
  if (!req.session.authenticated) {
    return res.send(`
      <h1>Welcome</h1>
      <a href="/signup">Sign up</a><br>
      <a href="/login">Log in</a>
    `);
  }

  const name = req.session.user?.name || "User";
  res.send(`
    <h1>Hello, ${name}!</h1>
    <a href="/members">Go to Members Area</a><br>
    <a href="/logout">Logout</a>
  `);
});

// SIGNUP PAGE
app.get("/signup", (req, res) => {
  res.send(`
    <h1>Create User</h1>
    <form action="/signupSubmit" method="post">
      <input name="name" type="text" placeholder="name"><br>
      <input name="email" type="text" placeholder="email"><br>
      <input name="password" type="password" placeholder="password"><br>
      <button>Submit</button>
    </form>
  `);
});

// SIGNUP SUBMIT
app.post("/signupSubmit", async (req, res) => {
  const userCollection = getUserCollection(); // ✔ FIXED

  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.send("All fields required.<br><a href='/signup'>Try again</a>");
  }

  const schema = Joi.object({
    name: Joi.string().max(50).required(),
    email: Joi.string().email().max(100).required(),
    password: Joi.string().max(50).required(),
  });

  const validation = schema.validate({ name, email, password });
  if (validation.error) {
    return res.send("Invalid input.<br><a href='/signup'>Try again</a>");
  }

  const hashedPassword = await bcrypt.hash(password, saltRounds);

  await userCollection.insertOne({
    name,
    email,
    password: hashedPassword,
  });

  req.session.authenticated = true;
  req.session.user = { name, email };
  req.session.cookie.maxAge = expireTime;

  res.redirect("/members");
});

// LOGIN PAGE
app.get("/login", (req, res) => {
  res.send(`
    <h1>Log in</h1>
    <form action="/loginSubmit" method="post">
      <input name="email" type="text" placeholder="email"><br>
      <input name="password" type="password" placeholder="password"><br>
      <button>Submit</button>
    </form>
  `);
});

// LOGIN SUBMIT
app.post("/loginSubmit", async (req, res) => {
  const userCollection = getUserCollection(); // ✔ FIXED

  const { email, password } = req.body;

  if (!email || !password) {
    return res.send(
      "Email and password required.<br><a href='/login'>Try again</a>",
    );
  }

  const schema = Joi.object({
    email: Joi.string().email().max(100).required(),
    password: Joi.string().max(50).required(),
  });

  const validation = schema.validate({ email, password });
  if (validation.error) {
    return res.send(
      "Invalid email/password.<br><a href='/login'>Try again</a>",
    );
  }

  const result = await userCollection
    .find({ email })
    .project({ name: 1, email: 1, password: 1 })
    .toArray();

  if (result.length !== 1) {
    return res.send(
      "Invalid email/password.<br><a href='/login'>Try again</a>",
    );
  }

  const user = result[0];

  if (!(await bcrypt.compare(password, user.password))) {
    return res.send(
      "Invalid email/password.<br><a href='/login'>Try again</a>",
    );
  }

  req.session.authenticated = true;
  req.session.user = { name: user.name, email: user.email };
  req.session.cookie.maxAge = expireTime;

  res.redirect("/members");
});

// AUTH MIDDLEWARE
function isAuthenticated(req, res, next) {
  if (req.session.authenticated) return next();
  res.redirect("/");
}

// MEMBERS PAGE
app.get("/members", isAuthenticated, (req, res) => {
  const name = req.session.user.name;

  const images = ["deers.jpg", "flowers&cat.jpg", "sleeping_cat.jpg"];

  const randomImage = images[Math.floor(Math.random() * images.length)];

  res.send(`
    <h1>Hello, ${name}.</h1>
    <img src="/${randomImage}" style="width:300px;"><br>
    <a href="/logout">Sign out</a>
  `);
});

// LOGOUT
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

// 404
app.use((req, res) => {
  res.status(404).send("Page not found - 404");
});

// START SERVER
app.listen(3000, () => {
  console.log("Server running on port 3000");
});
