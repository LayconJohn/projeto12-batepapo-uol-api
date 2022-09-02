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


app.post("/participants", async (req, res) => {

    const {name} = req.body;

    //validation
    const schema = Joi.object({
        name: Joi.string().min(1).required()
    })

    const nameContemErro = schema.validate({name}).error
    if (nameContemErro) {
        res.sendStatus(422);
        return;
    }

    try {
        //filtrar se participante já existe
        const participantes = await db.collection("participantes").find().toArray();
        const nameJaExiste = participantes.find(value => value.name === name);
        if (nameJaExiste) {
            res.sendStatus(409);
            return;
        }
        
        await db.collection("participantes").insertOne({name: name, lastStatus: Date.now()});
        await db.collection("mensagens").insertOne({from: name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs().format("HH:mm:ss")})
    
        res.sendStatus(201);
    } catch (error) {
        console.error(error.message);
        res.status(500).send({message: "Erro ao inserir um novo participante"})
    }
})

app.get("/participants", async (req, res) => {

    try {
        const participantes = await db.collection("participantes").find().toArray();
        res.status(200).send({participants: participantes});
    } catch (error) {
        console.error(error.message);
        res.status(500).send({message: "Erro ao pegar a lista de participantes"})
    }
    
})

app.post("/messages", async (req, res) => {
    const {to, text, type} = req.body;
    const from = req.headers.user;

    const schema = Joi.object({
        to: Joi.string().min(1).required(),
        text: Joi.string().min(1).required()
    })

    const mensagemContemErro = schema.validate({to, text}).error !== undefined;
    const tipoMensagemEhValida = type === "message" || type === "private_message";
    if (mensagemContemErro || !tipoMensagemEhValida) {
        res.sendStatus(422);
        return;
    }

    const body = {from: from, to: to, text: text, type: type, time: dayjs().format("HH:mm:ss")}

    try {
        await db.collection("mensagens").insertOne({
            from: from,
            to: to, 
            text: text, 
            type: type, 
            time: dayjs().format("HH:mm:ss")
        });
    
        res.sendStatus(201);
    } catch (error) {
        console.error(error.message);
        res.status(500).send({message: "Erro ao inserir a mensagem"});
    }
});

app.get("/messages", async (req, res) => {
    const limit = Number(req.query.limit);

    try {
        
    } catch (error) {
        console.error(error.message);
        res.status(500).send({message: "Erro ao pegar as mensagens"})
    }
    const mensagens = await db.collection("mensagens").find().toArray();
    if (!limit || limit === 0) {
        res.status(200).send({messages: mensagens.reverse()});
        return  
    };
    const mensagensLimitadas = mensagens.slice(-limit);
    res.status(200).send({messages: mensagensLimitadas});
});


app.listen(5000, () => {
    console.log(chalk.greenBright("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"))
    console.log(chalk.green("Servidor rodando na porta 5000"))
    console.log(chalk.greenBright("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"))
})