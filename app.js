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
app.set("view engine", "ejs");
app.set("views", "./views");

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
  const authenticated = req.session.authenticated || false;
  const name = req.session.user?.name || "User";

  res.render("index", {
    title: "Home",
    css: [],
    js: [],
    authenticated,
    name,
  });
});

// app.get("/", (req, res) => {
//   if (!req.session.authenticated) {
//     return res.send(`
//       <h1>Welcome</h1>
//       <a href="/signup">Sign up</a><br>
//       <a href="/login">Log in</a>
//     `);
//   }

//   const name = req.session.user?.name || "User";
//   res.send(`
//     <h1>Hello, ${name}!</h1>
//     <a href="/members">Go to Members Area</a><br>
//     <a href="/logout">Logout</a>
//   `);
// });

// SIGNUP PAGE
app.get("/signup", (req, res) => {
  res.render("signup", { css: [], js: [] });
});

// app.get("/signup", (req, res) => {
//   res.send(`
//     <h1>Create User</h1>
//     <form action="/signupSubmit" method="post">
//       <input name="name" type="text" placeholder="name"><br>
//       <input name="email" type="text" placeholder="email"><br>
//       <input name="password" type="password" placeholder="password"><br>
//       <button>Submit</button>
//     </form>
//   `);
// });

// SIGNUP SUBMIT
app.post("/signupSubmit", async (req, res) => {
  const userCollection = getUserCollection(); // ✔ FIXED

  const { name, email, password, adminCode } = req.body;

  let userType = "user";
  if (adminCode === "privilege51") {
    userType = "admin";
  }
  // if (!name || !email || !password) {
  //   return res.send("All fields required.<br><a href='/signup'>Try again</a>");
  // }
  let missingFields = [];

  if (!name) missingFields.push("name");
  if (!email) missingFields.push("email");
  if (!password) missingFields.push("password");

  // If any fields are missing, send a specific message
  if (missingFields.length > 0) {
    return res.render("signupSubmit", {
      missingFields,
      css: [],
      js: [],
    });
  }

  // if (missingFields.length > 0) {
  //   return res.send(
  //     `Missing field(s) are required: ${missingFields.join(", ")}.<br><a href='/signup'>Try again</a>`,
  //   );
  // }

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
    user_type: userType,
  });

  req.session.authenticated = true;
  req.session.user = { name, email, user_type: userType };
  req.session.cookie.maxAge = expireTime;

  res.redirect("/members");
});

// LOGIN PAGE
app.get("/login", (req, res) => {
  res.render("login", {
    title: "Login",
    css: [],
    js: [],
  });
});

// app.get("/login", (req, res) => {
//   res.send(`
//     <h1>Log in</h1>
//     <form action="/loginSubmit" method="post">
//       <input name="email" type="text" placeholder="email"><br>
//       <input name="password" type="password" placeholder="password"><br>
//       <button>Submit</button>
//     </form>
//   `);
// });

// LOGIN SUBMIT
app.post("/loginSubmit", async (req, res) => {
  const userCollection = getUserCollection(); // ✔ FIXED

  const { email, password } = req.body;

  if (!email || !password) {
    return res.render("emailPasswordRequiredForLogin", {
      css: [],
      js: [],
    });
  }

  const schema = Joi.object({
    email: Joi.string().email().max(100).required(),
    password: Joi.string().max(50).required(),
  });

  const validation = schema.validate({ email, password });
  if (validation.error) {
    return res.render("loginError", { css: [], js: [] });
  }

  const result = await userCollection
    .find({ email })
    .project({ name: 1, email: 1, password: 1, user_type: 1 })
    .toArray();

  if (result.length !== 1) {
    return res.render("loginError", { css: [], js: [] });
  }

  const user = result[0];

  if (!(await bcrypt.compare(password, user.password))) {
    return res.render("loginError", { css: [], js: [] });
  }

  req.session.authenticated = true;
  req.session.user = {
    name: user.name,
    email: user.email,
    user_type: user.user_type,
  };
  req.session.cookie.maxAge = expireTime;

  res.redirect("/members");
});

