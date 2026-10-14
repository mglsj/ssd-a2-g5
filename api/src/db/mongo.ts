import { MongoClient } from "mongodb";
import { config } from "../config.ts";

const client = new MongoClient(config.MONGO_URI, { serverSelectionTimeoutMS: 5000 });

export const mongo = client.db(config.MONGO_DB);

export const searchSessions = mongo.collection("SearchSessions");
export const propertyReviews = mongo.collection("PropertyReviews");
export const propertyAmenities = mongo.collection("PropertyAmenities");
