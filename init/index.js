import connectDB from "../config/Db.js";
import Data  from "./data.js";
import slugify from "slugify";
import dotenv from "dotenv";
import Listing from "../models/listing.js";

dotenv.config();
connectDB();
 
const initDB = async () => {

    const dataWithSlug = Data.map((item) => ({
        ...item,
        slug: slugify(item.title, {
            lower: true,
            strict: true
        })
    }));

    await Listing.insertMany(dataWithSlug);

    console.log("Data was initialized");
};

initDB();