// AUTH MIDDLEWARE
function isAuthenticated(req, res, next) {
  if (req.session.authenticated) return next();
  res.redirect("/");
}

//MEMBERS PAGE
app.get("/members", isAuthenticated, (req, res) => {
  const name = req.session.user.name;

  const images = ["deers.jpg", "flowers&cat.jpg", "sleeping_cat.jpg"];

  res.render("members", {
    title: "Members Area",
    name,
    images,
    css: [],
    js: [],
  });
});

/*app.get("/members", isAuthenticated, (req, res) => {
   const name = req.session.user.name;

   const images = ["deers.jpg", "flowers&cat.jpg", "sleeping_cat.jpg"];

   const randomImage = images[Math.floor(Math.random() * images.length)];

//   res.send(`
//     <h1>Hello, ${name}.</h1>
//     <img src="/${randomImage}" style="width:300px;"><br>
//     <a href="/logout">Sign out</a>
//   `);
// });
*/
function isValidSession(req) {
  if (req.session.authenticated) {
    return true;
  }
  return false;
}

function sessionValidation(req, res, next) {
  if (isValidSession(req)) {
    next();
  } else {
    res.redirect("/login");
  }
}

function isAdmin(req) {
  if (req.session.user_type == "admin") {
    return true;
  }
  return false;
}

function adminAuthorization(req, res, next) {
  if (!isAdmin(req)) {
    res.status(403);
    res.render("errorMessage", { error: "Not Authorized" });
    return;
  } else {
    next();
  }
}
// app.get('/admin', sessionValidation, adminAuthorization, async (req,res) => {
//     const result = await userCollection.find().project({username: 1, _id: 1}).toArray();

//     res.render("admin", {users: result});
// });

app.get("/admin", isAuthenticated, async (req, res) => {
  // Not logged in → redirect
  if (!req.session.user) {
    return res.redirect("/login");
  }

  // Logged in but not admin → 403 Forbidden
  if (req.session.user.user_type !== "admin") {
    return res.status(403).render("adminErrorMessage", {
      title: "403 Forbidden",
      error: "You are not authorized to view this page.",
      css: [],
      js: [],
    });
  }

  // Fetch all users from MongoDB
  const userCollection = getUserCollection();

  const users = await userCollection
    .find({})
    .project({ name: 1, email: 1, user_type: 1 })
    .toArray();

  // Render admin page
  res.render("admin", {
    title: "Admin Panel",
    users,
    css: [],
    js: [],
  });
});

//promote route
app.get("/promote/:email", isAuthenticated, async (req, res) => {
  const userCollection = getUserCollection();

  // Only admins can promote
  if (req.session.user.user_type !== "admin") {
    return res.status(403).send("Not authorized");
  }

  const email = req.params.email;

  await userCollection.updateOne(
    { email: email },
    { $set: { user_type: "admin" } },
  );

  if (req.session.user.email === email) {
    req.session.user.user_type = "admin";
  }

  res.redirect("/admin");
});

//Demote route
app.get("/demote/:email", isAuthenticated, async (req, res) => {
  const userCollection = getUserCollection();

  // Only admins can demote
  if (req.session.user.user_type !== "admin") {
    return res.status(403).send("Not authorized");
  }

  const email = req.params.email;

  await userCollection.updateOne(
    { email: email },
    { $set: { user_type: "user" } },
  );

  if (req.session.user.email === email) {
    req.session.user.user_type = "user";
  }

  res.redirect("/admin");
});

// LOGOUT
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

// 404
app.use((req, res) => {
  res.status(404).render("404", {
    title: "404 - Page Not Found",
    css: [],
    js: [],
  });
});

// app.use((req, res) => {
//   res.status(404).send("Page not found - 404");
// });

// START SERVER
app.listen(3000, () => {
  console.log("Server running on port 3000");
});
