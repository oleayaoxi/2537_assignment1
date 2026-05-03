// require("dotenv").config();

// const mongodb_host = process.env.MONGODB_HOST;
// const mongodb_user = process.env.MONGODB_USER;
// const mongodb_password = process.env.MONGODB_PASSWORD;

// const MongoClient = require("mongodb").MongoClient;
// //const atlasURI = `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/`;
// const atlasURI = `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/?retryWrites=true&w=majority&appName=Cluster`;

// var database = new MongoClient(atlasURI, {});
// module.exports = { database };

// require("dotenv").config();
// const { MongoClient } = require("mongodb");

// const user = process.env.MONGODB_USER;
// const password = process.env.MONGODB_PASSWORD;
// const host = process.env.MONGODB_HOST;
// const database = process.env.MONGODB_USER_DATABASE;

// const uri = `mongodb+srv://olea_db_user:D6eaqpWddq7xCPZM@cluster.kg3nqsx.mongodb.net/`;

// const client = new MongoClient(uri, {
//   tls: true,
//   tlsAllowInvalidCertificates: true,
//   family: 4,
// });

// let userCollection;

// async function connect() {
//   await client.connect();
//   const db = client.db(database);
//   userCollection = db.collection("users");
//   console.log("Connected to MongoDB");
// }

// connect();

// module.exports = { userCollection };

require("dotenv").config();
const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

let userCollection;

async function connectDB() {
  await client.connect();
  const db = client.db(process.env.MONGODB_USER_DATABASE);
  userCollection = db.collection("users");
  console.log("Connected to MongoDB");
}

connectDB();

module.exports = {
  getUserCollection: () => userCollection,
};
