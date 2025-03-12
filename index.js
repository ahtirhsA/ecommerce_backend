const express=require('express')
const app=express()
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
require('dotenv').config();

const upload = multer({ dest: './uploads/' });


const cors=require('cors')
app.use(cors(
    {
        origin:"*"
    }
))

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));



const {open}=require('sqlite')
const sqlite3=require('sqlite3')

const bcrypt=require('bcrypt')
const jwt=require('jsonwebtoken')


app.use(express.json())

const path=require('path');
const { inspect } = require('util');
const dbpath=path.join(__dirname,'commerce.db')

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });

let db;


const initializeConnection=async ()=>{

try{
    db=await open(
        {
            filename:dbpath,
            driver:sqlite3.Database
        }
    )

    const chckProd=`
       SELECT * FROM Products;
    `

    const reschckProd=await db.all(chckProd);

    if (reschckProd.length==0){

    const response=await fetch('https://fakestoreapi.com/products');
    const jsondata=await response.json()

    const insrt=`
        INSERT INTO Products(vendor_id,title,price,description,category,image,rating_rate)
        VALUES(?,?,?,?,?,?,?);
    `

    await Promise.all(jsondata.map(async (i)=>{
        return db.run(insrt,-1,i.title,i.price,i.description,i.category,i.image,i.rating.rate)
    }))

}
else{
  console.log('Data Already exists!!');
}

    app.listen(3004,()=>{
        console.log('Server is Running at http://localhost:3004')
    })
}
catch(e){
    console.log(`The Error Message is ${e}`)
}
}

initializeConnection()


const middleWear=(req,res,next)=>{

    const authHead=req.headers['authorization']
    let jtTkn;

    if(authHead){
        jtTkn=authHead.split(' ')[1]

        if (jtTkn){
            jwt.verify(jtTkn,process.env.JWT_SECRET,(err,payload)=>{
               if(err){
                 return  res.status(403).json({message:'Invalid JWT Token'})
               }

               next()

            })
        }
        else{
            return res.status(401).json({message:'JWT token missing'})
        }
    }
    else{
        return res.status(401).json({message:'Authorization Head is undefined!!'})
    }

}

app.get('/products',middleWear,async (req,res)=>{

    const getProducts=`
      SELECT * FROM Products;
    `
    try{
    const rungetProducts=await db.all(getProducts);
    res.status(200).json({products:rungetProducts})
    }
    catch(e){
        res.status(500).json({message:'Internal Error' })
    }

})

app.get('/item/:id',middleWear, async (req,res)=>{

   const {id}=req.params

    const  getItem=`
       SELECT * FROM Products WHERE id=?
    `
    try{
    const frstRun=await db.get(getItem,id)


    const simProducts=`
      SELECT * FROM Products WHERE category=? AND id<>?
    `
    const scndRun=await db.all(simProducts,frstRun.category.toLowerCase(),parseInt(id))


    res.status(200).json({prodItem:frstRun,simiProducts:scndRun})
    }
    catch(e){
        res.status(500).json({message:'Server Error'})
    }
})

app.post('/cartItem',middleWear,async (req,res)=>{

    try{
    const {product_id,user_id}=req.body

    const chckItem=`
       SELECT * FROM Cart WHERE product_id=? AND user_id=?
    `
    const runchckItem=await db.get(chckItem,product_id,user_id)
    if (runchckItem===undefined){
    const insrtCart=`
       INSERT INTO Cart(product_id,user_id)
       VALUES(?,?)
    `

    await db.run(insrtCart,product_id,user_id)

    }
    else{
       const updItem=`
         UPDATE Cart SET quantity=? WHERE product_id=? AND user_id=?
       `
       await db.run(updItem,runchckItem.quantity+1,runchckItem.product_id,runchckItem.user_id)
    }
    res.status(200).json({message:'Product added successfully!!'})

    }
    catch(e){
        res.status(500).json({message:'Internal Error'})
    }
})

