import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGO_URI);

await client.connect();

export const mongo = client.db("stayspot");

export const searchSessions = mongo.collection("SearchSessions");
export const propertyReviews = mongo.collection("PropertyReviews");
export const propertyAmenities = mongo.collection("PropertyAmenities");