const express = require("express")
const cors = require("cors")
const app = express()
require('dotenv').config()
const port = process.env.PORT || 3000;

app.use(cors())
app.use(express.json())

const admin = require("firebase-admin");

// const serviceAccount = require("./stitchflow-firebase-adminsdk.json");
const serverAccountInf = {
    "type": process.env.FIREBASE_type,
    "project_id": process.env.FIREBASE_project_id,
    "private_key_id": process.env.FIREBASE_private_key_id,
    "private_key": process.env.FIREBASE_private_key,
    "client_email": process.env.FIREBASE_client_email,
    "client_id": process.env.FIREBASE_client_id,
    "auth_uri": process.env.FIREBASE_auth_uri,
    "token_uri": process.env.FIREBASE_token_uri,
    "auth_provider_x509_cert_url": process.env.FIREBASE_auth_provider_x509_cert_url,
    "client_x509_cert_url": process.env.FIREBASE_client_x509_cert_url,
    "universe_domain": process.env.FIREBASE_universe_domain,
}

admin.initializeApp({
    credential: admin.credential.cert(serverAccountInf)
});



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_Admin}:${process.env.DB_Password}@codeearnestcluster.vnisplg.mongodb.net/?appName=CodeEarnestCluster`;
const stripe = require('stripe')(process.env.STRIPE_Key);

const validateFirebaseToken = async (req, res, next) => {

    if (!req.headers.authorization) {
        console.log("No Authorizarion")
        return res.status(401).send({ message: "Unauthorized Access" })
    }
    const token = req.headers.authorization.split(" ")[1]

    if (!token) {
        return res.status(401).send({ message: "Unauthorized Access" })
    }

    try {
        const userInfo = await admin.auth().verifyIdToken(token)
        req.userInfo = userInfo;
        next()

    }
    catch {
        return res.status(401).send({ message: "Unauthorized Access" })
    }

}


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
        // await client.connect();
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");

        const adminValidation = async (req, res, next) => {

            if (!req.headers.authorization) {
                console.log("No Authorizarion")
                return res.status(401).send({ message: "Unauthorized Access" })
            }
            const token = req.headers.authorization.split(" ")[1]

            if (!token) {
                return res.status(401).send({ message: "Unauthorized Access" })
            }

            try {
                const userInfo = await admin.auth().verifyIdToken(token)
                const query = { email: userInfo.email }
                const check = await dbUsers.findOne(query)
                // console.log("Admin:", check)
                if (check.accountType === "Admin") {
                    next()
                } else {
                    return res.status(401).send({ message: "Unauthorized Access" })
                }
            }
            catch {
                return res.status(401).send({ message: "Unauthorized Access" })
            }

        }



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
        app.post("/CreatePost", validateFirebaseToken, async (req, res) => {
            const postData = req.body;
            console.log("Use Information Ceatepsot:", req.userInfo)
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

            console.log(token)
        })

        app.delete("/DeletePost/:id", validateFirebaseToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const post = await dbAllPost.deleteOne(query)
            res.send(post)
        })


        // UPDATE POST
        app.patch("/UpdatePost", validateFirebaseToken, async (req, res) => {
            const postData = req.body;
            const query = { _id: new ObjectId(postData.id) };

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
            };

            const post = await dbAllPost.updateOne(query, { $set: postInfo });
            console.log("Updated", post)
            res.send(post);
        })


        // Load All Products
        app.get("/AllProducts", async (req, res) => {
            const { limit, skip, isHome } = req.query;
            console.log("Limit:", limit, isHome, skip)
            const count = await dbAllPost.countDocuments()

            if (isHome === "true") {
                const allData = await dbAllPost.find({ showHome: true }).limit(Number(limit)).skip(Number(skip)).toArray()
                res.send({ products: allData, total: count })
            } else {
                const allData = await dbAllPost.find().limit(Number(limit)).skip(Number(skip)).toArray()
                res.send({ products: allData, total: count })
            }
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

            const query = { checkPrevOrder: paymentInfo.checkPrevOrder };
            const check = await dbOrders.findOne(query);

            const priceCent = total * 100;
            console.log(priceCent, title);

            if (paymentInfo.paymentStatus === "Cash On Delivery") {
                console.log("Cash On Delivery")
                if (!check) {
                    const newProductDetails = {
                        ...paymentInfo,
                        postedAt: new Date()
                    };

                    const result = await dbOrders.insertOne(newProductDetails);
                    res.send(newProductDetails);
                    return
                } else {
                    console.log({ message: "Already Exist" });
                    res.send({ message: "Already Exist" });
                }
            }

            if (paymentInfo.paymentStatus !== "Cash On Delivery") {
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
            }
        });


        // ON SUCCESSFULL ONLINE PAYMENT 
        app.post("/payment-success", async (req, res) => {
            const sessionId = req.query.session_id;
            const session = await stripe.checkout.sessions.retrieve(sessionId);
            const productDetails = JSON.parse(session.metadata.paymentInfo);
            const query = { checkPrevOrder: productDetails.checkPrevOrder };

            if (session.payment_status === "paid") {
                const check = await dbOrders.findOne(query);

                if (!check) {
                    const newProductDetails = {
                        ...productDetails,
                        postedAt: new Date()
                    };

                    const result = await dbOrders.insertOne(newProductDetails);
                    res.send(newProductDetails);
                } else {
                    console.log({ message: "Already Exist" });
                    res.send({ message: "Already Exist" });
                }
            }



        })

        // MANAGER DASHBOARD STATS:
        app.get("/GetProductsStats", validateFirebaseToken, async (req, res) => {
            const email = req.query.email
            const limit = req.query.limit
            console.log(email, limit)
            const query = { createdBy: email }
            const AllProducts = await dbAllPost.find(query).sort({ createdAt: -1 }).limit(Number(limit)).toArray()
            res.send(AllProducts)
        })

        app.get("/GetPendingStats", validateFirebaseToken, async (req, res) => {
            const email = req.query.email
            const limit = req.query.limit
            console.log(email, limit)
            const query = { sellerEmail: email, status: "pending" }
            const AllProducts = await dbOrders.find(query).limit(Number(limit)).toArray()
            console.log(AllProducts)
            res.send(AllProducts)
        })

        app.get("/GetApprovedStats", validateFirebaseToken, async (req, res) => {
            const email = req.query.email
            const limit = req.query.limit
            console.log(email, limit)
            const query = { sellerEmail: email, status: "confirmed" }
            const AllProducts = await dbOrders.find(query).limit(Number(limit)).toArray()
            res.send(AllProducts)
        })



        // ACCEPT AND REJECT ORDERS
        app.patch("/ProductOrderApprove/:id", validateFirebaseToken, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };

            const check = await dbOrders.findOne(filter)
            console.log(check)

            if (check.sellerEmail === req.userInfo.email) {
                const updateDoc = {
                    $set: {
                        status: "confirmed",
                        approvedTime: new Date(),
                        stage: "Preparing"
                    }
                };
                const result = await dbOrders.updateOne(filter, updateDoc);
                console.log("Approved")
                res.send(result);
            }
        })


        app.patch("/ProductOrderReject/:id", validateFirebaseToken, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };

            const check = await dbOrders.findOne(filter)
            console.log(check)

            if (check.sellerEmail === req.userInfo.email) {
                // console.log("Match")
                const updateDoc = {
                    $set: {
                        status: "rejected",
                        rejectedTime: new Date(),
                        stage: "rejected"
                    }
                };
                const result = await dbOrders.updateOne(filter, updateDoc);
                console.log("rejected")
                res.send(result);
            }

        })


        // MANAGER UPDATE APPROVED PRODUCT STATUS
        app.patch("/ManagerUpdateApprovedProduct/:id", validateFirebaseToken, async (req, res) => {
            const data = req.body;
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    ...data[0]
                }
            };

            const result = await dbOrders.updateOne(query, updateDoc);
            console.log(updateDoc)
            res.send(result)
        })


        app.get("/MyOrders", validateFirebaseToken, async (req, res) => {
            const email = req.query.email
            const limit = req.query.limit
            const query = { email: email }
            console.log(email, limit)
            const AllProducts = await dbOrders.find(query).sort({ createdAt: -1 }).limit(Number(limit)).toArray()
            res.send(AllProducts)
        })

        app.delete("/DeleteMyOrder/:id", validateFirebaseToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const post = await dbOrders.deleteOne(query)
            res.send(post)
        })

        app.get("/GetSingleOrder/:id", validateFirebaseToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await dbOrders.findOne(query)
            res.send(result)
        })


        // ADMIN PRODUCTS, USERS, ORDERS GET
        app.get("/AdminAllProducts", adminValidation, async (req, res) => {
            const getAll = await dbAllPost.find().sort({ createdAt: -1 }).toArray()
            res.send(getAll)
        })

        app.get("/AdminAllUsers", adminValidation, async (req, res) => {
            const getAll = await dbUsers.find().sort({ registrationTime: -1 }).toArray()
            res.send(getAll)
        })
        app.get("/AdminAllOrders", adminValidation, async (req, res) => {
            const filterBy = req.query.filter;

            console.log("FilteredBy:", filterBy)
            if (filterBy === undefined || filterBy === "all") {
                const getAll = await dbOrders.find().sort({ postedAt: -1 }).toArray()
                res.send(getAll)
            } else {
                const filteredAll = await dbOrders.find({ status: filterBy }).sort({ postedAt: -1 }).toArray()
                res.send(filteredAll)
            }

        })



        // PATCH ShowHome
        app.patch("/AdminShowHomeChange", adminValidation, async (req, res) => {
            const { id, showHome } = req.body;

            if (!id) {
                return res.status(400).send({ message: "Product ID is required" });
            }

            const query = { _id: new ObjectId(id) };
            const update = {
                $set: {
                    showHome: showHome
                }
            };

            const result = await dbAllPost.updateOne(query, update);
            res.send(result);
        }
        );


        app.patch("/AdminAccountStatusChange/:id", adminValidation, async (req, res) => {
            const { id } = req.params;
            const { status, suspendedReason, suspendedFeedback } = req.body;

            if (!id || !status) {
                return res.status(400).send({
                    success: false,
                    message: "User ID and status are required"
                });
            }

            const query = { _id: new ObjectId(id) };

            const updateDoc = {
                $set: {
                    status: status,
                    suspendedReason: suspendedReason || "",
                    suspendedFeedback: suspendedFeedback || "",
                    updatedAt: new Date()
                }
            };

            const result = await dbUsers.updateOne(query, updateDoc);

            res.send(result);

        });



    } finally {
        // await client.close();
    }
}
run().catch(console.dir);

app.listen(port)