app.get('/retcartItems/:userId',middleWear,async (req,res)=>{

    const {userId}=req.params
  
    const retItems=`
       SELECT 
       Cart.id AS id,
       Cart.product_id AS product_id,
       Cart.user_id AS user_id,
       Products.image AS image,
       Products.price AS price,
       Products.title AS title,
       Cart.quantity AS quantity
       FROM Cart JOIN Products
       ON Cart.product_id=Products.id
       WHERE Cart.user_id=?

    `

    try{

    const runretItems=await db.all(retItems,parseInt(userId))

    res.status(200).json({items:runretItems})
    }
    catch(e){
        res.status(500).json({message:'Internal Error'})
    }

})

app.patch('/incQuan/:idt1/:idt2',middleWear, async (req,res)=>{
    const {idt1,idt2}=req.params

    try{
    const getProd=`
      SELECT * FROM Cart WHERE product_id=? AND user_id=?
    `

    const resgetProd=await db.get(getProd,idt1,idt2)

    const uptQuan=`
        UPDATE Cart SET quantity=? WHERE product_id=? AND user_id=?
    `
    await db.run(uptQuan,resgetProd.quantity+1,idt1,idt2)

    const updItems=`
       SELECT 
       Cart.id AS id,
       Cart.product_id AS product_id,
       Cart.user_id AS user_id,
       Products.image AS image,
       Products.price AS price,
       Products.title AS title,
       Cart.quantity AS quantity
       FROM Cart JOIN Products
       ON Cart.product_id=Products.id
       WHERE Cart.user_id=? 
    `
    const runupdItems=await db.all(updItems,idt2)

    res.status(200).json({updItems:runupdItems})
    }
    catch(e){
        res.status(500).json({message:'Internal Error'}) 
    }
})

app.patch('/decQuan/:idt1/:idt2',middleWear, async (req,res)=>{
    const {idt1,idt2}=req.params

    try{
        const getProd=`
          SELECT * FROM Cart WHERE product_id=? AND user_id=?
        `
    
        const resgetProd=await db.get(getProd,idt1,idt2)

        if (resgetProd.quantity==1){
          const delItem=`
            DELETE FROM Cart WHERE product_id=? AND user_id=?
          `
          await db.run(delItem,idt1,idt2)
        }

        else{
    
        const uptQuan=`
            UPDATE Cart SET quantity=? WHERE product_id=? AND user_id=?
        `
        await db.run(uptQuan,resgetProd.quantity-1,idt1,idt2)
        }
    
        const updItems=`
           SELECT 
           Cart.id AS id,
           Cart.product_id AS product_id,
           Cart.user_id AS user_id,
           Products.image AS image,
           Products.price AS price,
           Products.title AS title,
           Cart.quantity AS quantity
           FROM Cart JOIN Products
           ON Cart.product_id=Products.id
           WHERE Cart.user_id=? 
        `
        const runupdItems=await db.all(updItems,idt2)
    
        res.status(200).json({updItems:runupdItems})
        }
        catch(e){
            res.status(500).json({message:'Internal Error'}) 
        }
})

app.delete('/delItem/:idt1/:idt2',middleWear,async (req,res)=>{

   const {idt1,idt2}=req.params

    const deltQuery=`
          DELETE FROM Cart WHERE product_id=? AND user_id=?
        `
    try{
      await db.run(deltQuery,idt1,idt2)

    const modItems=`
           SELECT 
           Cart.id AS id,
           Cart.product_id AS product_id,
           Cart.user_id AS user_id,
           Products.image AS image,
           Products.price AS price,
           Products.title AS title,
           Cart.quantity AS quantity
           FROM Cart JOIN Products
           ON Cart.product_id=Products.id
           WHERE Cart.user_id=? 
    `
    const runmodItems=await db.all(modItems,idt2)

    res.status(200).json({modItems:runmodItems})


    }
    catch(e){
        res.status(500).json({message:'Internal Error'}) 
    }
    
})

