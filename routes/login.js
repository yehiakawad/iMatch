const express = require('express');
const router = express.Router();
const userMethods = require("../data/users.js");

router.get('/', async (req, res) => {
    try {
        res.render('user/login');
    }
    catch (e) {
        res.sendStatus(404).json({ error: e });
    }
});

router.post('/', async (req,res) => {
    if (!req.body.username || !req.body.password) {
        res.status(401).render('user/login',{ error: "Please provide both a valid username and a valid password"});
        return;
    }
    try {
        const inputUser = await userMethods.getUserByUsername(req.body.username);
        
        if (!inputUser) {
            res.status(401).render('user/login', { error: "No user with that username"});
            return;
        }
        
        let verifyUser = await userMethods.verifyUser(req.body.username, req.body.password, req.session.id);
        
        if (verifyUser) {
            req.session.loginStatus = true;
            res.redirect('/dashboard');
        } else {
            res.status(401).render("user/login", { error: "Cannot verify user"});
            return;
        }
    } catch (e) {
        res.status(500).send();
    }
});
module.exports = router;
