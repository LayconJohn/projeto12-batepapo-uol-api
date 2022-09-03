import express from "express";
import cors from "cors";
import chalk from "chalk";
import dayjs from "dayjs";
import Joi from "joi";
import {  MongoClient, ObjectId } from "mongodb";
import { strict as assert } from "assert";
import { stripHtml } from "string-strip-html";


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

//Remover um usuário após 10 segundos de uso
async function verificarInativos() {
    try {
        const participantes = await db.collection("participantes").find().toArray();
        participantes.forEach( async (participante) => {
            if (Date.now() - participante.lastStatus > 10 * 1000) {
                await db.collection("participantes").deleteOne({name: participante.name});
                await db.collection("mensagens").insertOne(
                    {
                        from: participante.name, to: 'Todos', text: 'sai da sala...', type: 'status', time: dayjs().format("HH:mm:ss")}
                )
                console.log("Inativos removidos")
            }
        })
    } catch (error) {
        console.error(error);
    }
}
//setInterval(verificarInativos, 15 * 1000);

//Rotas Participants
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
    };

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

//Rotas Messages
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
        const participanteExistente = await db.collection("participantes").findOne({name: from});
        if (!participanteExistente) {
            res.sendStatus(422);
            return;
        }

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

    const usuario = req.headers.user

    try {
        const mensagens = await db.collection("mensagens").find().toArray();
        if (!limit || limit === 0) {
            const mensagensFiltradas = mensagens.filter( mensagem => {
                return (
                    mensagem.type === "public"
                    || mensagem.type === "status"
                    || (mensagem.type === "private_message" && (mensagem.to === usuario || mensagem.from === usuario))
                )
            })
            res.status(200).send({messages: mensagensFiltradas.reverse()});
            return  
        };
        const mensagensLimitadas = mensagens.slice(-limit);
        res.status(200).send({messages: mensagensLimitadas}); 
    } catch (error) {
        console.error(error.message);
        res.status(500).send({message: "Erro ao pegar as mensagens"})
    }

});

app.delete("/messages/:id", async (req, res) => {
    const {id} = req.params;

    const user = req.headers.user;


    try {

        const mensagem = await db.collection("mensagens").findOne({_id: ObjectId(id)});

        if (!mensagem) {
            res.sendStatus(404);
            return;
        }

        if (user !== mensagem.from) {
            res.sendStatus(401);
            return;
        };


        await db.collection("mensagens").deleteOne({_id: ObjectId(id)});

        res.sendStatus(200);

    } catch (error) {
        console.error(error.message)
        res.status(500).send({message: "Erro ao deletar mensagem"});
    }
})

app.put("/messages/:id", async (req, res) => {
    const {to, text, type} = req.body;
    const {id} = req.params;
    const from = req.headers.user;

    //validation
    const schema = Joi.object({
        to: Joi.string().min(1).required(),
        text: Joi.string().min(1).required(),
        type: Joi.valid("message", "private_message")
    })

    const camposContemErro = schema.validate({to, text, type}).error
    if (camposContemErro) {
        res.sendStatus(422);
        return;
    }

    try {
        const user = await db.collection("participantes").findOne({name: from});
        if (!user) {
            res.sendStatus(422);
            return;
        }

        const mensagem = await db.collection("mensagens").findOne({_id: ObjectId(id)});
        if (!mensagem) {
            res.sendStatus(404);
            return;
        }

        if (mensagem.from !== from) {
            res.sendStatus(401);
            return;
        }

        await db.collection("mensagens").updateOne({_id: ObjectId(id)}, {$set: {
            to:to,
            text: text, 
            type: type
        }})

        res.sendStatus(200);
    } catch (error) {
        console.error(error.message);
        res.status(500).send({message: "Não foi possível atualizar a mensagem"})
    }
})

//Rotas Status
app.post("/status", async (req, res) => {
    const usuario = req.headers.user;

    try {
        const participante = await db.collection("participantes").findOne({name: usuario});
        if (!participante) {
            res.sendStatus(404);
            return;
        }
    
        await db.collection("participantes").updateOne({
            name: usuario
        }, {
            $set: {name: usuario, lastStatus: Date.now()}
        })
        res.sendStatus(200);
    } catch (error) {
        console.error(error.message);
        res.status(500).send({message: "Não foi possível atualizar o Status"});
    }

})


app.listen(5000, () => {
    console.log(chalk.greenBright("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"))
    console.log(chalk.green("Servidor rodando na porta 5000"))
    console.log(chalk.greenBright("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"))
})