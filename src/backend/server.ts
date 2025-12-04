// package imports
import * as path from "path";
import express from "express";
import morgan from "morgan";
import createHttpError from "http-errors";

// file imports
import rootRoutes from "./routes/root";
import { testRouter } from "./routes/test";

// create express app
const app = express();
const PORT = process.env.PORT || 3000;

// middleware setup
app.use(morgan("dev"));
app.use(express.static(path.join(__dirname, "../frontend")));
app.use(express.urlencoded({extended: false}));
app.use(express.json());
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// routing
app.use("/", rootRoutes);
app.use("/test", testRouter);

// error handling
app.use((_request, _response, next) => {
  next(createHttpError(404));
});

// start server
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
