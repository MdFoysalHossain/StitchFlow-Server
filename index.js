const express = require("express")
const cors = require("cors")
const app = express()
require('dotenv').config()
const port = process.env.PORT || 3000;

app.use(cors())
app.use(express.json())


const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_Admin}:${process.env.DB_Password}@codeearnestcluster.vnisplg.mongodb.net/?appName=CodeEarnestCluster`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    app.get("/", (req, res) => {
        res.send("Hellow World")
    })

    const myDB = client.db("StitchFlow");
    const dbUsers = myDB.collection("Users");
    const dbAllPost = myDB.collection("AllPosts");

    try {
        await client.connect();
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");



        // CREATE USER ACCOUNT AND HANDLE LOGIN CREATION
        app.post("/createUser", async (req, res) => {
            const userDetails = req.body
            const iso = new Date().toISOString();

            const query = { email: userDetails.email }
            const findEmail = await dbUsers.findOne(query)

            if (findEmail) {
                return res.send({ message: "User Already Has an Account" })
            }

            const userIngo = {
                name: userDetails.name,
                email: userDetails.email,
                image: userDetails.image,
                accountType: userDetails.accountType,
                status: "pending",
                registrationTime: iso

            }
            console.log(userDetails)
            const result = await dbUsers.insertOne(userIngo)
            res.send(result)
        })


        // FIND USER BASED ON EMAIL Query
        app.get("/FindUser", async (req, res) => {
            const email = req.query.email
            const query = { email: email }
            const result = await dbUsers.findOne(query)
            res.send(result)
        })


        // CREATE POST SYSTEM ONLY Managers can upload 
        app.post("/CreatePost", async (req, res) => {
            const postData = req.body;
            const postInfo = {
                category: postData.category,
                perPrice: postData.perPrice,
                totalQuanity: postData.totalQuanity,
                availableQuanity: postData.availableQuanity,
                minimumOrder: postData.minimumOrder,
                cod: postData.cod,
                onlinePay: postData.onlinePay,
                showHome: postData.showHome,
                title: postData.title,
                description: postData.description,
                images: postData.images,
                status: postData.status,
                createdBy: postData.createdBy,
                createdAt: postData.createdAt
            }
            const post = await dbAllPost.insertOne(postInfo)
            res.send(post)
        })


        // Load All Products
        app.get("/AllProducts", async(req, res) => {
            const allData = await dbAllPost.find().toArray()
            res.send(allData)
        })




    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.listen(port)