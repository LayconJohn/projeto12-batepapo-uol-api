import express from "express";
import cors from "cors";
import chalk from "chalk";
import dayjs from "dayjs";
import Joi from "joi";

const app = express();

app.use(cors());
app.use(express.json());

const participantes = [];
const mensagens = [];

app.post("/participants", (req, res) => {
    const {name} = req.body;

    const schema = Joi.object({
        name: Joi.string().min(1).required()
    })


    const nameContemErro = schema.validate({name}).error
    if (nameContemErro) {
        res.sendStatus(422);
        return;
    }

    const nameJaExiste = participantes.find(value => value.name === name);
    if (nameJaExiste) {
        res.sendStatus(409);
        return;
    }

    participantes.push({name: name, lastStatus: Date.now()});

    mensagens.push({from: name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs().format("HH:mm:mm")})

    //console.log(participantes);
    //console.log(mensagens);
    res.sendStatus(201);
})

app.get("/participants", (req, res) => {
    res.status(200).send(participantes);
})

app.listen(5000, () => {
    console.log(chalk.greenBright("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"))
    console.log(chalk.green("Servidor rodando na porta 5000"))
    console.log(chalk.greenBright("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"))
})