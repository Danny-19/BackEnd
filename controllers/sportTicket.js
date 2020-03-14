const jwt = require("jsonwebtoken");
const SportTicket = require("../models/sportTicket");
const Match = require("../models/match");
const User = require("../models/user");
const GLobalBalance = require("../models/globalBalance");

exports.createSportTicket = async (req, res) => {
    try {
        const { userId, betValue, matchBets } = req.body;

        // Se verifica que apueste para al menos 5 partidos
        if(matchBets.length < 5){
            return res.status(406).json({
                message: "Es necesario registrar al menos 5 apuestas"
            });
        }

        // Se encuentra la fecha del último partido
        var closingDate= null;

        for (const matchBet of matchBets) {
            var match = await Match.findById(matchBet.match);

            if(!closingDate || closingDate < match.matchDate){
                closingDate = match.matchDate;
            }
        };

        //Se verifica que el usuario tenga suficiente dinero y se le resta del balance
        const user = await User.findById(userId);


        if (user.balance < betValue) {
            return res.status(401).json({
                message: "El usuario no tiene suficiente saldo para realizar esta apuesta"
            });
        }

        const newUserBalance = user.balance - betValue;
        const result1 = await User.updateOne({ _id: userId }, { balance: newUserBalance });
        if (result1 <= 0) {
            return res.status(401).json({
                message: "Ocurrió un error al restar el valor del saldo del usuario"
            });
        }
        
        // Se crea la apuesta deportiva
        const sportTicket = new SportTicket({ user, betValue, matchBets, closingDate, creationDate: new Date() });
        const result = await sportTicket.save();
        res.status(201).json({
            message: "Apuesta deportiva creada satisfactoriamente",
            result: result
        });

    } catch (err) {
        console.log(err);
        return res.status(500).json({
            message: "Internal server error"
        });
    }
};

exports.setSportWinners = async (req, res) => {
    try {
        const spTickets = await SportTicket.find();
        const today = new Date();

        spTickets.forEach(async (spTicket) => {
            //se verifica que el tiquete no se haya evaluado y que ya esté cerrado
            if(typeof spTicket.isWinner === "undefined" && today >= spTicket.closingDate){
                var areCorrect = 0;
                
                //se cuentan los aciertos en el tiquete
                spTicket.matchBets.forEach(async (bet) => {
                    const match = await Match.findById(bet.match);
                    const userScore = bet.scoreBoard;

                    if(userScore === match.finalScoreBoard){
                        areCorrect = areCorrect + 1;
                    }
                });
                //userProfit es el porcentaje de la ganancia
                var userProfit = 0;
                if (areCorrect >= 5){
                    switch (areCorrect) {
                        case 5:
                          userProfit = 8;
                          break;
                        case 6:
                          userProfit = 8.5;
                          break;
                        case 7:
                          userProfit = 9;
                          break;
                        case 8:
                          userProfit = 12;
                          break;
                        case 9:
                          userProfit = 17;
                          break;
                        default:
                          userProfit = 25;
                    }
                    //se actualiza el tiquete: si ganó o no, cuántas acertó y el porcentaje que ganó
                    const result = await SportTicket.updateOne({ _id: spTicket.id }, {isWinner: true, correct: areCorrect, profit: userProfit, awarded: false});
                } else{
                    //si no ganó, no se guarda el atributo awarded
                    const result = await SportTicket.updateOne({ _id: spTicket.id }, {isWinner: false, correct: areCorrect, profit: userProfit});
                }
                
                if (result.n <= 0) {
                    res.status(401).json({ message: "Error al actualizar tiquetes deportivos" });
                }
            }
        });

        if (result.n > 0) {
            res.status(200).json({ message: 'Se determinaron los ganadores satisfactoriamente' });
        }
    } catch (err) {
        console.log(err);
        res.status(500).json({
            message: err
        });
    }
};