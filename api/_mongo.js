
import { MongoClient, ServerApiVersion } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI environment variable is missing.");

const options = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true
  },
  maxPoolSize: 10
};

let promise = globalThis.__sf13MongoPromise;

if (!promise) {
  const client = new MongoClient(uri, options);
  promise = client.connect();
  globalThis.__sf13MongoPromise = promise;
}

export async function getDb() {
  const client = await promise;
  return client.db(process.env.MONGODB_DB || "sf13");
}