app.post('/orders',middleWear, async (req,res)=>{

    const {total_price,cartItems,user_id}=req.body


    try {
    const insrtOrder=`
       INSERT INTO Orders(user_id,totalPrice)
       VALUES(?,?)
    `
    const runinsrtOrder= await db.run(insrtOrder,user_id,total_price)


    const insrtOrderItems=`
      INSERT INTO order_items(order_id,product_id,quantity,price)
      VALUES(?,?,?,?)
    `

    await Promise.all(cartItems.map(async (i)=>{
        return db.run(insrtOrderItems,runinsrtOrder.lastID,i.product_id,i.quantity,i.quantity*i.price)
    }))

    const delItemsCart=`
        DELETE FROM Cart WHERE user_id=?
    `
    await db.run(delItemsCart,user_id);

   

    res.status(201).json({status:201, message: "Order placed successfully"});

    }
    catch(e){
    res.status(500).json({ error: "Internal server error" });
    }


})

app.get('/orders/:userId',middleWear,async (req,res)=>{

    const {userId}=req.params

    const orderItems=`
      SELECT * FROM Orders WHERE user_id=?;
    `

    try{
    const runorderItems=await db.all(orderItems,userId)
    res.status(200).json({orderItems:runorderItems})
    }
    catch(e){
        res.status(500).json({ error: "Internal server error" });
    }
})


app.get('/order_details/:id',middleWear, async (req,res)=>{

    const {id}=req.params


    try{

    const joinQuery=`
       SELECT 
        order_items.id AS ord_id,
        Products.image AS img,
        order_items.quantity AS quan,
        order_items.price AS price
       FROM Products JOIN order_items ON Products.id=order_items.product_id
       WHERE order_items.order_id=?;
    `

    const runjoinQuery=await db.all(joinQuery,id)

    res.status(200).json({orderDetails:runjoinQuery})
    }
    catch(e){
        res.status(500).json({ error: "Internal server error" }); 
    }


})


app.post('/upload',upload.single('image'),middleWear,async (req,res)=>{


   const {vendorId,title,description,price,category,rating}=req.body

   const prodImg=req.file

   const uploadResult = await cloudinary.uploader.upload(prodImg.path);


    try{
         const insrtVendorProd=`
              INSERT INTO Products(vendor_id,title,price,description,category,image,rating_rate)
              VALUES(?,?,?,?,?,?,?);
         `

         await db.run(insrtVendorProd,vendorId,title,price,description,category,uploadResult.secure_url,rating)

         res.status(200).json({ message: "Upload successful" });

    }
    catch(e){
        res.status(500).json({ error: "Internal server error" }); 
    }
})


app.put('/products/:id',upload.single("image"),middleWear,async (req,res)=>{

    const {id}=req.params

    const {title,description,price,category,rating}=req.body

    const updProdImg=req.file


    const updProdVen=`
          UPDATE Products SET 
          title=?,
          description=?,
          price=?,
          category=?,
          rating_rate=?,
          image=?
          WHERE id=?
       `
    try{
    if (updProdImg===undefined){    

       await db.run(updProdVen,title,description,price,category,rating,req.body.prevIm,id)

    }
    else{

        const updResult = await cloudinary.uploader.upload(updProdImg.path);

        console.log(updResult.secure_url)


        await db.run(updProdVen,title,description,price,category,rating,updResult.secure_url,id)

    }
 
    res.status(200).json({ error: "Product Updated Successfully!" }); 
}
catch(e){
    res.status(500).json({ error: e.message }); 
}
})


app.delete('/products/:id',middleWear,async (req,res)=>{

    const {id}=req.params

     const delProdVen=`
      DELETE FROM Products WHERE id=?
     `
    try{
        await db.run(delProdVen,id);

        
       

        res.status(200).json({message:'Product deleted successfully'})
    }
    catch(e){
        res.status(500).json({ error: "Internal server error" }); 
    }

})


