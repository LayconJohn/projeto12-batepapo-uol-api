import express from "express";
import cors from "cors";
import chalk from "chalk";
import dayjs from "dayjs";
import Joi from "joi";
import { MongoClient } from "mongodb";

const app = express();
const url = "mongodb://localhost:27017";
const cliente = new MongoClient(url);
let db;

cliente.connect().then(() => {
	db = cliente.db("bate_papo_uol");
});

let participantes;
let mensagens;


app.use(cors());
app.use(express.json());


app.post("/participants", (req, res) => {

    const {name} = req.body;

    //validation
    const schema = Joi.object({
        name: Joi.string().min(1).required()
    })

    //verificar esse teste
    db.collection("participantes").find().toArray().then(users => {
        //console.log(users)
        const nameJaExiste = users.find(value => value.name === name);
        if (nameJaExiste) {
            res.sendStatus(409);
            return;
        }
    });

    const nameContemErro = schema.validate({name}).error
    if (nameContemErro) {
        res.sendStatus(422);
        return;
    }

    db.collection("participantes").insertOne({name: name, lastStatus: Date.now()});
    db.collection("mensagens").insertOne({from: name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs().format("HH:mm:mm")})

    res.sendStatus(201);
})

app.get("/participants", (req, res) => {
    
    db.collection("participantes").find().toArray().then(users => {
        res.status(200).send({participants: users});
    });
    
})

app.post("/messages", (req, res) => {
    const {to, text, type} = req.body;
    const {from} = req.headers.user;

    const body = {from: from, to: to, text: text, type: type, time: dayjs().format("HH:mm:mm")}
    console.log(body)

    res.sendStatus(201);
})


app.listen(5000, () => {
    console.log(chalk.greenBright("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"))
    console.log(chalk.green("Servidor rodando na porta 5000"))
    console.log(chalk.greenBright("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"))
})