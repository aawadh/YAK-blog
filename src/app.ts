import express from "express";
import { config } from "dotenv";
import { connectToDatabase } from "./utils/connection";
import { graphqlHTTP } from "express-graphql";
import schema from "./Handlers/handlers";
import cors from "cors";

config();
const app = express();
app.use(cors());
app.use("/graphql", graphqlHTTP({ schema: schema, graphiql: false}));

const PORT = process.env.PORT;

connectToDatabase().then(() => {
    app.listen(PORT,() => console.log(`Server Open On Port ${PORT}`));
}).catch((err) => console.log(err));