app.post('/register', async (req,res)=>{
    
    
    const {name,email,password,role}=req.body


    const chckUser=`
       SELECT * FROM People WHERE email=?
    `
    try{

    const reschckUser=await db.get(chckUser,email)

    if (reschckUser===undefined){

        const hashedPassword=await bcrypt.hash(password,10)

        const insrtPerson=`
           INSERT INTO People(name,email,password,role)
           VALUES(?,?,?,?);
        `
        await db.run(insrtPerson,name,email,hashedPassword,role)
        res.status(201).json({status:201, message: "Registration successful" }); 

    }
    else{
        res.status(400).json({message:'User Already Exists'}); 
   
    }
}
catch(e){
    res.status(500).json({message: "Internal server error" }); 
}

})

app.post('/login',async (req,res)=>{
      
    const {email,password}=req.body


    const regUser=`
       SELECT * FROM People WHERE email=?;
    `
    try{

    const resregUser=await db.get(regUser,email)

    if (resregUser!==undefined){

        const cmpPswrd=await bcrypt.compare(password,resregUser.password)

        if(cmpPswrd){

            const payload=resregUser
            const jwtToken=jwt.sign(payload,process.env.JWT_SECRET)

            res.status(200).json({token:jwtToken,user_details:resregUser})

        }
        else{
            res.status(400).json({message:'Passwords did not match'}) 
        }
    }
    else{
        res.status(400).json({message:'User did not register'})
    }
}
catch(e){
    res.status(500).json({ message: `Internal server error ${e.message}` }); 
}

})


app.get('/products/:id',middleWear,async (req,res)=>{

    const {id}=req.params

    const getVendorItems=`
      SELECT * FROM Products WHERE vendor_id=?
    `
    try{
    const resgetVendorItems=await db.all(getVendorItems,id)

    res.status(200).json({venLis:resgetVendorItems})
    }
    catch(e){
        res.status(500).json({ message: "Internal server error" }); 
    }

})

app.get('/vendor_dashboard/:vendorId',middleWear,async (req,res)=>{

    const {vendorId}=req.params

    const salesBoard=`
        SELECT
        Orders.id AS Order_ID,
    Products.title AS Product_Name,
    order_items.quantity AS Quantity,
    order_items.price AS Total_Price, 
    Orders.order_date AS Order_Date
FROM (Products 
JOIN order_items ON Products.id = order_items.product_id) AS T
JOIN Orders ON T.order_id = Orders.id
WHERE Products.vendor_id = ?;
    `

    try{

    const ressalesBoard=await db.all(salesBoard,vendorId);


    res.status(200).json({sales:ressalesBoard})

    }
    catch(e){
        res.status(500).json({ message: "Internal server error" }); 
    }
})


app.delete('/user_lgout/:id',middleWear,async (req,res)=>{

    const {id}=req.params

    try{

    const delUserPeople=`
       DELETE FROM People WHERE id=?;
    `

    await db.run(delUserPeople,id)

    const userCart=`
       DELETE FROM Cart WHERE user_id=?;
    `

    await db.run(userCart,id)


    const getOrderId=`
       SELECT id FROM Orders WHERE user_id=?
    `

    const resgetOrderId=await db.all(getOrderId,id)

    const userOrders=`
       DELETE FROM Orders WHERE user_id=?;
    `

    await db.run(userOrders,id);

    const userOrderItems=`
     DELETE FROM order_items WHERE order_id=?
    `
    await Promise.all(
     
        resgetOrderId.map(async (i)=>{
            return db.run(userOrderItems,i.id)
        })

    )
   
    return res.status(200).json({message:'User successfully logged out!!'})

}

catch(e){
    res.status(500).json({ message: "Internal server error" }); 
}


})

app.delete('/vendor_lgout/:id',middleWear,async (req,res)=>{
      
   const {id}=req.params

   try{

   const delUserPeople=`
       DELETE FROM People WHERE id=?;
    `

    await db.run(delUserPeople,id)

    const venProducts=`
       DELETE FROM Products WHERE vendor_id=?
    `
    await db.run(venProducts,id)

    return res.status(200).json({message:'Vendor successfully logged out!!'})

   }

   catch(e){
    res.status(500).json({ message: "Internal server error" }); 
}





})


