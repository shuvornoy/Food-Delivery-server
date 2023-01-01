const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;

const app = express();

// middleware
app.use(cors());
app.use(express.json());

//..connect
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@ariful.1up09ti.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

//..jwt
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send("unauthorized access");
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    const ordersCollection = client.db("food-city").collection("orders");
    const usersCollection = client.db("food-city").collection("users");
    const allProductsCollection = client.db("food-city").collection("allProducts");
    const paymentsCollection = client.db("food-city").collection("payments");
//..database 

    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);

      if (user?.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    app.get("/orders", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req?.decoded?.email;

      if (email !== decodedEmail) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const orders = await ordersCollection.find(query).toArray();
      res.send(orders);
    });
//..single product
    app.get("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const booking = await ordersCollection.findOne(query);
      res.send(booking);
    });

    app.post("/orders", async (req, res) => {
      const booking = req.body;
      console.log(booking);
      const query = {
        appointmentDate: booking.appointmentDate,
        email: booking.email,
        treatment: booking.treatment,
      };
     const result = await ordersCollection.insertOne(booking);
      res.send(result);
    });

    app.post("/create-payment-intent", async (req, res) => {
      const booking = req.body;
      const price = booking.price;
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount: amount,
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
//payments
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const result = await paymentsCollection.insertOne(payment);
      const id = payment.bookingId;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };
      const updatedResult = await ordersCollection.updateOne(
        filter,
        updatedDoc
      );
      res.send(result);
    });

    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.TOKEN, {
          expiresIn: "10d",
        });
        return res.send({ accessToken: token });
      }
      res.status(403).send({ accessToken: "" });
    });
//user
    app.get("/users", async (req, res) => {
      const query = {};
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });

    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.role === "admin" });
    });

    //seller
    app.get("/users/seller/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ isSeller: user?.role === "on" });
    }); 
    //

    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log(user);
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.put("/users/admin/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });
    

    //temporary to update price field on appointment options
    app.get('/addPrice', async (req, res) => {
        const filter = {}
        const options = { upsert: true }
        const updatedDoc = {
            $set: {
                price: 99
            }
        }
        const result = await appointmentOptionCollection.updateMany(filter, updatedDoc, options);
        res.send(result);
    })

    app.get("/allProducts", async (req, res) => {
      const query = {};
      const allProducts = await allProductsCollection.find(query).toArray();
      res.send(allProducts);
    });

    app.post("/allProducts", async (req, res) => {
      const doctor = req.body;
      const result = await allProductsCollection.insertOne(doctor);
      res.send(result);
    });
//single product
    app.delete("/allProducts/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await allProductsCollection.deleteOne(filter);
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.log);

app.get("/", async (req, res) => {
  res.send("allProducts portal server is running");
});

app.listen(port, () => console.log(`allProducts portal running on ${port}`));

