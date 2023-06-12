const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
require("dotenv").config();
const app = express();
const jwt = require('jsonwebtoken')
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  // bearer token
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lcauzmf.mongodb.net/?retryWrites=true&w=majority`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const usersCollection = client.db("ronginDb").collection("users");
    const classesCollection = client.db("ronginDb").collection("classes");
    const studentsCollection = client.db("ronginDb").collection("students")
    const paymentCollection = client.db("ronginDb").collection("payments");
    // JWT
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })

      res.send({ token })
    })

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'instructor') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }


    //   apis of the users
    app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    app.get('/users/instructor', async (req, res) => {
      const query = { role: 'instructor' }
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });
    app.get('/users/instructor/popular', async (req, res) => {
      const query = { role: 'instructor' }
      const result = await usersCollection.find(query).limit(6).toArray();
      res.send(result);
    });
    app.post('/users', async (req, res) => {
      const user = req.body;
      console.log(user);
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'User already exists' })
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    })
    // admin user apis
    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })

    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      console.log(result)
      res.send(result)
    })
    // instructor user apis
    app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      console.log(email)
      if (req.decoded.email !== email) {
        res.send({ instructor: false })
      }
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === 'instructor' }
      res.send(result);
    })
    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'instructor'
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result)
    })

    // Apis of classes
    app.get('/classes', async (req, res) => {
      let query = {}
      if (req.query?.insEmail) {
        query = { insEmail: req.query.insEmail }
      }
      const cursor = classesCollection.find(query);
      const result = await cursor.toArray();
      res.send(result)
    })
    app.get('/classes/popular', async (req, res) => {
      let query = {status: 'approved'}
      const options ={
        sort:{'enrolled': -1}
      }
      const cursor = classesCollection.find(query, options).limit(6);
      const result = await cursor.toArray();
      res.send(result)
    })
    
    app.post('/classes', async (req, res) => {
      const theClass = req.body;
      const result = await classesCollection.insertOne(theClass);
      res.send(result)
    })
    // to update feedback
    app.patch('/classes/feedback/:id', async (req, res) => {
      const id = req.params.id;
      const theFeedback = req.body.feedback;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          feedback: theFeedback
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result)
    })
    // to update status
    app.patch('/classes/status/:id', async (req, res) => {
      const id = req.params.id;
      const status = req.body.status;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: status
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result)
    })
    
    app.patch('/classes/count/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $inc: {
          seat: -1,
          enrolled: +1
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      console.log(result)
      res.send(result)
    })
    app.patch('/classes/update/:id', async (req, res) => {
      const id = req.params.id;
      const seat = parseInt(req.body.seat);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          seat: seat
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result)
    })
    // student related apis
    app.get('/student/:email', async (req, res) => {
      const email = req.params.email;
      let query = { studentEmail: email }
      const cursor = studentsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result)
    })
    app.get('/studentpayment/:id', async(req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const theClass = await studentsCollection.findOne(query);
      console.log(theClass)
      res.send(theClass);
    })
    
    app.post('/student/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const bookedClass = req.body;
      const query = {classId: bookedClass.classId, studentEmail:email}
      const existingClass = await studentsCollection.findOne(query);
      if (existingClass) {
        return res.send({ message: 'Class already exists' })
      }
      const result = await studentsCollection.insertOne(bookedClass)
      res.send(result);
    })
    app.delete('/student/:id', async (req, res) => {
      const id = req.params.id;
      console.log(req.body)
      const query = { _id: new ObjectId(id) }
      const result = await studentsCollection.deleteOne(query);
      res.send(result);
    })
    // to update feedback
    app.patch('/student/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          clsStatus: 'enrolled'
        },
      };
      const result = await studentsCollection.updateOne(filter, updateDoc);
      res.send(result)
    })
    

    // Creating payment intent
    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    // payment related api
    app.get('/payments', verifyJWT, async (req, res) => {
      let query = {}
      let options={}
      if (req.query?.email) {
        
        query = { email: req.query.email }
        options ={
          sort:{'date': -1}
        }
      }
      const cursor = paymentCollection.find(query, options);
      const result = await cursor.toArray();
      res.send(result)
    })
    app.post('/payments', verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);
      res.send(insertResult);
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //   await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send("Rongin academy server is running");
})

app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})