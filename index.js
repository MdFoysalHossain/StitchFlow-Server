const express = require("express")
const cors = require("cors")
const app = express()
require('dotenv').config()
const port = process.env.PORT || 3000;

app.use(cors())
app.use(express.json())


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_Admin}:${process.env.DB_Password}@codeearnestcluster.vnisplg.mongodb.net/?appName=CodeEarnestCluster`;
const stripe = require('stripe')(process.env.STRIPE_Key);

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
    const dbOrders = myDB.collection("ProductOrders");

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
        app.get("/AllProducts", async (req, res) => {
            const allData = await dbAllPost.find().toArray()
            res.send(allData)
        })

        app.get("/SingleProduct/:id", async (req, res) => {
            const params = req.params.id;
            const query = { _id: new ObjectId(params) }
            const getData = await dbAllPost.findOne(query)
            console.log(getData)
            res.send(getData)
        })







        // PAYMENT API Checkout
        app.post("/create-checkout-session", async (req, res) => {
            const paymentInfo = req.body;
            const { total, title } = paymentInfo;

            const priceCent = total * 100;
            console.log(priceCent, title);

            const session = await stripe.checkout.sessions.create({
                line_items: [
                    {
                        price_data: {
                            currency: "USD",
                            unit_amount: priceCent,
                            product_data: {
                                name: title,
                            }
                        },
                        quantity: 1,
                    },
                ],

                mode: 'payment',
                metadata: {
                    paymentInfo: JSON.stringify(paymentInfo)
                },

                success_url: `${process.env.SITE_Domain}/Payment/Payment-successful?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.SITE_Domain}/Payment/Payment-canceled`,
            });

            console.log(session);
            res.send({ url: session.url });
        });


        // ON SUCCESSFULL ONLINE PAYMENT 
        app.post("/payment-success", async (req, res) => {
            const sessionId = req.query.session_id;

            const session = await stripe.checkout.sessions.retrieve(sessionId)

            const productDetails = JSON.parse(session.metadata.paymentInfo);
            const query = { checkPrevOrder: productDetails.checkPrevOrder }

            if (session.payment_status === "paid") {
                const check = await dbOrders.findOne(query)
                if (!check) {
                    const result = await dbOrders.insertOne(productDetails)
                    // console.log(result)
                    res.send(productDetails)
                }else{
                    console.log({message: "Already Exist"})
                    res.send({message: "Already Exist"})
                }
            }
        })

        // MANAGER DASHBOARD STATS:
        app.get("/GetProductsStats", async(req, res) => {
            const email = req.query.email
            const limit = req.query.limit
            console.log(email, limit)
            const query = {createdBy: email}
            const AllProducts = await dbAllPost.find(query).sort({ createdAt: -1 }).limit(Number(limit)).toArray()
            res.send(AllProducts)
        })

        app.get("/GetPendingStats", async(req, res) => {
            const email = req.query.email
            const limit = req.query.limit
            console.log(email, limit)
            const query = {sellerEmail: email, status: "pending"}
            const AllProducts = await dbOrders.find(query).limit(Number(limit)).toArray()
            res.send(AllProducts)
        })

        app.get("/GetApprovedStats", async(req, res) => {
            const email = req.query.email
            const limit = req.query.limit
            console.log(email, limit)
            const query = {sellerEmail: email, status: "confirmed"}
            const AllProducts = await dbOrders.find(query).limit(Number(limit)).toArray()
            res.send(AllProducts)
        })

    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.listen(port)